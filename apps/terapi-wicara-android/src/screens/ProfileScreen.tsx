import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Building2,
  CheckCircle2,
  Cloud,
  CloudOff,
  Fingerprint,
  KeyRound,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Trash2,
  User,
} from 'lucide-react-native';
import { BootstrapClinicalData } from '../types/clinical';
import { TherapistProfile, RecordStats } from '../services/localRecordStore';

interface ProfileScreenProps {
  profile: TherapistProfile;
  clinicalData: BootstrapClinicalData;
  stats: RecordStats;
  offlineMode: boolean;
  syncSource: 'CLOUD_SUPABASE_RME' | 'ENCRYPTED_LOCAL_CACHE';
  pendingQueueCount: number;
  onChangePin: (newPin: string) => void;
  onToggleBiometric: (enabled: boolean) => void;
  onRefreshSync: () => void;
  onToggleOffline: () => void;
  onClearLocalData: () => void;
  onLockSession: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  profile,
  clinicalData,
  stats,
  offlineMode,
  syncSource,
  pendingQueueCount,
  onChangePin,
  onToggleBiometric,
  onRefreshSync,
  onToggleOffline,
  onClearLocalData,
  onLockSession,
}) => {
  const [pinBaru, setPinBaru] = useState('');
  const [pinUlang, setPinUlang] = useState('');
  const [showPinForm, setShowPinForm] = useState(false);

  const simpanPin = () => {
    if (pinBaru.length < 6) {
      Alert.alert('PIN terlalu pendek', 'PIN klinis minimal 6 digit angka.');
      return;
    }
    if (!/^\d+$/.test(pinBaru)) {
      Alert.alert('PIN tidak valid', 'PIN hanya boleh berisi angka.');
      return;
    }
    if (pinBaru !== pinUlang) {
      Alert.alert('PIN tidak sama', 'Ulangi PIN dengan angka yang sama.');
      return;
    }
    onChangePin(pinBaru);
    setPinBaru('');
    setPinUlang('');
    setShowPinForm(false);
    Alert.alert('PIN tersimpan', 'PIN sesi klinis berhasil diperbarui pada perangkat ini.');
  };

  const { therapist, clinic } = clinicalData;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Kartu identitas terapis */}
      <View style={styles.idCard}>
        <View style={styles.avatar}>
          <User size={26} color="#FFFFFF" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.name}>{profile.full_name}</Text>
          <Text style={styles.degree}>{profile.degree_title}</Text>
          <Text style={styles.nip}>NIP {profile.employee_number}</Text>
        </View>
      </View>

      {/* Kredensial legal */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Kredensial & Legalitas</Text>

        <Row label="Nomor STR" value={therapist.str_number} note="Berlaku seumur hidup (UU 17/2023)" />
        <Row
          label="Nomor SIP"
          value={therapist.sip_number}
          note={`Berlaku s.d. ${new Date(therapist.sip_valid_until).toLocaleDateString('id-ID')}`}
        />
        <Row label="IHS Practitioner ID" value={therapist.ihs_practitioner_id || '—'} note="SATUSEHAT FHIR" />
        <Row label="Anggota IKATWI" value={therapist.ikatwi_member_number || '—'} />
        <Row
          label="SKP Kolegium"
          value={`${therapist.skp_points_earned} / ${therapist.skp_points_target}`}
          note="Target pemantauan kolegium"
        />

        <View style={styles.orgBox}>
          <Building2 size={14} color="#0F766E" />
          <View style={{ flex: 1 }}>
            <Text style={styles.orgName}>{clinic.name}</Text>
            <Text style={styles.orgMeta}>
              {clinic.city}, {clinic.province} • Fasyankes {clinic.fasyankes_code}
            </Text>
            <Text style={styles.orgMeta}>Akreditasi: {clinic.accreditation_status}</Text>
          </View>
        </View>
      </View>

      {/* Keamanan sesi */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Keamanan Sesi Klinis</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Fingerprint size={15} color="#0F766E" />
            <View>
              <Text style={styles.switchTitle}>Masuk dengan Biometrik</Text>
              <Text style={styles.switchHint}>Sidik jari / wajah untuk membuka kunci RME</Text>
            </View>
          </View>
          <Switch
            value={profile.biometric_enabled}
            onValueChange={onToggleBiometric}
            trackColor={{ false: '#CBD5E1', true: '#5EEAD4' }}
            thumbColor={profile.biometric_enabled ? '#0F766E' : '#F1F5F9'}
          />
        </View>

        {!showPinForm ? (
          <Pressable style={styles.actionRow} onPress={() => setShowPinForm(true)}>
            <KeyRound size={15} color="#0F766E" />
            <Text style={styles.actionLabel}>Ubah PIN Sesi Klinis</Text>
            <Text style={styles.actionChevron}>›</Text>
          </Pressable>
        ) : (
          <View style={styles.pinForm}>
            <Text style={styles.pinLabel}>PIN Baru (minimal 6 digit)</Text>
            <TextInput
              value={pinBaru}
              onChangeText={setPinBaru}
              keyboardType="numeric"
              secureTextEntry
              maxLength={8}
              style={styles.pinInput}
              placeholder="••••••"
              placeholderTextColor="#94A3B8"
            />
            <Text style={styles.pinLabel}>Ulangi PIN Baru</Text>
            <TextInput
              value={pinUlang}
              onChangeText={setPinUlang}
              keyboardType="numeric"
              secureTextEntry
              maxLength={8}
              style={styles.pinInput}
              placeholder="••••••"
              placeholderTextColor="#94A3B8"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <Pressable
                style={[styles.pinBtn, styles.pinBtnGhost]}
                onPress={() => {
                  setShowPinForm(false);
                  setPinBaru('');
                  setPinUlang('');
                }}
              >
                <Text style={styles.pinBtnGhostText}>Batal</Text>
              </Pressable>
              <Pressable style={[styles.pinBtn, styles.pinBtnPrimary]} onPress={simpanPin}>
                <Text style={styles.pinBtnPrimaryText}>Simpan PIN</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Pressable style={styles.actionRow} onPress={onLockSession}>
          <Lock size={15} color="#B45309" />
          <Text style={[styles.actionLabel, { color: '#B45309' }]}>Kunci Sesi Sekarang</Text>
          <LogOut size={13} color="#B45309" />
        </Pressable>
      </View>

      {/* Sinkronisasi */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sinkronisasi Rekam Medis</Text>

        <View style={styles.syncStats}>
          <View style={styles.syncStat}>
            <CheckCircle2 size={15} color="#059669" />
            <Text style={styles.syncValue}>{stats.synced}</Text>
            <Text style={styles.syncLabel}>Terkirim</Text>
          </View>
          <View style={styles.syncStat}>
            <CloudOff size={15} color="#B45309" />
            <Text style={[styles.syncValue, { color: '#B45309' }]}>{stats.pending}</Text>
            <Text style={styles.syncLabel}>Antrean</Text>
          </View>
          <View style={styles.syncStat}>
            <Smartphone size={15} color="#0F766E" />
            <Text style={styles.syncValue}>{stats.total}</Text>
            <Text style={styles.syncLabel}>Di Perangkat</Text>
          </View>
        </View>

        <View style={styles.modeBox}>
          {offlineMode ? <CloudOff size={14} color="#92400E" /> : <Cloud size={14} color="#065F46" />}
          <View style={{ flex: 1 }}>
            <Text style={styles.modeTitle}>
              {offlineMode ? 'Mode Ruang Kedap Suara (Offline)' : 'Mode Sinkronisasi Cloud'}
            </Text>
            <Text style={styles.modeHint}>
              {offlineMode
                ? 'Catatan disimpan lokal dan dikirim saat online kembali.'
                : syncSource === 'CLOUD_SUPABASE_RME'
                ? 'Terhubung ke Supabase RME (fawmudsaaotlqyryciwd).'
                : 'Memakai cache terenkripsi lokal.'}
            </Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Pressable style={[styles.miniBtn, { flex: 1 }]} onPress={onToggleOffline}>
            {offlineMode ? <Cloud size={13} color="#0F766E" /> : <CloudOff size={13} color="#0F766E" />}
            <Text style={styles.miniBtnText}>{offlineMode ? 'Aktifkan Cloud' : 'Mode Offline'}</Text>
          </Pressable>
          <Pressable style={[styles.miniBtn, { flex: 1 }]} onPress={onRefreshSync}>
            <RefreshCw size={13} color="#0F766E" />
            <Text style={styles.miniBtnText}>Tarik Data</Text>
          </Pressable>
        </View>

        {pendingQueueCount > 0 && (
          <Text style={styles.queueNote}>
            {pendingQueueCount} entri menunggu antrean. Akan terkirim otomatis saat perangkat online.
          </Text>
        )}
      </View>

      {/* Data & privasi */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Data & Privasi (UU PDP 27/2022)</Text>
        <View style={styles.privacyBox}>
          <ShieldCheck size={15} color="#0F766E" />
          <Text style={styles.privacyText}>
            Seluruh catatan klinis pada perangkat ini disimpan lokal dan hanya dikirim ke server RME
            klinik melalui koneksi terenkripsi. NIK pasien ditampilkan tersamar. Setiap akses tercatat
            pada jejak audit yang tidak dapat dihapus.
          </Text>
        </View>

        <Pressable
          style={styles.dangerRow}
          onPress={() =>
            Alert.alert(
              'Hapus seluruh data lokal?',
              'Semua catatan yang BELUM terkirim akan hilang permanen. Catatan yang sudah terkirim tetap tersimpan di server RME. Lanjutkan?',
              [
                { text: 'Batal', style: 'cancel' },
                { text: 'Hapus Semua', style: 'destructive', onPress: onClearLocalData },
              ]
            )
          }
        >
          <Trash2 size={14} color="#B91C1C" />
          <Text style={styles.dangerText}>Hapus Seluruh Data Lokal</Text>
        </Pressable>
      </View>

      <Text style={styles.version}>
        WicaraSehat Terapis v1.0.0 • build rme-offline-first{'\n'}
        UU 17/2023 • Permenkes 24/2022 • Permenkes 81/2014 • Permenkes 34/2022 • UU PDP 27/2022
      </Text>
    </ScrollView>
  );
};

const Row: React.FC<{ label: string; value: string; note?: string }> = ({ label, value, note }) => (
  <View style={styles.row}>
    <View style={{ flex: 1 }}>
      <Text style={styles.rowLabel}>{label}</Text>
      {!!note && <Text style={styles.rowNote}>{note}</Text>}
    </View>
    <Text style={styles.rowValue} numberOfLines={1}>
      {value}
    </Text>
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 14, gap: 12, paddingBottom: 30 },

  idCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#115E59',
    borderRadius: 16,
    padding: 15,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' },
  degree: { color: '#CCFBF1', fontSize: 11, marginTop: 1 },
  nip: { color: '#99F6E4', fontSize: 10.5, marginTop: 2, fontWeight: '700' },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 14,
  },
  cardTitle: { fontSize: 13, fontWeight: '800', color: '#0F172A', marginBottom: 10 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 7,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowLabel: { fontSize: 11.5, color: '#334155', fontWeight: '700' },
  rowNote: { fontSize: 9.5, color: '#94A3B8', marginTop: 1 },
  rowValue: { fontSize: 11, color: '#0F766E', fontWeight: '800', maxWidth: '48%' },

  orgBox: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 11,
    marginTop: 10,
  },
  orgName: { fontSize: 11.5, fontWeight: '800', color: '#0F172A' },
  orgMeta: { fontSize: 10, color: '#475569', marginTop: 1 },

  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
  },
  switchLabel: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  switchTitle: { fontSize: 11.5, fontWeight: '700', color: '#0F172A' },
  switchHint: { fontSize: 9.5, color: '#94A3B8', marginTop: 1 },

  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
    paddingVertical: 11,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  actionLabel: { flex: 1, fontSize: 11.5, fontWeight: '700', color: '#0F172A' },
  actionChevron: { fontSize: 16, color: '#94A3B8' },

  pinForm: { paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  pinLabel: { fontSize: 10.5, fontWeight: '700', color: '#475569', marginBottom: 4, marginTop: 6 },
  pinInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontSize: 14,
    letterSpacing: 4,
    color: '#0F172A',
  },
  pinBtn: { flex: 1, paddingVertical: 10, borderRadius: 9, alignItems: 'center' },
  pinBtnGhost: { backgroundColor: '#F1F5F9' },
  pinBtnGhostText: { fontSize: 11.5, fontWeight: '800', color: '#475569' },
  pinBtnPrimary: { backgroundColor: '#0F766E' },
  pinBtnPrimaryText: { fontSize: 11.5, fontWeight: '800', color: '#FFFFFF' },

  syncStats: { flexDirection: 'row', gap: 8 },
  syncStat: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingVertical: 10,
    gap: 2,
  },
  syncValue: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  syncLabel: { fontSize: 9, color: '#64748B', fontWeight: '700' },

  modeBox: {
    flexDirection: 'row',
    gap: 9,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 11,
    marginTop: 10,
  },
  modeTitle: { fontSize: 11.5, fontWeight: '800', color: '#0F172A' },
  modeHint: { fontSize: 9.5, color: '#64748B', marginTop: 1, lineHeight: 14 },

  miniBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 9,
    paddingVertical: 9,
  },
  miniBtnText: { fontSize: 10.5, fontWeight: '800', color: '#0F766E' },
  queueNote: { fontSize: 9.5, color: '#B45309', marginTop: 8, fontWeight: '600' },

  privacyBox: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 11,
  },
  privacyText: { flex: 1, fontSize: 10, color: '#115E59', lineHeight: 15 },

  dangerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 9,
    paddingVertical: 11,
    paddingHorizontal: 11,
  },
  dangerText: { fontSize: 11.5, fontWeight: '800', color: '#B91C1C' },

  version: {
    fontSize: 9.5,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 15,
    marginTop: 6,
  },
});
