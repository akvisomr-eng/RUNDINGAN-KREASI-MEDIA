import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  Activity,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Cloud,
  CloudOff,
  FileText,
  FolderHeart,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
} from 'lucide-react-native';
import {
  AppointmentItem,
  BootstrapClinicalData,
  PatientRecord,
} from '../types/clinical';
import { LocalClinicalRecord, RecordStats } from '../services/localRecordStore';
import { formatTimeRange, getSipDaysRemaining } from '../utils/clinicalFormatters';

interface DashboardScreenProps {
  clinicalData: BootstrapClinicalData;
  records: LocalClinicalRecord[];
  stats: RecordStats;
  syncSource: 'CLOUD_SUPABASE_RME' | 'ENCRYPTED_LOCAL_CACHE';
  offlineMode: boolean;
  pendingQueueCount: number;
  onOpenAgenda: () => void;
  onOpenHistory: () => void;
  onStartSession: (appt: AppointmentItem) => void;
  onOpenAssess: (patientId: string) => void;
  onOpenPatients: () => void;
  onOpenCompliance: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  clinicalData,
  records,
  stats,
  syncSource,
  offlineMode,
  pendingQueueCount,
  onOpenAgenda,
  onOpenHistory,
  onStartSession,
  onOpenAssess,
  onOpenPatients,
  onOpenCompliance,
}) => {
  const { therapist, clinic, appointments, patients, care_plans } = clinicalData;

  const sipDaysLeft = getSipDaysRemaining(therapist.sip_valid_until);
  const sipCritical = sipDaysLeft <= 30;

  const todayAppointments = useMemo(() => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const todays = appointments.filter((a) =>
      String(a.scheduled_start).slice(0, 10) === todayKey
    );
    return todays.length ? todays : appointments.slice(0, 4);
  }, [appointments]);

  const nextSession = todayAppointments[0];
  const activePatients = useMemo(
    () => care_plans.filter((cp) => cp.status === 'AKTIF').length || patients.length,
    [care_plans, patients]
  );

  const skpPercent = Math.min(
    100,
    Math.round((therapist.skp_points_earned / Math.max(1, therapist.skp_points_target)) * 100)
  );

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 11) return 'Selamat pagi';
    if (h < 15) return 'Selamat siang';
    if (h < 18) return 'Selamat sore';
    return 'Selamat malam';
  })();

  const recentRecords = records.slice(0, 3);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Kartu sapaan terapis */}
      <View style={styles.heroCard}>
        <Text style={styles.heroGreeting}>{greeting},</Text>
        <Text style={styles.heroName}>{therapist.full_name}</Text>
        <Text style={styles.heroMeta}>
          {therapist.employee_number} • {clinic.name}
        </Text>

        <View style={styles.heroChips}>
          <View style={[styles.chip, offlineMode ? styles.chipWarn : styles.chipOk]}>
            {offlineMode ? <CloudOff size={11} color="#92400E" /> : <Cloud size={11} color="#065F46" />}
            <Text style={[styles.chipText, offlineMode ? styles.chipTextWarn : styles.chipTextOk]}>
              {offlineMode ? 'Offline-First' : syncSource === 'CLOUD_SUPABASE_RME' ? 'Tersinkron Cloud' : 'Cache Lokal'}
            </Text>
          </View>
          <View style={[styles.chip, sipCritical ? styles.chipWarn : styles.chipOk]}>
            <ShieldCheck size={11} color={sipCritical ? '#92400E' : '#065F46'} />
            <Text style={[styles.chipText, sipCritical ? styles.chipTextWarn : styles.chipTextOk]}>
              SIP {sipDaysLeft > 0 ? `${sipDaysLeft} hari` : 'KEDALUWARSA'}
            </Text>
          </View>
          {pendingQueueCount > 0 && (
            <View style={[styles.chip, styles.chipWarn]}>
              <AlertTriangle size={11} color="#92400E" />
              <Text style={[styles.chipText, styles.chipTextWarn]}>{pendingQueueCount} antrean</Text>
            </View>
          )}
        </View>
      </View>

      {/* Ringkasan angka */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <CalendarClock size={16} color="#0F766E" />
          <Text style={styles.statValue}>{todayAppointments.length}</Text>
          <Text style={styles.statLabel}>Sesi Hari Ini</Text>
        </View>
        <View style={styles.statCard}>
          <Users size={16} color="#0F766E" />
          <Text style={styles.statValue}>{activePatients}</Text>
          <Text style={styles.statLabel}>Pasien Aktif</Text>
        </View>
        <View style={styles.statCard}>
          <FileText size={16} color="#0F766E" />
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Catatan Saya</Text>
        </View>
        <View style={styles.statCard}>
          <Activity size={16} color={stats.pending > 0 ? '#B45309' : '#0F766E'} />
          <Text style={[styles.statValue, stats.pending > 0 && { color: '#B45309' }]}>
            {stats.pending}
          </Text>
          <Text style={styles.statLabel}>Belum Sinkron</Text>
        </View>
      </View>

      {/* Sesi berikutnya */}
      {nextSession ? (
        <View style={styles.nextCard}>
          <View style={styles.nextHeader}>
            <Text style={styles.sectionTitle}>Sesi Berikutnya</Text>
            <Pressable onPress={onOpenAgenda} hitSlop={8}>
              <Text style={styles.linkText}>Lihat Agenda</Text>
            </Pressable>
          </View>

          <View style={styles.nextBody}>
            <View style={styles.timeBadge}>
              <Text style={styles.timeBadgeText}>
                {String(nextSession.scheduled_start).slice(11, 16)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.nextPatient}>{nextSession.patient_name}</Text>
              <Text style={styles.nextMeta}>
                {nextSession.medical_record_number} • Sesi ke-{nextSession.session_number}
              </Text>
              <Text style={styles.nextMeta}>
                {formatTimeRange(nextSession.scheduled_start, nextSession.scheduled_end)} •{' '}
                {nextSession.room_name ?? 'Ruang terapi'}
              </Text>
            </View>
          </View>

          <View style={styles.nextActions}>
            <Pressable style={styles.primaryBtn} onPress={() => onStartSession(nextSession)}>
              <Stethoscope size={15} color="#FFFFFF" />
              <Text style={styles.primaryBtnText}>Mulai Sesi Terapi</Text>
            </Pressable>
            <Pressable
              style={styles.secondaryBtn}
              onPress={() => onOpenAssess(nextSession.patient_id)}
            >
              <ClipboardList size={15} color="#0F766E" />
              <Text style={styles.secondaryBtnText}>Asesmen</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <CalendarClock size={22} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Belum ada jadwal sesi</Text>
          <Text style={styles.emptyText}>
            Jadwal akan muncul otomatis setelah admisi klinik menjadwalkan pasien melalui SIMKLINIK.
          </Text>
        </View>
      )}

      {/* Aksi cepat */}
      <Text style={styles.sectionTitle}>Aksi Cepat</Text>
      <View style={styles.quickGrid}>
        <Pressable style={styles.quickCard} onPress={onOpenAgenda}>
          <View style={styles.quickIcon}>
            <CalendarClock size={18} color="#0F766E" />
          </View>
          <Text style={styles.quickLabel}>Agenda</Text>
          <Text style={styles.quickHint}>Jadwal & ruang</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={onOpenPatients}>
          <View style={styles.quickIcon}>
            <FolderHeart size={18} color="#0F766E" />
          </View>
          <Text style={styles.quickLabel}>RME Pasien</Text>
          <Text style={styles.quickHint}>Riwayat klinis</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={onOpenHistory}>
          <View style={styles.quickIcon}>
            <FileText size={18} color="#0F766E" />
          </View>
          <Text style={styles.quickLabel}>Riwayat Saya</Text>
          <Text style={styles.quickHint}>{stats.total} catatan</Text>
        </Pressable>
        <Pressable style={styles.quickCard} onPress={onOpenCompliance}>
          <View style={styles.quickIcon}>
            <ShieldCheck size={18} color="#0F766E" />
          </View>
          <Text style={styles.quickLabel}>SOP & PPI</Text>
          <Text style={styles.quickHint}>Kepatuhan</Text>
        </Pressable>
      </View>

      {/* Kredensial & SKP */}
      <View style={styles.credCard}>
        <View style={styles.credRow}>
          <TrendingUp size={15} color="#0F766E" />
          <Text style={styles.credTitle}>Capaian SKP Kolegium</Text>
          <Text style={styles.credValue}>
            {therapist.skp_points_earned}/{therapist.skp_points_target}
          </Text>
        </View>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${skpPercent}%` }]} />
        </View>
        <Text style={styles.credHint}>
          STR: {therapist.str_number} • SIP berlaku s.d.{' '}
          {new Date(therapist.sip_valid_until).toLocaleDateString('id-ID')}
        </Text>
      </View>

      {/* Catatan terakhir */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Catatan Terakhir</Text>
        <Pressable onPress={onOpenHistory} hitSlop={8}>
          <Text style={styles.linkText}>Semua</Text>
        </Pressable>
      </View>

      {recentRecords.length === 0 ? (
        <View style={styles.emptyCard}>
          <FileText size={20} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Belum ada catatan</Text>
          <Text style={styles.emptyText}>
            Catatan SOAP, asesmen, dan log PPI yang Anda simpan akan tampil di sini.
          </Text>
        </View>
      ) : (
        recentRecords.map((rec) => (
          <View key={rec.id} style={styles.recordRow}>
            <View style={styles.recordIcon}>
              {rec.synced ? (
                <CheckCircle2 size={15} color="#059669" />
              ) : (
                <CloudOff size={15} color="#B45309" />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.recordTitle} numberOfLines={1}>
                {rec.title}
              </Text>
              <Text style={styles.recordMeta} numberOfLines={1}>
                {rec.patient_name || 'Pasien'} •{' '}
                {new Date(rec.created_at).toLocaleString('id-ID', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            </View>
            <View style={[styles.kindPill, rec.synced ? styles.kindPillOk : styles.kindPillWarn]}>
              <Text style={[styles.kindPillText, rec.synced ? styles.kindTextOk : styles.kindTextWarn]}>
                {rec.synced ? 'TERKIRIM' : 'ANTREAN'}
              </Text>
            </View>
          </View>
        ))
      )}

      <Text style={styles.footer}>
        WicaraSehat Terapis • Patuh UU 17/2023, Permenkes 24/2022, Permenkes 81/2014 & UU PDP 27/2022
      </Text>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 14, paddingBottom: 28, gap: 12 },

  heroCard: {
    backgroundColor: '#115E59',
    borderRadius: 16,
    padding: 16,
  },
  heroGreeting: { color: '#99F6E4', fontSize: 12, fontWeight: '700' },
  heroName: { color: '#FFFFFF', fontSize: 18, fontWeight: '800', marginTop: 2 },
  heroMeta: { color: '#CCFBF1', fontSize: 11, marginTop: 3 },
  heroChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  chipOk: { backgroundColor: '#D1FAE5' },
  chipWarn: { backgroundColor: '#FEF3C7' },
  chipText: { fontSize: 10, fontWeight: '800' },
  chipTextOk: { color: '#065F46' },
  chipTextWarn: { color: '#92400E' },

  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statValue: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginTop: 6 },
  statLabel: { fontSize: 10.5, color: '#64748B', fontWeight: '700', marginTop: 1 },

  sectionTitle: { fontSize: 13.5, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  linkText: { fontSize: 11.5, fontWeight: '800', color: '#0F766E' },

  nextCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 10,
  },
  nextHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  nextBody: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  timeBadge: {
    backgroundColor: '#CCFBF1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  timeBadgeText: { color: '#0F766E', fontWeight: '800', fontSize: 13 },
  nextPatient: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  nextMeta: { fontSize: 11, color: '#64748B', marginTop: 1 },
  nextActions: { flexDirection: 'row', gap: 8 },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  primaryBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 12.5 },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#F0FDFA',
    borderWidth: 1,
    borderColor: '#99F6E4',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  secondaryBtnText: { color: '#0F766E', fontWeight: '800', fontSize: 12.5 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  quickIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: '#F0FDFA',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 7,
  },
  quickLabel: { fontSize: 12.5, fontWeight: '800', color: '#0F172A' },
  quickHint: { fontSize: 10, color: '#64748B', marginTop: 1 },

  credCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 8,
  },
  credRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  credTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: '#0F172A' },
  credValue: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  progressTrack: { height: 7, backgroundColor: '#E2E8F0', borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#0F766E', borderRadius: 999 },
  credHint: { fontSize: 10, color: '#64748B' },

  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 11,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recordIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recordTitle: { fontSize: 12.5, fontWeight: '700', color: '#0F172A' },
  recordMeta: { fontSize: 10.5, color: '#64748B', marginTop: 1 },
  kindPill: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
  kindPillOk: { backgroundColor: '#D1FAE5' },
  kindPillWarn: { backgroundColor: '#FEF3C7' },
  kindPillText: { fontSize: 8.5, fontWeight: '900' },
  kindTextOk: { color: '#065F46' },
  kindTextWarn: { color: '#92400E' },

  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderStyle: 'dashed',
    padding: 20,
    alignItems: 'center',
    gap: 6,
  },
  emptyTitle: { fontSize: 12.5, fontWeight: '800', color: '#334155' },
  emptyText: { fontSize: 11, color: '#64748B', textAlign: 'center', lineHeight: 16 },

  footer: { fontSize: 9.5, color: '#94A3B8', textAlign: 'center', marginTop: 10, lineHeight: 14 },
});
