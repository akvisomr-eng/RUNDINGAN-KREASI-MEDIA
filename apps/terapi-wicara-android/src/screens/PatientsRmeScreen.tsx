import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertCircle,
  Ear,
  FileText,
  Network,
  Phone,
  Send,
  ShieldCheck,
  Stethoscope,
  UserCheck,
} from 'lucide-react-native';
import {
  CarePlan,
  PatientRecord,
  SoapSessionRecord,
  TherapistCredential,
} from '../types/clinical';
import { calculateAgeLabel, formatDomainLabel } from '../utils/clinicalFormatters';

interface PatientsRmeScreenProps {
  patients: PatientRecord[];
  carePlans: CarePlan[];
  soapSessions: SoapSessionRecord[];
  therapist: TherapistCredential;
  onOpenAssessment: (patientId: string) => void;
  onOpenSoap: (patientId: string) => void;
  onSubmitReferral: (payload: Record<string, unknown>) => Promise<void>;
}

const TARGET_PROFESSIONS = [
  { id: 'DOKTER_SP_KFR', label: 'Dokter Sp.KFR (Rehabilitasi Medik)' },
  { id: 'TERAPIS_OKUPASI', label: 'Terapis Okupasi (Sensory Integration)' },
  { id: 'FISIOTERAPIS', label: 'Fisioterapi Pediatrik / Neuro' },
  { id: 'PSIKOLOG_KLINIS', label: 'Psikolog Klinis Tumbuh Kembang' },
  { id: 'DOKTER_SP_ANAK', label: 'Dokter Spesialis Anak (Sp.A)' },
];

