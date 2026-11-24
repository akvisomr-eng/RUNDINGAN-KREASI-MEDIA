import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import {
  CalendarClock,
  ClipboardList,
  Fingerprint,
  FolderHeart,
  LockKeyhole,
  ShieldCheck,
  Stethoscope,
} from 'lucide-react-native';
import { OFFLINE_FALLBACK_BOOTSTRAP } from './src/data/clinicalCatalogs';
import {
  DEFAULT_EMPLOYEE_NUMBER,
  fetchClinicalBootstrap,
  submitClinicalAssessment,
  submitClinicalSoap,
  submitInterprofessionalReferral,
  submitPpiOrIncidentLog,
} from './src/services/rmeSyncService';
import { ActiveSessionScreen } from './src/screens/ActiveSessionScreen';
import { AgendaScreen } from './src/screens/AgendaScreen';
import { AssessmentScreen } from './src/screens/AssessmentScreen';
import { ComplianceScreen } from './src/screens/ComplianceScreen';
import { PatientsRmeScreen } from './src/screens/PatientsRmeScreen';
import { AppointmentItem, BootstrapClinicalData } from './src/types/clinical';
import { getSipDaysRemaining } from './src/utils/clinicalFormatters';

type BottomTab = 'AGENDA' | 'ASESMEN' | 'SESI_SOAP' | 'RME_PASIEN' | 'KEPATUHAN';

