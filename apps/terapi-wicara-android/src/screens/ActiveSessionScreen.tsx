import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  CheckSquare,
  FileCheck2,
  Lock,
  MessageSquare,
  Mic,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react-native';
import {
  AAC_CORE_BOARD,
  ICD10_TW_CATALOG,
  ICD9CM_TW_PROCEDURES,
} from '../data/clinicalCatalogs';
import {
  AppointmentItem,
  CarePlan,
  PatientRecord,
  SoapSessionRecord,
  TherapistCredential,
} from '../types/clinical';

interface ActiveSessionScreenProps {
  patients: PatientRecord[];
  carePlans: CarePlan[];
  soapHistory: SoapSessionRecord[];
  activeAppointment: AppointmentItem | null;
  selectedPatientId: string;
  therapist: TherapistCredential;
  onSelectPatient: (id: string) => void;
  onSubmitSoap: (payload: Record<string, unknown>) => Promise<void>;
}

export const ActiveSessionScreen: React.FC<ActiveSessionScreenProps> = ({
  patients,
  carePlans,
  soapHistory,
  activeAppointment,
  selectedPatientId,
  therapist,
  onSelectPatient,
  onSubmitSoap,
}) => {
  const currentPatient =
    patients.find(
      (p) => p.id === (activeAppointment?.patient_id ?? selectedPatientId)
    ) ?? patients[0];

  const activePlan = carePlans.find(
    (cp) => cp.patient_id === currentPatient?.id && cp.status === 'AKTIF'
  );

  // Pre-session Safety & PPI Checklist (Standar Akreditasi Klinik INM & SKP)
  const [twoIdVerified, setTwoIdVerified] = useState(true);
  const [handHygiene, setHandHygiene] = useState(true);
  const [apdUsed, setApdUsed] = useState(true);
  const [sterileOralVerified, setSterileOralVerified] = useState(true);

  // Real-Time Trial Counter
  const [targetSkill, setTargetSkill] = useState(
    activePlan?.short_term_goals?.[0]?.target ??
      'Produksi frasa fungsional / target fonem sesuai IEP'
  );
  const [indepCount, setIndepCount] = useState(14);
  const [verbalCueCount, setVerbalCueCount] = useState(3);
  const [visualCueCount, setVisualCueCount] = useState(2);
  const [tactileCueCount, setTactileCueCount] = useState(0);
  const [incorrectCount, setIncorrectCount] = useState(1);

  // Encrypted Clinical Voice Sample Vault Simulation (UU PDP compliant - never saved to public gallery)
  const [recordingSample, setRecordingSample] = useState(false);
  const [recordedSamples, setRecordedSamples] = useState<string[]>([
    'ENCRYPTED-VOICE-SAMPLE-BASELINE-01.m4a (Vault RME)',
  ]);
  const [lastAacSpoken, setLastAacSpoken] = useState<string | null>(null);

  // CPPT SOAP Fields
  const [subjective, setSubjective] = useState(
    'Orang tua/pendamping melaporkan pasien kooperatif, latihan rumah (HEP) dikerjakan rutin 2x/hari. Tidak ada keluhan demam atau batuk.'
  );
  const [objective, setObjective] = useState('');
  const [assessment, setAssessment] = useState(
    'Kemampuan target meningkat stabil menuju kriteria ketuntasan STG (>=80%). Respons terhadap minimal cue sangat baik.'
  );
  const [plan, setPlan] = useState(
    'Lanjutkan program terapi sesuai Care Plan minggu depan dengan peningkatan kompleksitas stimulus & pengurangan bantuan verbal.'
  );
  const [hep, setHep] = useState(
    'Latihan 10–15 menit pagi dan sore bersama orang tua menggunakan kartu stimulus di Portal Pasien; berikan penguatan positif setiap respons mandiri.'
  );
  const [caregiverName, setCaregiverName] = useState(
    currentPatient?.guardian_name ?? 'Wali Pasien'
  );
  const [icd10, setIcd10] = useState(
    activePlan?.medical_icd10_code ?? currentPatient?.referring_diagnosis_icd10 ?? 'F80.1'
  );
  const [icd9cm, setIcd9cm] = useState('93.75');
  const [ttePin, setTtePin] = useState('240826');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (activePlan?.short_term_goals?.[0]?.target) {
      setTargetSkill(activePlan.short_term_goals[0].target);
    }
    if (currentPatient) {
      setCaregiverName(currentPatient.guardian_name);
      setIcd10(
        activePlan?.medical_icd10_code ??
          currentPatient.referring_diagnosis_icd10 ??
          'F80.1'
      );
    }
  }, [currentPatient?.id, activePlan?.id]);

  const totalTrials =
    indepCount + verbalCueCount + visualCueCount + tactileCueCount + incorrectCount;
  const independentAccuracy =
    totalTrials > 0 ? Number(((indepCount / totalTrials) * 100).toFixed(1)) : 0;
  const assistedSuccessRate =
    totalTrials > 0
      ? Number(
          (
            ((indepCount + verbalCueCount + visualCueCount + tactileCueCount) /
              totalTrials) *
            100
          ).toFixed(1)
        )
      : 0;

  const autoFillObjectiveFromCounter = () => {
    setObjective(
      `Target: "${targetSkill}". Total ${totalTrials} trial: Mandiri ${indepCount} (${independentAccuracy}%), Verbal Prompt ${verbalCueCount}, Visual Prompt ${visualCueCount}, Tactile Cue ${tactileCueCount}, Belum Tepat ${incorrectCount} (Total keberhasilan terbantu ${assistedSuccessRate}%).`
    );
  };

  useEffect(() => {
    autoFillObjectiveFromCounter();
  }, [indepCount, verbalCueCount, visualCueCount, tactileCueCount, incorrectCount, targetSkill]);

  const safetyAllChecked =
    twoIdVerified && handHygiene && apdUsed && sterileOralVerified;

  const handleLockAndSignSoap = async () => {
    if (!currentPatient || !safetyAllChecked || ttePin.length < 4) return;
    setSaving(true);
    try {
      await onSubmitSoap({
        therapist_id: therapist.id,
        patient_id: currentPatient.id,
        appointment_id: activeAppointment?.id ?? '',
        duration_minutes: 45,
        hand_hygiene_5_moments: handHygiene,
        apd_compliant: apdUsed,
        oral_tools_sterile_verified: sterileOralVerified,
        patient_two_identifiers_checked: twoIdVerified,
        target_skill: targetSkill,
        trials_independent: indepCount,
        trials_verbal_prompt: verbalCueCount,
        trials_visual_prompt: visualCueCount,
        trials_tactile_prompt: tactileCueCount,
        trials_incorrect: incorrectCount,
        accuracy_percentage: independentAccuracy,
        subjective,
        objective,
        assessment,
        plan,
        home_exercise_program: hep,
        caregiver_educated: true,
        caregiver_signature_name: caregiverName,
        icd10_code: icd10,
        icd9cm_code: icd9cm,
        icf_code: activePlan?.icf_codes?.[0] ?? 'd330',
      });
    } finally {
      setSaving(false);
    }
  };

  const patientSoapHistory = soapHistory.filter(
    (s) => s.patient_id === currentPatient?.id
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Patient Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientStrip}>
        {patients.map((pt) => {
          const isCurrent = pt.id === currentPatient?.id;
          return (
            <Pressable
              key={pt.id}
              onPress={() => onSelectPatient(pt.id)}
              style={[styles.ptPill, isCurrent && styles.ptPillActive]}
            >
              <Text style={[styles.ptPillTitle, isCurrent && { color: '#FFFFFF' }]}>
                {pt.full_name}
              </Text>
              <Text style={[styles.ptPillSub, isCurrent && { color: '#CCFBF1' }]}>
                {pt.medical_record_number}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Active IEP / Care Plan Summary */}
      {activePlan && (
        <View style={styles.iepBanner}>
          <Text style={styles.iepTitle}>
            IEP Aktif: {activePlan.tw_diagnosis_name} ({activePlan.medical_icd10_code})
          </Text>
          <Text style={styles.iepGoal}>LTG: {activePlan.long_term_goal}</Text>
          <Text style={styles.iepIcf}>
            Kode ICF WHO: {activePlan.icf_codes.join(' • ')} | Sesi {activePlan.completed_sessions}/{activePlan.planned_sessions}
          </Text>
        </View>
      )}

      {/* Mandatory Patient Safety & INM Kemenkes Gate */}
      <View style={styles.card}>
        <View style={styles.rowCenter}>
          <ShieldCheck size={17} color="#0F766E" />
          <Text style={styles.cardTitle}>
            Wajib Kepatuhan INM Kemenkes & Keselamatan Pasien
          </Text>
        </View>
        {[
          {
            val: twoIdVerified,
            toggle: () => setTwoIdVerified((v) => !v),
            label: 'Identifikasi Benar 2 Parameter (Nama Lengkap + Tgl Lahir / No. RM)',
          },
          {
            val: handHygiene,
            toggle: () => setHandHygiene((v) => !v),
            label: 'Kebersihan Tangan 5 Momen WHO (INM Klinik)',
          },
          {
            val: apdUsed,
            toggle: () => setApdUsed((v) => !v),
            label: 'Penggunaan APD Sesuai Indikasi Klinis / Disfagia',
          },
          {
            val: sterileOralVerified,
            toggle: () => setSterileOralVerified((v) => !v),
            label: 'Alat Oral Motor Terverifikasi Steril / Single-Use (SOP PPI)',
          },
        ].map((chk, idx) => (
          <Pressable key={idx} onPress={chk.toggle} style={styles.safetyItem}>
            <CheckSquare size={18} color={chk.val ? '#059669' : '#DC2626'} />
            <Text style={styles.safetyText}>{chk.label}</Text>
          </Pressable>
        ))}
      </View>

      {/* Real-time Trial Counter */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>
            Real-Time Trial Counter (Koleksi Data Objektif)
          </Text>
          <Pressable
            onPress={() => {
              setIndepCount(0);
              setVerbalCueCount(0);
              setVisualCueCount(0);
              setTactileCueCount(0);
              setIncorrectCount(0);
            }}
            style={styles.resetChip}
          >
            <RotateCcw size={13} color="#475569" />
            <Text style={styles.resetChipText}>Reset</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Target Keterampilan Sesi Ini:</Text>
        <TextInput
          value={targetSkill}
          onChangeText={setTargetSkill}
          style={styles.input}
        />

        <View style={styles.accuracyBanner}>
          <View>
            <Text style={styles.accuracyLabel}>Akurasi Mandiri</Text>
            <Text style={styles.accuracySub}>
              {totalTrials} Total Trial • Keberhasilan Terbantu {assistedSuccessRate}%
            </Text>
          </View>
          <Text style={styles.accuracyNumber}>{independentAccuracy}%</Text>
        </View>

        <View style={styles.counterGrid}>
          <Pressable
            style={[styles.counterBtn, { backgroundColor: '#059669' }]}
            onPress={() => setIndepCount((c) => c + 1)}
          >
            <Text style={styles.counterVal}>{indepCount}</Text>
            <Text style={styles.counterTag}>+ Mandiri</Text>
          </Pressable>
          <Pressable
            style={[styles.counterBtn, { backgroundColor: '#0284C7' }]}
            onPress={() => setVerbalCueCount((c) => c + 1)}
          >
            <Text style={styles.counterVal}>{verbalCueCount}</Text>
            <Text style={styles.counterTag}>+ Verbal Cue</Text>
          </Pressable>
          <Pressable
            style={[styles.counterBtn, { backgroundColor: '#7C3AED' }]}
            onPress={() => setVisualCueCount((c) => c + 1)}
          >
            <Text style={styles.counterVal}>{visualCueCount}</Text>
            <Text style={styles.counterTag}>+ Visual Cue</Text>
          </Pressable>
          <Pressable
            style={[styles.counterBtn, { backgroundColor: '#D97706' }]}
            onPress={() => setTactileCueCount((c) => c + 1)}
          >
            <Text style={styles.counterVal}>{tactileCueCount}</Text>
            <Text style={styles.counterTag}>+ Tactile/Oral</Text>
          </Pressable>
          <Pressable
            style={[styles.counterBtn, { backgroundColor: '#DC2626' }]}
            onPress={() => setIncorrectCount((c) => c + 1)}
          >
            <Text style={styles.counterVal}>{incorrectCount}</Text>
            <Text style={styles.counterTag}>- Belum Tepat</Text>
          </Pressable>
        </View>
      </View>

      {/* AAC Board & Encrypted Voice Sample Vault (UU PDP Compliant) */}
      <View style={styles.card}>
        <View style={styles.rowCenter}>
          <MessageSquare size={16} color="#0F766E" />
          <Text style={styles.cardTitle}>
            Papan Komunikasi AAC & Perekam Sampel RME Terenkripsi
          </Text>
        </View>
        <Text style={styles.subNote}>
          Sesuai UU PDP No. 27/2022, rekaman suara disimpan terenkripsi di brankas RME (tidak masuk ke Galeri publik HP terapis).
        </Text>

        <View style={styles.aacGrid}>
          {AAC_CORE_BOARD.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => setLastAacSpoken(`${item.icon} "${item.phrase}"`)}
              style={styles.aacTile}
            >
              <Text style={styles.aacIcon}>{item.icon}</Text>
              <Text style={styles.aacPhrase}>{item.phrase}</Text>
            </Pressable>
          ))}
        </View>
        {lastAacSpoken && (
          <View style={styles.aacOutputBar}>
            <Sparkles size={14} color="#0F766E" />
            <Text style={styles.aacOutputText}>Stimulus AAC dipilih: {lastAacSpoken}</Text>
          </View>
        )}

        <View style={styles.voiceVaultBox}>
          <Pressable
            onPress={() => {
              if (recordingSample) {
                setRecordingSample(false);
                setRecordedSamples((prev) => [
                  `ENCRYPTED-SAMPLE-${new Date().toLocaleTimeString('id-ID')}.m4a (AES-256 Vault)`,
                  ...prev,
                ]);
              } else {
                setRecordingSample(true);
              }
            }}
            style={[
              styles.recordBtn,
              recordingSample && { backgroundColor: '#DC2626' },
            ]}
          >
            <Mic size={15} color="#FFFFFF" />
            <Text style={styles.recordBtnText}>
              {recordingSample
                ? 'Hentikan & Enkripsi Sampel Suara'
                : 'Rekam Sampel Bicara Pasien (Vault RME)'}
            </Text>
          </Pressable>
          {recordedSamples.slice(0, 2).map((s, i) => (
            <Text key={i} style={styles.sampleItem}>
              • {s}
            </Text>
          ))}
        </View>
      </View>

      {/* CPPT SOAP Documentation + TTE BSrE Lock */}
      <View style={styles.card}>
        <View style={styles.rowCenter}>
          <FileCheck2 size={17} color="#0F766E" />
          <Text style={styles.cardTitle}>
            Dokumentasi CPPT Format SOAP & Koding SATUSEHAT
          </Text>
        </View>

        <Text style={styles.fieldLabel}>S — Subjective (Keluhan / Laporan Keluarga):</Text>
        <TextInput
          value={subjective}
          onChangeText={setSubjective}
          multiline
          style={[styles.input, styles.textArea]}
        />

        <Text style={styles.fieldLabel}>O — Objective (Otomatis dari Trial Counter + Observasi):</Text>
        <TextInput
          value={objective}
          onChangeText={setObjective}
          multiline
          style={[styles.input, styles.textArea]}
        />

        <Text style={styles.fieldLabel}>A — Assessment (Analisis Klinis Terapis Wicara):</Text>
        <TextInput
          value={assessment}
          onChangeText={setAssessment}
          multiline
          style={[styles.input, styles.textArea]}
        />

        <Text style={styles.fieldLabel}>P — Plan (Rencana Tindak Lanjut Intervensi):</Text>
        <TextInput
          value={plan}
          onChangeText={setPlan}
          multiline
          style={[styles.input, styles.textArea]}
        />

        <Text style={styles.fieldLabel}>
          Program Latihan Rumah / Home Exercise Program (Dikirim ke Portal Orang Tua):
        </Text>
        <TextInput
          value={hep}
          onChangeText={setHep}
          multiline
          style={[styles.input, styles.textArea]}
        />

        {/* ICD-10 & ICD-9-CM Quick Selector */}
        <Text style={styles.fieldLabel}>Kode Diagnosis ICD-10 (Wajib SATUSEHAT):</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {ICD10_TW_CATALOG.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => setIcd10(item.code)}
              style={[styles.codeChip, icd10 === item.code && styles.codeChipActive]}
            >
              <Text
                style={[
                  styles.codeChipText,
                  icd10 === item.code && { color: '#FFFFFF' },
                ]}
              >
                {item.code}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={styles.fieldLabel}>Kode Tindakan ICD-9-CM Terapi Wicara:</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
          {ICD9CM_TW_PROCEDURES.map((proc) => (
            <Pressable
              key={proc.code}
              onPress={() => setIcd9cm(proc.code)}
              style={[styles.codeChip, icd9cm === proc.code && styles.codeChipActive]}
            >
              <Text
                style={[
                  styles.codeChipText,
                  icd9cm === proc.code && { color: '#FFFFFF' },
                ]}
              >
                {proc.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.twoCol}>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>Nama Wali Penerima Edukasi</Text>
            <TextInput
              value={caregiverName}
              onChangeText={setCaregiverName}
              style={styles.input}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.fieldLabel}>PIN Passphrase TTE Terapis</Text>
            <TextInput
              value={ttePin}
              onChangeText={setTtePin}
              secureTextEntry
              keyboardType="numeric"
              style={styles.input}
            />
          </View>
        </View>

        {!safetyAllChecked && (
          <Text style={styles.warningLockText}>
            Lengkapi seluruh checklist Keselamatan Pasien & PPI di atas sebelum mengunci SOAP.
          </Text>
        )}

        <Pressable
          disabled={!safetyAllChecked || saving}
          onPress={handleLockAndSignSoap}
          style={[
            styles.tteLockBtn,
            (!safetyAllChecked || saving) && { opacity: 0.5 },
          ]}
        >
          <Lock size={16} color="#FFFFFF" />
          <Text style={styles.tteLockBtnText}>
            {saving
              ? 'Mengunci TTE & Mengirim ke RME...'
              : 'Tanda Tangani Elektronik (TTE) & Kunci CPPT SOAP'}
          </Text>
        </Pressable>
      </View>

      {/* Previous Locked SOAP History (Immutable Permenkes 24/2022) */}
      <Text style={styles.historyHeader}>
        Riwayat CPPT Terkunci Pasien Ini ({patientSoapHistory.length})
      </Text>
      {patientSoapHistory.map((item) => (
        <View key={item.id} style={styles.historyCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.historyDate}>
              {new Date(item.session_date).toLocaleDateString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })}{' '}
              • Akurasi {item.accuracy_percentage}%
            </Text>
            <Text style={styles.tteSerialBadge}>
              TTE: {item.tte_certificate_serial ?? 'LOCKED'}
            </Text>
          </View>
          <Text style={styles.historyTarget}>{item.target_skill}</Text>
          <Text style={styles.historySoapLine}>O: {item.objective}</Text>
          <Text style={styles.historySoapLine}>HEP: {item.home_exercise_program}</Text>
        </View>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingBottom: 36 },
  patientStrip: { marginBottom: 10 },
  ptPill: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  ptPillActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  ptPillTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  ptPillSub: { fontSize: 11, color: '#64748B' },
  iepBanner: {
    backgroundColor: '#0F172A',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  iepTitle: { color: '#5EEAD4', fontSize: 12, fontWeight: '800' },
  iepGoal: { color: '#F8FAFC', fontSize: 12, marginTop: 4 },
  iepIcf: { color: '#94A3B8', fontSize: 11, marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowCenter: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', flex: 1 },
  safetyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  safetyText: { fontSize: 12, color: '#1E293B', flex: 1, fontWeight: '600' },
  resetChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  resetChipText: { fontSize: 11, color: '#475569', fontWeight: '700' },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginTop: 8,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 8,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  textArea: { minHeight: 66, textAlignVertical: 'top' },
  accuracyBanner: {
    marginTop: 10,
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#99F6E4',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  accuracyLabel: { fontSize: 12, fontWeight: '800', color: '#115E59' },
  accuracySub: { fontSize: 11, color: '#0F766E', marginTop: 2 },
  accuracyNumber: { fontSize: 24, fontWeight: '900', color: '#0F766E' },
  counterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  counterBtn: {
    flexGrow: 1,
    minWidth: '30%',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  counterVal: { color: '#FFFFFF', fontSize: 20, fontWeight: '900' },
  counterTag: { color: '#FFFFFF', fontSize: 11, fontWeight: '700', marginTop: 2 },
  subNote: { fontSize: 11, color: '#64748B', marginBottom: 10 },
  aacGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  aacTile: {
    width: '48%',
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    padding: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  aacIcon: { fontSize: 20 },
  aacPhrase: { fontSize: 11, fontWeight: '700', color: '#1E293B', flex: 1 },
  aacOutputBar: {
    marginTop: 8,
    backgroundColor: '#CCFBF1',
    padding: 8,
    borderRadius: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  aacOutputText: { fontSize: 12, fontWeight: '700', color: '#115E59' },
  voiceVaultBox: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  recordBtn: {
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    marginBottom: 6,
  },
  recordBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  sampleItem: { fontSize: 11, color: '#475569', marginTop: 2 },
  codeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  codeChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  codeChipText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  twoCol: { flexDirection: 'row', gap: 10, marginTop: 4 },
  warningLockText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 8,
  },
  tteLockBtn: {
    marginTop: 14,
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tteLockBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  historyHeader: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 8,
    marginTop: 4,
  },
  historyCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  historyDate: { fontSize: 12, fontWeight: '800', color: '#0F766E' },
  tteSerialBadge: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  historyTarget: { fontSize: 12, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
  historySoapLine: { fontSize: 11, color: '#475569', marginTop: 2 },
});
