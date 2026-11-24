import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  AlertTriangle,
  Award,
  CheckCircle2,
  Clock,
  FileSignature,
  Play,
  RefreshCw,
  ShieldCheck,
  Volume2,
} from 'lucide-react-native';
import {
  AppointmentItem,
  ClinicProfile,
  PatientRecord,
  TherapistCredential,
  TherapyRoom,
} from '../types/clinical';
import {
  calculateAgeLabel,
  formatDomainLabel,
  formatTimeRange,
  getSipDaysRemaining,
} from '../utils/clinicalFormatters';

interface AgendaScreenProps {
  clinic: ClinicProfile;
  therapist: TherapistCredential;
  rooms: TherapyRoom[];
  appointments: AppointmentItem[];
  patients: PatientRecord[];
  syncSource: 'CLOUD_SUPABASE_RME' | 'ENCRYPTED_LOCAL_CACHE';
  pendingQueueCount: number;
  offlineMode: boolean;
  onToggleOffline: () => void;
  onRefreshSync: () => void;
  onStartSession: (appt: AppointmentItem) => void;
  onOpenAssessment: (patientId: string) => void;
}

export const AgendaScreen: React.FC<AgendaScreenProps> = ({
  clinic,
  therapist,
  rooms,
  appointments,
  syncSource,
  pendingQueueCount,
  offlineMode,
  onToggleOffline,
  onRefreshSync,
  onStartSession,
  onOpenAssessment,
}) => {
  const sipDaysLeft = getSipDaysRemaining(therapist.sip_valid_until);
  const skpProgress = Math.min(
    100,
    Math.round((therapist.skp_points_earned / Math.max(1, therapist.skp_points_target)) * 100)
  );

  const completedCount = appointments.filter((a) => a.status === 'SELESAI_SOAP_LOCKED').length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Credential & SIP Dinkes Compliance Banner */}
      <View style={styles.credentialCard}>
        <View style={styles.credentialTopRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.clinicBadge}>{clinic.name}</Text>
            <Text style={styles.therapistName}>{therapist.full_name}</Text>
            <Text style={styles.licenseText}>SIP: {therapist.sip_number}</Text>
            <Text style={styles.licenseSubText}>
              STR Seumur Hidup (UU 17/2023): {therapist.str_number}
            </Text>
          </View>
          <View
            style={[
              styles.sipPill,
              sipDaysLeft > 90 ? styles.sipPillSafe : styles.sipPillWarn,
            ]}
          >
            <ShieldCheck size={14} color={sipDaysLeft > 90 ? '#065F46' : '#92400E'} />
            <Text
              style={[
                styles.sipPillText,
                { color: sipDaysLeft > 90 ? '#065F46' : '#92400E' },
              ]}
            >
              {sipDaysLeft > 0 ? `SIP Aktif (${sipDaysLeft} hr)` : 'SIP Kedaluwarsa'}
            </Text>
          </View>
        </View>

        {/* SKP Kemenkes Progress + Sync Controls */}
        <View style={styles.skpBox}>
          <View style={styles.skpHeader}>
            <View style={styles.rowCenter}>
              <Award size={14} color="#CCFBF1" />
              <Text style={styles.skpLabel}>
                Kecukupan SKP Kemenkes: {therapist.skp_points_earned} / {therapist.skp_points_target} SKP ({skpProgress}%)
              </Text>
            </View>
            <Text style={styles.privilegeTag}>{therapist.clinical_privilege_level.replace(/_/g, ' ')}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${skpProgress}%` }]} />
          </View>
        </View>

        <View style={styles.syncToolbar}>
          <Pressable
            onPress={onToggleOffline}
            style={[styles.modeChip, offlineMode ? styles.modeChipOffline : styles.modeChipOnline]}
          >
            <Text style={styles.modeChipText}>
              {offlineMode
                ? 'Mode Ruang Kedap Suara (Offline Queue)'
                : syncSource === 'CLOUD_SUPABASE_RME'
                ? 'Terhubung Cloud RME & SATUSEHAT'
                : 'Mode Cache Lokal Terenkripsi'}
            </Text>
          </Pressable>

          <Pressable onPress={onRefreshSync} style={styles.syncButton}>
            <RefreshCw size={14} color="#0F766E" />
            <Text style={styles.syncButtonText}>
              Sync {pendingQueueCount > 0 ? `(${pendingQueueCount})` : ''}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Quick KPI Metrics */}
      <View style={styles.metricsRow}>
        <View style={styles.metricCard}>
          <Text style={styles.metricValue}>{appointments.length}</Text>
          <Text style={styles.metricLabel}>Jadwal Hari Ini</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: '#059669' }]}>{completedCount}</Text>
          <Text style={styles.metricLabel}>SOAP Terkunci TTE</Text>
        </View>
        <View style={styles.metricCard}>
          <Text style={[styles.metricValue, { color: '#0284C7' }]}>{rooms.length}</Text>
          <Text style={styles.metricLabel}>Ruang Steril (&lt;35dB)</Text>
        </View>
      </View>

      {/* Acoustic & PPI Room Readiness (Permenkes 14/2021) */}
      <Text style={styles.sectionTitle}>Kesiapan Ruang Terapi & Standar Akustik Dinkes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomsScroll}>
        {rooms.map((rm) => (
          <View key={rm.id} style={styles.roomChipCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.roomCode}>{rm.room_code}</Text>
              <View style={styles.sterilBadge}>
                <Text style={styles.sterilBadgeText}>{rm.sterilization_status}</Text>
              </View>
            </View>
            <Text style={styles.roomName} numberOfLines={1}>
              {rm.room_name}
            </Text>
            <View style={styles.roomSpecsRow}>
              <Volume2 size={13} color="#0F766E" />
              <Text style={styles.roomSpecText}>
                Kebisingan {rm.ambient_noise_db} dB • Cermin & One-Way Mirror
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>

      {/* Daily Patient Worklist */}
      <Text style={styles.sectionTitle}>Antrean Asuhan Terapi Wicara Hari Ini</Text>
      {appointments.map((appt) => {
        const isHighRisk = appt.aspiration_risk_level === 'TINGGI';
        const isDone = appt.status === 'SELESAI_SOAP_LOCKED';
        return (
          <View
            key={appt.id}
            style={[
              styles.apptCard,
              isHighRisk && styles.apptCardHighRisk,
              isDone && styles.apptCardDone,
            ]}
          >
            <View style={styles.rowBetween}>
              <View style={styles.rowCenter}>
                <Clock size={14} color="#475569" />
                <Text style={styles.apptTime}>
                  {formatTimeRange(appt.scheduled_start, appt.scheduled_end)}
                </Text>
              </View>
              <View
                style={[
                  styles.statusBadge,
                  isDone
                    ? { backgroundColor: '#DCFCE7' }
                    : appt.status === 'SEDANG_TERAPI'
                    ? { backgroundColor: '#FEF3C7' }
                    : { backgroundColor: '#E0F2FE' },
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    isDone
                      ? { color: '#166534' }
                      : appt.status === 'SEDANG_TERAPI'
                      ? { color: '#92400E' }
                      : { color: '#075985' },
                  ]}
                >
                  {appt.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>

            <Text style={styles.patientName}>{appt.patient_name}</Text>
            <Text style={styles.patientMeta}>
              {appt.medical_record_number} • Usia {calculateAgeLabel(appt.birth_date)} • Sesi ke-{appt.session_number}
            </Text>

            <View style={styles.domainRow}>
              <View style={styles.domainPill}>
                <Text style={styles.domainPillText}>{formatDomainLabel(appt.disorder_focus)}</Text>
              </View>
              <View style={styles.visitPill}>
                <Text style={styles.visitPillText}>{appt.visit_type.replace(/_/g, ' ')}</Text>
              </View>
              {appt.satusehat_sync_status === 'SYNCED' && (
                <View style={styles.ssPill}>
                  <CheckCircle2 size={12} color="#047857" />
                  <Text style={styles.ssPillText}>SATUSEHAT</Text>
                </View>
              )}
            </View>

            {/* Clinical Safety Alerts (SKP Akreditasi) */}
            {(isHighRisk || (appt.clinical_alerts && appt.clinical_alerts.length > 0)) && (
              <View style={[styles.alertBanner, isHighRisk && styles.alertBannerCritical]}>
                <AlertTriangle size={15} color={isHighRisk ? '#B91C1C' : '#B45309'} />
                <View style={{ flex: 1 }}>
                  {isHighRisk && (
                    <Text style={styles.alertCriticalTitle}>
                      PERINGATAN DISFAGIA: RISIKO ASPIRASI TINGGI (Wajib Oximeter & SOP IDDSI)
                    </Text>
                  )}
                  {appt.clinical_alerts?.map((al, idx) => (
                    <Text key={idx} style={styles.alertItemText}>
                      • {al}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            <View style={styles.cardActions}>
              <Pressable
                style={styles.secondaryActionBtn}
                onPress={() => onOpenAssessment(appt.patient_id)}
              >
                <FileSignature size={15} color="#0F766E" />
                <Text style={styles.secondaryActionText}>Instrumen Asesmen</Text>
              </Pressable>

              <Pressable
                style={[styles.primaryActionBtn, isDone && { backgroundColor: '#475569' }]}
                onPress={() => onStartSession(appt)}
              >
                <Play size={15} color="#FFFFFF" />
                <Text style={styles.primaryActionText}>
                  {isDone ? 'Lihat / Addendum SOAP' : 'Mulai Terapi & SOAP'}
                </Text>
              </Pressable>
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingBottom: 32 },
  credentialCard: {
    backgroundColor: '#0F766E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
  },
  credentialTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  clinicBadge: {
    color: '#99F6E4',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  therapistName: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '800',
  },
  licenseText: {
    color: '#E6FFFA',
    fontSize: 12,
    marginTop: 2,
    fontWeight: '600',
  },
  licenseSubText: {
    color: '#CCFBF1',
    fontSize: 11,
    marginTop: 1,
  },
  sipPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  sipPillSafe: { backgroundColor: '#D1FAE5' },
  sipPillWarn: { backgroundColor: '#FEF3C7' },
  sipPillText: { fontSize: 11, fontWeight: '700' },
  skpBox: {
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 10,
  },
  skpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
    marginBottom: 6,
  },
  skpLabel: { color: '#F0FDFA', fontSize: 11, fontWeight: '600' },
  privilegeTag: {
    color: '#FEF08A',
    fontSize: 10,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#34D399',
    borderRadius: 999,
  },
  syncToolbar: {
    marginTop: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  modeChip: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  modeChipOnline: { backgroundColor: 'rgba(16, 185, 129, 0.28)' },
  modeChipOffline: { backgroundColor: '#B45309' },
  modeChipText: { color: '#FFFFFF', fontSize: 11, fontWeight: '700' },
  syncButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  syncButtonText: { color: '#0F766E', fontSize: 12, fontWeight: '700' },
  metricsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricValue: { fontSize: 22, fontWeight: '800', color: '#0F172A' },
  metricLabel: { fontSize: 11, color: '#64748B', marginTop: 2, textAlign: 'center' },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 4,
  },
  roomsScroll: { marginBottom: 16 },
  roomChipCard: {
    width: 265,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  roomCode: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  sterilBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sterilBadgeText: { fontSize: 10, fontWeight: '700', color: '#166534' },
  roomName: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginTop: 4 },
  roomSpecsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 6,
  },
  roomSpecText: { fontSize: 11, color: '#64748B' },
  apptCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  apptCardHighRisk: {
    borderColor: '#FCA5A5',
    borderWidth: 1.5,
  },
  apptCardDone: {
    opacity: 0.92,
    backgroundColor: '#F8FAFC',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  apptTime: { fontSize: 12, fontWeight: '700', color: '#334155' },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 999,
  },
  statusBadgeText: { fontSize: 10, fontWeight: '800' },
  patientName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 8,
  },
  patientMeta: { fontSize: 12, color: '#64748B', marginTop: 2 },
  domainRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  domainPill: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  domainPillText: { fontSize: 11, fontWeight: '700', color: '#115E59' },
  visitPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  visitPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  ssPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#ECFDF5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  ssPillText: { fontSize: 10, fontWeight: '700', color: '#047857' },
  alertBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFFBEB',
    borderRadius: 8,
    padding: 9,
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  alertBannerCritical: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  alertCriticalTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991B1B',
    marginBottom: 2,
  },
  alertItemText: { fontSize: 11, color: '#78350F' },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#0F766E',
    backgroundColor: '#F0FDFA',
  },
  secondaryActionText: { fontSize: 12, fontWeight: '700', color: '#0F766E' },
  primaryActionBtn: {
    flex: 1.25,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#0F766E',
  },
  primaryActionText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
});