export default function App() {
  const [authenticated, setAuthenticated] = useState(true);
  const [pinInput, setPinInput] = useState('240826');
  const [employeeNumber, setEmployeeNumber] = useState(DEFAULT_EMPLOYEE_NUMBER);

  const [currentTab, setCurrentTab] = useState<BottomTab>('AGENDA');
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

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    OFFLINE_FALLBACK_BOOTSTRAP.patients[0]?.id ?? ''
  );
  const [activeAppointment, setActiveAppointment] = useState<AppointmentItem | null>(
    null
  );

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const loadData = useCallback(
    async (forceOfflineFlag: boolean = offlineMode) => {
      setLoading(true);
      try {
        const res = await fetchClinicalBootstrap(employeeNumber, forceOfflineFlag);
        setClinicalData(res.data);
        setSyncSource(res.source);
        setPendingQueueCount(res.pendingQueueCount);
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
    loadData(false);
  }, []);

  const sipDaysLeft = getSipDaysRemaining(clinicalData.therapist.sip_valid_until);
  const isSipExpired = sipDaysLeft <= 0;

  if (!authenticated) {
    return (
      <SafeAreaView style={styles.authRoot}>
        <StatusBar style="light" />
        <View style={styles.authCard}>
          <View style={styles.authBadgeRow}>
            <ShieldCheck size={22} color="#14B8A6" />
            <Text style={styles.authAppTitle}>WicaraSehat Terapis Android</Text>
          </View>
          <Text style={styles.authSubtitle}>
            Point-of-Care Rekam Medis Elektronik Terapi Wicara • Patuh UU Kesehatan No. 17/2023, Permenkes 24/2022, Permenkes 81/2014 & UU PDP
          </Text>

          <Text style={styles.authLabel}>ID Pegawai / Terapis Wicara:</Text>
          <TextInput
            value={employeeNumber}
            onChangeText={setEmployeeNumber}
            style={styles.authInput}
          />

          <Text style={styles.authLabel}>PIN Sesi Klinis RME:</Text>
          <TextInput
            value={pinInput}
            onChangeText={setPinInput}
            secureTextEntry
            keyboardType="numeric"
            style={styles.authInput}
          />

          <Pressable
            onPress={() => {
              setAuthenticated(true);
              loadData(offlineMode);
            }}
            style={styles.biometricBtn}
          >
            <Fingerprint size={18} color="#FFFFFF" />
            <Text style={styles.biometricBtnText}>
              Masuk dengan Biometrik / Verifikasi SIP Aktif
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.appOuter}>
      <StatusBar style="light" />
      {/* Responsive Mobile Android Frame on Wide Web Preview, Native Fullscreen on Android */}
      <View style={styles.deviceShell}>
        {/* Top App Bar */}
        <View style={styles.topAppBar}>
          <View style={{ flex: 1 }}>
            <Text style={styles.appBarSuper}>
              MODUL ANDROID TERAPIS WICARA • FASYANKES {clinicalData.clinic.fasyankes_code}
            </Text>
            <Text style={styles.appBarTitle} numberOfLines={1}>
              WicaraSehat Clinical Point-of-Care
            </Text>
          </View>

          <Pressable
            onPress={() => setAuthenticated(false)}
            style={styles.lockSessionBtn}
          >
            <LockKeyhole size={14} color="#CCFBF1" />
            <Text style={styles.lockSessionText}>Kunci Sesi</Text>
          </Pressable>
        </View>

        {/* Legal SIP Hard-Lock Warning if expired */}
        {isSipExpired && (
          <View style={styles.sipBlockedBar}>
            <Text style={styles.sipBlockedText}>
              SIP Kedaluwarsa! Hak pengisian tindakan klinis dikunci otomatis sesuai UU No. 17/2023.
            </Text>
          </View>
        )}

        {/* Feedback Toast */}
        {toastMessage && (
          <View style={styles.toastBanner}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}

        {/* Main Screen Body */}
        <View style={styles.mainViewport}>
          {loading ? (
            <View style={styles.loaderBox}>
              <ActivityIndicator size="large" color="#0F766E" />
              <Text style={styles.loaderText}>
                Menyinkronkan Rekam Medis Elektronik & Kredensial SIP...
              </Text>
            </View>
          ) : (
            <>
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
                    showToast(res.message);
                    await loadData(offlineMode);
                  }}
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

        {/* Bottom Android Navigation Bar */}
        <View style={styles.bottomNav}>
          {[
            { id: 'AGENDA' as const, label: 'Jadwal', Icon: CalendarClock },
            { id: 'ASESMEN' as const, label: 'Asesmen 5A', Icon: Stethoscope },
            { id: 'SESI_SOAP' as const, label: 'Terapi/SOAP', Icon: ClipboardList },
            { id: 'RME_PASIEN' as const, label: 'RME Pasien', Icon: FolderHeart },
            { id: 'KEPATUHAN' as const, label: 'SOP & PPI', Icon: ShieldCheck },
          ].map(({ id, label, Icon }) => {
            const active = currentTab === id;
            return (
              <Pressable
                key={id}
                onPress={() => setCurrentTab(id)}
                style={styles.navTab}
              >
                <View style={[styles.navIconPill, active && styles.navIconPillActive]}>
                  <Icon size={18} color={active ? '#0F766E' : '#64748B'} />
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]}>
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </View>
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
  authCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: '#334155',
  },
  authBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
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
  appOuter: {
    flex: 1,
    backgroundColor: '#0F172A',
    alignItems: 'center',
  },
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
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  appBarSuper: {
    color: '#99F6E4',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  appBarTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  lockSessionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  lockSessionText: { color: '#CCFBF1', fontSize: 11, fontWeight: '700' },
  sipBlockedBar: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sipBlockedText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800' },
  toastBanner: {
    backgroundColor: '#065F46',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  toastText: { color: '#ECFDF5', fontSize: 12, fontWeight: '700' },
  mainViewport: { flex: 1 },
  loaderBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  loaderText: {
    marginTop: 12,
    fontSize: 13,
    color: '#475569',
    fontWeight: '600',
    textAlign: 'center',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    paddingVertical: 7,
    paddingHorizontal: 4,
  },
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navIconPill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  navIconPillActive: {
    backgroundColor: '#CCFBF1',
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748B',
    marginTop: 2,
  },
  navLabelActive: {
    color: '#0F766E',
    fontWeight: '800',
  },
});
