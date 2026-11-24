import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  CalendarClock,
  ClipboardList,
  FileText,
  Fingerprint,
  FolderHeart,
  Home,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
  User,
} from 'lucide-react-native';
import { OFFLINE_FALLBACK_BOOTSTRAP } from './src/data/clinicalCatalogs';
import {
  DEFAULT_EMPLOYEE_NUMBER,
  fetchClinicalBootstrap,
  flushOfflineQueue,
  loadOfflineQueue,
  submitClinicalAssessment,
  submitClinicalSoap,
  submitInterprofessionalReferral,
  submitPpiOrIncidentLog,
} from './src/services/rmeSyncService';
import {
  DEFAULT_PROFILE,
  LocalClinicalRecord,
  RecordStats,
  TherapistProfile,
  addRecord,
  deleteRecord,
  loadProfile,
  loadRecords,
  markAllSynced,
  markRecordSynced,
  queueToRecords,
  saveProfile,
  summarize,
} from './src/services/localRecordStore';
import { AgendaScreen } from './src/screens/AgendaScreen';
import { AssessmentScreen } from './src/screens/AssessmentScreen';
import { ActiveSessionScreen } from './src/screens/ActiveSessionScreen';
import { ComplianceScreen } from './src/screens/ComplianceScreen';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { PatientsRmeScreen } from './src/screens/PatientsRmeScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { RecordsHistoryScreen } from './src/screens/RecordsHistoryScreen';
import { AppointmentItem, BootstrapClinicalData } from './src/types/clinical';
import { getSipDaysRemaining } from './src/utils/clinicalFormatters';

type BottomTab =
  | 'BERANDA'
  | 'AGENDA'
  | 'ASESMEN'
  | 'SESI_SOAP'
  | 'RIWAYAT'
  | 'RME_PASIEN'
  | 'KEPATUHAN'
  | 'PROFIL';

const PIN_STORAGE_KEY = '@wicarasehat_pin_v1';
const SESSION_KEY = '@wicarasehat_session_v1';
const PIN_SEMENTARA = '240826';