export const PatientsRmeScreen: React.FC<PatientsRmeScreenProps> = ({
  patients,
  carePlans,
  soapSessions,
  therapist,
  onOpenAssessment,
  onOpenSoap,
  onSubmitReferral,
}) => {
  const [referralOpenPatientId, setReferralOpenPatientId] = useState<string | null>(
    null
  );
  const [toProfession, setToProfession] = useState('TERAPIS_OKUPASI');
  const [priority, setPriority] = useState<'RUTIN' | 'SEGERA_EVALUASI' | 'CITO_DISFAGIA'>(
    'RUTIN'
  );
  const [clinicalReason, setClinicalReason] = useState(
    'Perlu regulasi sensori proprioseptif/vestibular pra-sesi terapi wicara untuk meningkatkan rentang atensi bersama.'
  );
  const [jointGoal, setJointGoal] = useState(
    'Co-Treatment Terapi Wicara + Terapi Okupasi terpadu dalam satu RME.'
  );
  const [sending, setSending] = useState(false);

  const handleSendReferral = async (patientId: string) => {
    setSending(true);
    try {
      await onSubmitReferral({
        from_practitioner_id: therapist.id,
        patient_id: patientId,
        to_profession: toProfession,
        priority,
        clinical_reason: clinicalReason,
        joint_care_goal: jointGoal,
      });
      setReferralOpenPatientId(null);
    } finally {
      setSending(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>
        Rekam Medis Elektronik (RME) & Kolaborasi Multi-Profesi
      </Text>
      <Text style={styles.headerSub}>
        Standar Permenkes No. 24/2022 (Retensi 25 Tahun) • Akreditasi PKP Enterprise Multi-Cabang
      </Text>

      {patients.map((pt) => {
        const plan = carePlans.find((c) => c.patient_id === pt.id);
        const sessionsCount = soapSessions.filter((s) => s.patient_id === pt.id).length;
        const isRefOpen = referralOpenPatientId === pt.id;

        return (
          <View key={pt.id} style={styles.patientCard}>
            <View style={styles.topRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.mrnBadge}>
                  {pt.medical_record_number} • IHS: {pt.ihs_patient_id ?? 'Terverifikasi'}
                </Text>
                <Text style={styles.nameText}>
                  {pt.full_name} ({pt.gender})
                </Text>
                <Text style={styles.metaText}>
                  Tgl Lahir: {pt.birth_date} ({calculateAgeLabel(pt.birth_date)}) • NIK: {pt.nik_masked}
                </Text>
              </View>
              <View
                style={[
                  styles.riskTag,
                  pt.aspiration_risk_level === 'TINGGI'
                    ? { backgroundColor: '#FEE2E2' }
                    : { backgroundColor: '#DCFCE7' },
                ]}
              >
                <Text
                  style={[
                    styles.riskTagText,
                    pt.aspiration_risk_level === 'TINGGI'
                      ? { color: '#991B1B' }
                      : { color: '#166534' },
                  ]}
                >
                  Aspirasi: {pt.aspiration_risk_level}
                </Text>
              </View>
            </View>

            <View style={styles.infoGrid}>
              <View style={styles.infoLine}>
                <Stethoscope size={14} color="#0F766E" />
                <Text style={styles.infoLineText}>
                  Rujukan: {pt.referring_doctor ?? '-'} ({pt.referring_diagnosis_icd10} - {pt.referring_diagnosis_name})
                </Text>
              </View>
              <View style={styles.infoLine}>
                <Ear size={14} color="#0284C7" />
                <Text style={styles.infoLineText}>
                  Status Audiologi: {pt.hearing_screening_status ?? 'Normal'} • Bahasa Ibu: {pt.primary_language}
                </Text>
              </View>
              <View style={styles.infoLine}>
                <Phone size={14} color="#475569" />
                <Text style={styles.infoLineText}>
                  Wali: {pt.guardian_name} ({pt.guardian_relation}) • {pt.guardian_phone}
                </Text>
              </View>
              <View style={styles.infoLine}>
                <ShieldCheck size={14} color="#059669" />
                <Text style={styles.infoLineText}>
                  Consent UU PDP & Audio Klinis: Aktif • Retensi Arsip s/d {pt.retention_until}
                </Text>
              </View>
            </View>

            {pt.allergies?.length > 0 && (
              <View style={styles.allergyBar}>
                <AlertCircle size={14} color="#B91C1C" />
                <Text style={styles.allergyText}>
                  Alergi Feeding/Medis: {pt.allergies.join(', ')}
                </Text>
              </View>
            )}

            {plan && (
              <View style={styles.planBox}>
                <View style={styles.rowBetween}>
                  <Text style={styles.planDomain}>
                    IEP: {formatDomainLabel(plan.disorder_domain)} ({plan.tw_diagnosis_code})
                  </Text>
                  <Text style={styles.planCounter}>
                    {plan.completed_sessions}/{plan.planned_sessions} Sesi ({sessionsCount} CPPT)
                  </Text>
                </View>
                <Text style={styles.planGoal}>{plan.long_term_goal}</Text>
                {plan.short_term_goals?.map((stg) => (
                  <View key={stg.id} style={styles.stgItem}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.stgText} numberOfLines={2}>
                        • {stg.target}
                      </Text>
                      <Text style={styles.stgPct}>{stg.progress}%</Text>
                    </View>
                    <View style={styles.stgBarBg}>
                      <View style={[styles.stgBarFill, { width: `${stg.progress}%` }]} />
                    </View>
                  </View>
                ))}
              </View>
            )}

            <View style={styles.actionsRow}>
              <Pressable
                style={styles.outlineBtn}
                onPress={() => onOpenAssessment(pt.id)}
              >
                <UserCheck size={14} color="#0F766E" />
                <Text style={styles.outlineBtnText}>Asesmen</Text>
              </Pressable>
              <Pressable
                style={styles.collabBtn}
                onPress={() =>
                  setReferralOpenPatientId(isRefOpen ? null : pt.id)
                }
              >
                <Network size={14} color="#0369A1" />
                <Text style={styles.collabBtnText}>Rujuk Tim</Text>
              </Pressable>
              <Pressable
                style={styles.solidBtn}
                onPress={() => onOpenSoap(pt.id)}
              >
                <FileText size={14} color="#FFFFFF" />
                <Text style={styles.solidBtnText}>CPPT & HEP</Text>
              </Pressable>
            </View>

            {/* Interprofessional Collaborative Care Drawer (Connected to Enterprise HQ) */}
            {isRefOpen && (
              <View style={styles.referralBox}>
                <Text style={styles.referralTitle}>
                  Rujukan Kolaborasi Interprofesional (Standar PKP Klinik Utama)
                </Text>

                <Text style={styles.refLabel}>Profesi Tujuan Kolaborasi:</Text>
                <View style={styles.chipsWrap}>
                  {TARGET_PROFESSIONS.map((prof) => (
                    <Pressable
                      key={prof.id}
                      onPress={() => setToProfession(prof.id)}
                      style={[
                        styles.profChip,
                        toProfession === prof.id && styles.profChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.profChipText,
                          toProfession === prof.id && { color: '#FFFFFF' },
                        ]}
                      >
                        {prof.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.refLabel}>Prioritas Klinis:</Text>
                <View style={styles.chipsWrap}>
                  {(['RUTIN', 'SEGERA_EVALUASI', 'CITO_DISFAGIA'] as const).map((pr) => (
                    <Pressable
                      key={pr}
                      onPress={() => setPriority(pr)}
                      style={[
                        styles.profChip,
                        priority === pr &&
                          (pr === 'CITO_DISFAGIA'
                            ? { backgroundColor: '#DC2626', borderColor: '#DC2626' }
                            : styles.profChipActive),
                      ]}
                    >
                      <Text
                        style={[
                          styles.profChipText,
                          priority === pr && { color: '#FFFFFF' },
                        ]}
                      >
                        {pr.replace(/_/g, ' ')}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <Text style={styles.refLabel}>Alasan Klinis Konsul / Co-Treatment:</Text>
                <TextInput
                  value={clinicalReason}
                  onChangeText={setClinicalReason}
                  multiline
                  style={styles.refInput}
                />

                <Text style={styles.refLabel}>Target Asuhan Bersama (Joint Care Plan):</Text>
                <TextInput
                  value={jointGoal}
                  onChangeText={setJointGoal}
                  multiline
                  style={styles.refInput}
                />

                <Pressable
                  disabled={sending}
                  onPress={() => handleSendReferral(pt.id)}
                  style={styles.sendRefBtn}
                >
                  <Send size={14} color="#FFFFFF" />
                  <Text style={styles.sendRefText}>
                    {sending
                      ? 'Mengirim ke RME Enterprise...'
                      : 'Kirim Konsul Interprofesional ke Tim Klinik'}
                  </Text>
                </Pressable>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingBottom: 36 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  patientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  mrnBadge: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  nameText: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  metaText: { fontSize: 11, color: '#64748B', marginTop: 2 },
  riskTag: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  riskTagText: { fontSize: 10, fontWeight: '800' },
  infoGrid: { marginTop: 10, gap: 6 },
  infoLine: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoLineText: { fontSize: 12, color: '#334155', flex: 1 },
  allergyBar: {
    marginTop: 8,
    backgroundColor: '#FEF2F2',
    borderRadius: 8,
    padding: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  allergyText: { fontSize: 11, fontWeight: '700', color: '#991B1B', flex: 1 },
  planBox: {
    marginTop: 10,
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  planDomain: { fontSize: 12, fontWeight: '800', color: '#0F766E', flex: 1 },
  planCounter: { fontSize: 11, fontWeight: '700', color: '#475569' },
  planGoal: { fontSize: 11, color: '#1E293B', marginTop: 4, marginBottom: 6 },
  stgItem: { marginTop: 5 },
  stgText: { fontSize: 11, color: '#334155', flex: 1 },
  stgPct: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  stgBarBg: {
    height: 5,
    backgroundColor: '#E2E8F0',
    borderRadius: 999,
    marginTop: 3,
    overflow: 'hidden',
  },
  stgBarFill: {
    height: '100%',
    backgroundColor: '#0F766E',
    borderRadius: 999,
  },
  actionsRow: { flexDirection: 'row', gap: 6, marginTop: 12 },
  outlineBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  outlineBtnText: { fontSize: 11, fontWeight: '700', color: '#0F766E' },
  collabBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#0284C7',
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  collabBtnText: { fontSize: 11, fontWeight: '800', color: '#0369A1' },
  solidBtn: {
    flex: 1.15,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
  },
  solidBtnText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  referralBox: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#F0F9FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  referralTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0C4A6E',
    marginBottom: 6,
  },
  refLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
    marginTop: 6,
    marginBottom: 4,
  },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 },
  profChip: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  profChipActive: { backgroundColor: '#0284C7', borderColor: '#0284C7' },
  profChipText: { fontSize: 10, fontWeight: '800', color: '#334155' },
  refInput: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 12,
    color: '#0F172A',
    minHeight: 52,
    textAlignVertical: 'top',
  },
  sendRefBtn: {
    marginTop: 10,
    backgroundColor: '#0284C7',
    borderRadius: 10,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  sendRefText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
});