export default function App() {
  /* ----------------------------- Autentikasi ----------------------------- */
  const [authChecked, setAuthChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [employeeNumber, setEmployeeNumber] = useState(DEFAULT_EMPLOYEE_NUMBER);
  const [profile, setProfile] = useState<TherapistProfile>(DEFAULT_PROFILE);
  const [storedPin, setStoredPin] = useState(PIN_SEMENTARA);

  /* ------------------------------- Data ---------------------------------- */
  const [currentTab, setCurrentTab] = useState<BottomTab>('BERANDA');
  const [clinicalData, setClinicalData] = useState<BootstrapClinicalData>(
    OFFLINE_FALLBACK_BOOTSTRAP
  );
  const [syncSource, setSyncSource] = useState<
    'CLOUD_SUPABASE_RME' | 'ENCRYPTED_LOCAL_CACHE'
  >('ENCRYPTED_LOCAL_CACHE');
  const [pendingQueueCount, setPendingQueueCount] = useState(0);
  const [offlineMode, setOfflineMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [records, setRecords] = useState<LocalClinicalRecord[]>([]);
  const [stats, setStats] = useState<RecordStats>(summarize([]));

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    OFFLINE_FALLBACK_BOOTSTRAP.patients[0]?.id ?? ''
  );
  const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(
    null
  );

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 4500);
  }, []);

  /* -------------------- Muat profil, PIN, dan sesi ----------------------- */
  useEffect(() => {
    (async () => {
      try {
        const [savedProfile, savedPin, session] = await Promise.all([
          loadProfile(),
          AsyncStorage.getItem(PIN_STORAGE_KEY),
          AsyncStorage.getItem(SESSION_KEY),
        ]);
        setProfile(savedProfile);
        setEmployeeNumber(savedProfile.employee_number || DEFAULT_EMPLOYEE_NUMBER);
        if (savedPin) setStoredPin(savedPin);
        // Sesi tetap terbuka selama belum dikunci manual oleh terapis.
        setAuthenticated(session === 'OPEN');
      } catch {
        // perangkat baru — tetap minta PIN
      } finally {
        setAuthChecked(true);
      }
    })();
  }, []);

  /* ----------------------------- Muat data ------------------------------- */
  const loadData = useCallback(
    async (forceOfflineFlag: boolean = offlineMode) => {
      setLoading(true);
      try {
        const res = await fetchClinicalBootstrap(employeeNumber, forceOfflineFlag);
        setClinicalData(res.data);
        setSyncSource(res.source);
        setPendingQueueCount(res.pendingQueueCount);

        const [localRecords, queue] = await Promise.all([
          loadRecords(),
          loadOfflineQueue(),
        ]);
        // Antrean offline bisa berasal dari catatan yang juga sudah tercatat lokal.
        // Buang entri antrean yang merupakan duplikat catatan lokal (klinik sama,
        // jenis sama, jarak waktu < 5 menit) agar Riwayat tidak dobel.
        const isDuplicate = (qRec: LocalClinicalRecord) =>
          localRecords.some(
            (lRec) =>
              lRec.kind === qRec.kind &&
              lRec.patient_id === qRec.patient_id &&
              Math.abs(
                new Date(lRec.created_at).getTime() - new Date(qRec.created_at).getTime()
              ) <
                5 * 60 * 1000
          );

        const byId = new Map<string, LocalClinicalRecord>();
        [...localRecords, ...queueToRecords(queue)].forEach((rec) => {
          if (isDuplicate(rec)) return;
          const prior = byId.get(rec.id);
          if (!prior || (!rec.synced && prior.synced)) byId.set(rec.id, rec);
        });
        const merged = Array.from(byId.values()).sort((a, b) =>
          b.created_at.localeCompare(a.created_at)
        );
        setRecords(merged);
        setStats(summarize(merged));

        if (res.data.patients.length > 0 && !selectedPatientId) {
          setSelectedPatientId(res.data.patients[0].id);
        }
      } finally {
        setLoading(false);
      }
    },
    [employeeNumber, offlineMode, selectedPatientId]
  );

  useEffect(() => {
    if (authenticated) {
      loadData(false);
    }
  }, [authenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ------------------------------ Login PIN ------------------------------ */
  const handleLogin = async () => {
    if (pinInput.length < 4) {
      setPinError('Masukkan PIN 6 digit.');
      return;
    }
    if (pinInput !== storedPin) {
      setPinError('PIN tidak sesuai. Coba lagi.');
      setPinInput('');
      return;
    }
    setPinError(null);
    await AsyncStorage.setItem(SESSION_KEY, 'OPEN');
    const updated = { ...profile, last_login_at: new Date().toISOString() };
    setProfile(updated);
    await saveProfile(updated);
    setAuthenticated(true);
    setPinInput('');
    await loadData(offlineMode);
    showToast('Sesi klinis dibuka. Selamat bekerja!');
  };

  const handleLock = async () => {
    await AsyncStorage.removeItem(SESSION_KEY);
    setAuthenticated(false);
    setPinInput('');
    setCurrentTab('BERANDA');
  };

  /* --------------------------- Aksi penyimpanan -------------------------- */
  async function saveSoapRecord(payload: Record<string, unknown>, synced: boolean) {
    const patient = clinicalData.patients.find((p) => p.id === selectedPatientId);
    await addRecord({
      kind: 'SOAP',
      patient_id: selectedPatientId,
      patient_name: patient?.full_name ?? '',
      medical_record_number: patient?.medical_record_number ?? '',
      therapist_name: clinicalData.therapist.full_name,
      title: `SOAP — ${String(payload.target_skill ?? 'Sesi terapi')}`,
      summary: `Akurasi ${String(payload.accuracy_percentage ?? '-')}% • ${
        payload.is_locked_tte ? 'TTE terkunci' : 'Draf'
      }`,
      synced,
      payload,
    });
    await refreshRecords();
  }

  async function saveAssessmentRecord(payload: Record<string, unknown>, synced: boolean) {
    const patient = clinicalData.patients.find((p) => p.id === selectedPatientId);
    await addRecord({
      kind: 'ASESMEN',
      patient_id: selectedPatientId,
      patient_name: patient?.full_name ?? '',
      medical_record_number: patient?.medical_record_number ?? '',
      therapist_name: clinicalData.therapist.full_name,
      title: `Asesmen — ${String(payload.domain ?? 'Domain klinis')}`,
      summary: String(payload.clinical_conclusion ?? 'Hasil asesmen tersimpan'),
      synced,
      payload,
    });
    await refreshRecords();
  }

  async function refreshRecords() {
    const [localRecords] = await Promise.all([loadRecords()]);
    const merged = localRecords.sort((a, b) => b.created_at.localeCompare(a.created_at));
    setRecords(merged);
    setStats(summarize(merged));
  }

  async function handleSyncAll() {
    if (offlineMode) {
      showToast('Mode offline aktif. Nonaktifkan untuk mengirim catatan.');
      return;
    }
    showToast('Mengirim catatan ke server RME…');
    const result = await flushOfflineQueue();
    if (result.flushed > 0) {
      await markAllSynced();
    }
    await loadData(false);
    if (result.remaining > 0) {
      showToast(
        `${result.flushed} catatan terkirim, ${result.remaining} masih menunggu koneksi server.`
      );
    } else if (result.flushed > 0) {
      showToast(`Selesai — ${result.flushed} catatan tersinkron ke Cloud RME & SATUSEHAT.`);
    } else {
      showToast('Tidak ada catatan dalam antrean. Semua sudah tersinkron.');
    }
  }

  async function handleDeleteRecord(id: string) {
    await deleteRecord(id);
    await refreshRecords();
    showToast('Catatan dihapus dari perangkat.');
  }

  async function handleClearLocalData() {
    const { clearRecords } = await import('./src/services/localRecordStore');
    await clearRecords();
    await refreshRecords();
    showToast('Seluruh data lokal telah dihapus.');
  }

  async function handleChangePin(newPin: string) {
    await AsyncStorage.setItem(PIN_STORAGE_KEY, newPin);
    setStoredPin(newPin);
  }

  async function handleToggleBiometric(enabled: boolean) {
    const updated = { ...profile, biometric_enabled: enabled };
    setProfile(updated);
    await saveProfile(updated);
    showToast(enabled ? 'Login biometrik diaktifkan.' : 'Login biometrik dinonaktifkan.');
  }

  /* ------------------------------- Render -------------------------------- */
  if (!authChecked) {
    return (
      <SafeAreaView style={styles.authRoot}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color="#14B8A6" />
        <Text style={styles.splashText}>Menyiapkan perangkat…</Text>
      </SafeAreaView>
    );
  }

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.authRoot}>
        <StatusBar style="light" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ width: '100%', alignItems: 'center' }}
        >
          <View style={styles.authCard}>
            <View style={styles.authBadgeRow}>
              <ShieldCheck size={24} color="#14B8A6" />
              <Text style={styles.authAppTitle}>WicaraSehat Terapis</Text>
            </View>
            <Text style={styles.authSubtitle}>
              Rekam Medis Elektronik Terapi Wicara • Patuh UU 17/2023, Permenkes 24/2022,
              Permenkes 81/2014 & UU PDP 27/2022
            </Text>

            <Text style={styles.authLabel}>ID Pegawai / Terapis Wicara</Text>
            <TextInput
              value={employeeNumber}
              onChangeText={setEmployeeNumber}
              style={styles.authInput}
              autoCapitalize="characters"
              placeholder="TW-2023-001"
              placeholderTextColor="#64748B"
            />

            <Text style={styles.authLabel}>PIN Sesi Klinis</Text>
            <TextInput
              value={pinInput}
              onChangeText={(t) => {
                setPinInput(t);
                setPinError(null);
              }}
              secureTextEntry
              keyboardType="numeric"
              maxLength={8}
              style={styles.authInput}
              placeholder="••••••"
              placeholderTextColor="#64748B"
              onSubmitEditing={handleLogin}
            />

            {pinError && <Text style={styles.pinErrorText}>{pinError}</Text>}
            <Text style={styles.pinHint}>
              PIN bawaan: 240826 — ubah melalui tab Profil setelah masuk.
            </Text>

            <Pressable onPress={handleLogin} style={styles.biometricBtn}>
              <Fingerprint size={18} color="#FFFFFF" />
              <Text style={styles.biometricBtnText}>Masuk ke Rekam Medis</Text>
            </Pressable>

            <Text style={styles.authFooter}>
              SIP aktif & kredensial diverifikasi otomatis sebelum tindakan klinis
            </Text>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  const sipDaysLeft = getSipDaysRemaining(clinicalData.therapist.sip_valid_until);
  const isSipExpired = sipDaysLeft <= 0;

  const tabs: Array<{
    id: BottomTab;
    label: string;
    Icon: React.ComponentType<{ size?: number; color?: string }>;
    badge?: number;
  }> = [
    { id: 'BERANDA', label: 'Beranda', Icon: Home },
    { id: 'AGENDA', label: 'Agenda', Icon: CalendarClock },
    { id: 'ASESMEN', label: 'Asesmen', Icon: Stethoscope },
    { id: 'SESI_SOAP', label: 'Terapi', Icon: ClipboardList },
    { id: 'RIWAYAT', label: 'Riwayat', Icon: FileText, badge: stats.pending },
    { id: 'RME_PASIEN', label: 'Pasien', Icon: FolderHeart },
    { id: 'KEPATUHAN', label: 'SOP/PPI', Icon: ShieldCheck },
    { id: 'PROFIL', label: 'Profil', Icon: User },
  ];

  return (
    <SafeAreaView style={styles.appOuter}>
      <StatusBar style="light" />
      <View style={styles.deviceShell}>
        {/* Top App Bar */}
        <View style={styles.topAppBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appBarSuper}>
              TERAPIS WICARA • FASYANKES {clinicalData.clinic.fasyankes_code}
            </Text>
            <Text style={styles.appBarTitle} numberOfLines={1}>
              {profile.full_name}
            </Text>
          </View>
          <Pressable onPress={handleLock} style={styles.lockSessionBtn}>
            <LockKeyhole size={13} color="#CCFBF1" />
            <Text style={styles.lockSessionText}>Kunci</Text>
          </Pressable>
        </View>

        {isSipExpired && (
          <View style={styles.sipBlockedBar}>
            <Text style={styles.sipBlockedText}>
              SIP Kedaluwarsa — pengisian tindakan klinis dikunci (UU 17/2023).
            </Text>
          </View>
        )}

        {toastMessage && (
          <View style={styles.toastBanner}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Main Viewport */}
        <View style={styles.mainViewport}>
          {loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={styles.loaderText}>
                Menyinkronkan Rekam Medis Elektronik & kredensial SIP…
              </Text>
            </View>
          ) : (
            <>
              {currentTab === 'BERANDA' && (
                <DashboardScreen
                  clinicalData={clinicalData}
                  records={records}
                  stats={stats}
                  syncSource={syncSource}
                  offlineMode={offlineMode}
                  pendingQueueCount={pendingQueueCount}
                  onOpenAgenda={() => setCurrentTab('AGENDA')}
                  onOpenHistory={() => setCurrentTab('RIWAYAT')}
                  onOpenPatients={() => setCurrentTab('RME_PASIEN')}
                  onOpenCompliance={() => setCurrentTab('KEPATUHAN')}
                  onStartSession={(appt) => {
                    setActiveAppointment(appt);
                    setSelectedPatientId(appt.patient_id);
                    setCurrentTab('SESI_SOAP');
                  }}
                  onOpenAssess={(patientId) => {
                    setSelectedPatientId(patientId);
                    setCurrentTab('ASESMEN');
                  }}
                />
              )}

              {currentTab === 'AGENDA' && (
                <AgendaScreen
                  clinic={clinicalData.clinic}
                  therapist={clinicalData.therapist}
                  rooms={clinicalData.rooms}
                  appointments={clinicalData.appointments}
                  patients={clinicalData.patients}
                  syncSource={syncSource}
                  pendingQueueCount={pendingQueueCount}
                  offlineMode={offlineMode}
                  onToggleOffline={() => {
                    const next = !offlineMode;
                    setOfflineMode(next);
                    showToast(
                      next
                        ? 'Mode Ruang Kedap Suara (Offline-First) diaktifkan.'
                        : 'Kembali ke Mode Sinkronisasi Cloud RME.'
                    );
                  }}
                  onRefreshSync={() => loadData(offlineMode)}
                  onStartSession={(appt) => {
                    setActiveAppointment(appt);
                    setSelectedPatientId(appt.patient_id);
                    setCurrentTab('SESI_SOAP');
                  }}
                  onOpenAssessment={(patientId) => {
                    setSelectedPatientId(patientId);
                    setCurrentTab('ASESMEN');
                  }}
                />
              )}

              {currentTab === 'ASESMEN' && (
                <AssessmentScreen
                  patients={clinicalData.patients}
                  selectedPatientId={selectedPatientId}
                  therapist={clinicalData.therapist}
                  onSelectPatient={setSelectedPatientId}
                  onSubmitAssessment={async (payload) => {
                    const res = await submitClinicalAssessment(payload, offlineMode);
                    await saveAssessmentRecord(payload, res.syncedToCloud);
                    showToast(res.message);
                    await loadData(offlineMode);
                  }}
                />
              )}

              {currentTab === 'SESI_SOAP' && (
                <ActiveSessionScreen
                  patients={clinicalData.patients}
                  carePlans={clinicalData.care_plans}
                  soapHistory={clinicalData.soap_sessions}
                  activeAppointment={activeAppointment}
                  selectedPatientId={selectedPatientId}
                  therapist={clinicalData.therapist}
                  onSelectPatient={(id) => {
                    setActiveAppointment(null);
                    setSelectedPatientId(id);
                  }}
                  onSubmitSoap={async (payload) => {
                    const res = await submitClinicalSoap(payload, offlineMode);
                    await saveSoapRecord(payload, res.syncedToCloud);
                    showToast(res.message);
                    await loadData(offlineMode);
                  }}
                />
              )}

              {currentTab === 'RIWAYAT' && (
                <RecordsHistoryScreen
                  records={records}
                  pendingQueueCount={pendingQueueCount}
                  offlineMode={offlineMode}
                  onSyncAll={handleSyncAll}
                  onDelete={handleDeleteRecord}
                />
              )}

              {currentTab === 'RME_PASIEN' && (
                <PatientsRmeScreen
                  patients={clinicalData.patients}
                  carePlans={clinicalData.care_plans}
                  soapSessions={clinicalData.soap_sessions}
                  therapist={clinicalData.therapist}
                  onOpenAssessment={(ptId) => {
                    setSelectedPatientId(ptId);
                    setCurrentTab('ASESMEN');
                  }}
                  onOpenSoap={(ptId) => {
                    setActiveAppointment(null);
                    setSelectedPatientId(ptId);
                    setCurrentTab('SESI_SOAP');
                  }}
                  onSubmitReferral={async (payload) => {
                    const res = await submitInterprofessionalReferral(
                      payload,
                      offlineMode
                    );
                    showToast(res.message);
                  }}
                />
              )}

              {currentTab === 'PROFIL' && (
                <ProfileScreen
                  profile={profile}
                  clinicalData={clinicalData}
                  stats={stats}
                  offlineMode={offlineMode}
                  syncSource={syncSource}
                  pendingQueueCount={pendingQueueCount}
                  onChangePin={handleChangePin}
                  onToggleBiometric={handleToggleBiometric}
                  onRefreshSync={() => loadData(offlineMode)}
                  onToggleOffline={() => {
                    const next = !offlineMode;
                    setOfflineMode(next);
                    showToast(
                      next ? 'Mode offline diaktifkan.' : 'Mode sinkronisasi cloud diaktifkan.'
                    );
                  }}
                  onClearLocalData={handleClearLocalData}
                  onLockSession={handleLock}
                />
              )}

              {currentTab === 'KEPATUHAN' && (
                <ComplianceScreen
                  therapist={clinicalData.therapist}
                  rooms={clinicalData.rooms}
                  patients={clinicalData.patients}
                  sops={clinicalData.sops}
                  sterilizationLogs={clinicalData.sterilization_logs}
                  auditLogs={clinicalData.audit_logs}
                  onSubmitPpiOrIkp={async (payload) => {
                    const res = await submitPpiOrIncidentLog(payload, offlineMode);
                    showToast(res.message);
                    await loadData(offlineMode);
                  }}
                />
              )}
            </>
          )}
        </View>

        {/* Bottom Navigation */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.bottomNavScroll}
          contentContainerStyle={styles.bottomNav}
        >
          {tabs.map(({ id, label, Icon, badge }) => {
            const active = currentTab === id;
            return (
              <Pressable key={id} onPress={() => setCurrentTab(id)} style={styles.navTab}>
                <View style={[styles.navIconPill, active && styles.navIconPillActive]}>
                  <Icon size={17} color={active ? '#0F766E' : '#64748B'} />
                  {!!badge && badge > 0 && (
                    <View style={styles.navBadge}>
                      <Text style={styles.navBadgeText}>{badge > 99 ? '99' : badge}</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  authRoot: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  splashText: { color: '#94A3B8', fontSize: 12, marginTop: 12, fontWeight: '600' },
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  authBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  authAppTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '800' },
  authSubtitle: { color: '#94A3B8', fontSize: 12, lineHeight: 18, marginBottom: 16 },
  authLabel: {
    color: '#CBD5E1',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 10,
    marginBottom: 5,
  },
  authInput: {
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#475569',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#FFFFFF',
    fontSize: 14,
  },
  pinErrorText: { color: '#FCA5A5', fontSize: 11.5, fontWeight: '700', marginTop: 7 },
  pinHint: { color: '#64748B', fontSize: 10, marginTop: 7 },
  biometricBtn: {
    marginTop: 18,
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  biometricBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  authFooter: {
    color: '#475569',
    fontSize: 9.5,
    textAlign: 'center',
    marginTop: 12,
    lineHeight: 14,
  },
  appOuter: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center' },
  deviceShell: {
    flex: 1,
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 520 : undefined,
    backgroundColor: '#F1F5F9',
    overflow: 'hidden',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#334155',
  },
  topAppBar: {
    backgroundColor: '#115E59',
    paddingHorizontal: 16,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  appBarSuper: { color: '#99F6E4', fontSize: 9.5, fontWeight: '800', letterSpacing: 0.3 },
  appBarTitle: { color: '#FFFFFF', fontSize: 14.5, fontWeight: '800', marginTop: 1 },
  lockSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockSessionText: { color: '#CCFBF1', fontSize: 10.5, fontWeight: '700' },
  sipBlockedBar: { backgroundColor: '#DC2626', paddingHorizontal: 14, paddingVertical: 7 },
  sipBlockedText: { color: '#FFFFFF', fontSize: 10.5, fontWeight: '800' },
  toastBanner: { backgroundColor: '#065F46', paddingHorizontal: 14, paddingVertical: 8 },
  toastText: { color: '#ECFDF5', fontSize: 11.5, fontWeight: '700' },
  mainViewport: { flex: 1 },
  loaderBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loaderText: {
    marginTop: 12,
    fontSize: 12.5,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomNavScroll: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    maxHeight: 62,
    flexGrow: 0,
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 6,
    gap: 2,
  },
  navTab: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10, minWidth: 54 },
  navIconPill: { paddingHorizontal: 11, paddingVertical: 3, borderRadius: 999 },
  navIconPillActive: { backgroundColor: '#CCFBF1' },
  navBadge: {
    position: 'absolute',
    top: -3,
    right: 2,
    backgroundColor: '#DC2626',
    borderRadius: 999,
    minWidth: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  navBadgeText: { color: '#FFFFFF', fontSize: 8, fontWeight: '900' },
  navLabel: { fontSize: 9.5, fontWeight: '700', color: '#64748B', marginTop: 1 },
  navLabelActive: { color: '#0F766E', fontWeight: '800' },
});
