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
  AlertOctagon,
  BookOpenCheck,
  CheckCircle2,
  FileLock2,
  Shield,
  Sparkles,
} from 'lucide-react-native';
import {
  AuditLogItem,
  PatientRecord,
  SopDocument,
  SterilizationLog,
  TherapistCredential,
  TherapyRoom,
} from '../types/clinical';

interface ComplianceScreenProps {
  therapist: TherapistCredential;
  rooms: TherapyRoom[];
  patients: PatientRecord[];
  sops: SopDocument[];
  sterilizationLogs: SterilizationLog[];
  auditLogs: AuditLogItem[];
  onSubmitPpiOrIkp: (payload: Record<string, unknown>) => Promise<void>;
}

export const ComplianceScreen: React.FC<ComplianceScreenProps> = ({
  therapist,
  rooms,
  patients,
  sops,
  sterilizationLogs,
  auditLogs,
  onSubmitPpiOrIkp,
}) => {
  const [subTab, setSubTab] = useState<'SOP' | 'PPI' | 'IKP' | 'AUDIT'>('SOP');

  // PPI Sterilization Form
  const [toolSetName, setToolSetName] = useState(
    'Set Probe Oral Motor Z-Vibe & Cermin Laring #01'
  );
  const [batchCode, setBatchCode] = useState(
    `STERIL-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-B2`
  );
  const [sterilMethod, setSterilMethod] = useState<
    'AUTOCLAVE_STEAM' | 'DISINFEKSI_TINGKAT_TINGGI' | 'SINGLE_USE_DISPOSED'
  >('AUTOCLAVE_STEAM');

  // IKP (Insiden Keselamatan Pasien) Form
  const [incidentType, setIncidentType] = useState<
    'KPC' | 'KNC' | 'KTC' | 'KTD' | 'SENTINEL'
  >('KNC');
  const [riskGrading, setRiskGrading] = useState<'BIRU' | 'HIJAU' | 'KUNING' | 'MERAH'>(
    'HIJAU'
  );
  const [chronology, setChronology] = useState(
    'Pasien hampir terpeleset saat berpindah ke kursi terapi anak karena kaus kaki licin; terapis segera menahan bahu pasien (tidak cedera).'
  );
  const [immediateAction, setImmediateAction] = useState(
    'Melepas kaus kaki licin di area matras terapi dan memasang alas anti-slip sesuai SOP K3 Klinik.'
  );
  const [submitting, setSubmitting] = useState(false);

  const handleSavePpi = async () => {
    setSubmitting(true);
    try {
      await onSubmitPpiOrIkp({
        record_type: 'PPI_STERILISASI',
        therapist_id: therapist.id,
        room_id: rooms[0]?.id ?? '',
        tool_set_name: toolSetName,
        batch_code: batchCode,
        method: sterilMethod,
        indicator_passed: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveIkp = async () => {
    setSubmitting(true);
    try {
      await onSubmitPpiOrIkp({
        record_type: 'LAPORAN_IKP',
        therapist_id: therapist.id,
        patient_id: patients[0]?.id ?? '',
        incident_type: incidentType,
        risk_grading: riskGrading,
        chronology,
        immediate_action: immediateAction,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>
        Kepatuhan Regulasi, SOP Dinkes, PPI & Keselamatan Pasien
      </Text>
      <Text style={styles.headerSub}>
        Standar Akreditasi Klinik (Permenkes 34/2022), PPI (Permenkes 27/2017) & Audit UU PDP
      </Text>

      <View style={styles.tabsRow}>
        {[
          { id: 'SOP' as const, label: 'SOP Klinik' },
          { id: 'PPI' as const, label: 'Sterilisasi PPI' },
          { id: 'IKP' as const, label: 'Lapor IKP' },
          { id: 'AUDIT' as const, label: 'Audit UU PDP' },
        ].map((t) => (
          <Pressable
            key={t.id}
            onPress={() => setSubTab(t.id)}
            style={[styles.tabPill, subTab === t.id && styles.tabPillActive]}
          >
            <Text style={[styles.tabPillText, subTab === t.id && { color: '#FFFFFF' }]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* SUBTAB 1: SOP RESMI KLINIK */}
      {subTab === 'SOP' &&
        sops.map((sop) => (
          <View key={sop.id} style={styles.card}>
            <View style={styles.rowBetween}>
              <Text style={styles.sopCode}>{sop.sop_number}</Text>
              <Text style={styles.sopCategory}>{sop.category.replace(/_/g, ' ')}</Text>
            </View>
            <Text style={styles.sopTitle}>{sop.title}</Text>
            <Text style={styles.sopReg}>Acuan Hukum: {sop.regulation_reference}</Text>

            <Text style={styles.subHeading}>Daftar Tilik Wajib (Mandatory Checklist):</Text>
            {sop.mandatory_checklist?.map((chk, idx) => (
              <View key={idx} style={styles.checkItem}>
                <BookOpenCheck size={14} color="#0F766E" />
                <Text style={styles.checkText}>{chk}</Text>
              </View>
            ))}
            <Text style={styles.approvedFooter}>
              Disahkan Penanggung Jawab Klinik: {sop.approved_by} (Revisi {sop.revision_number})
            </Text>
          </View>
        ))}

      {/* SUBTAB 2: LOG STERILISASI ALAT ORAL MOTOR (PPI DINKES) */}
      {subTab === 'PPI' && (
        <View style={styles.card}>
          <View style={styles.rowGap}>
            <Sparkles size={17} color="#0F766E" />
            <Text style={styles.sopTitle}>
              Pencatatan Sterilisasi Alat Oral Motor (Pencegahan Infeksi Silang)
            </Text>
          </View>

          <Text style={styles.inputLabel}>Nama Set Instrumen Oral Motor:</Text>
          <TextInput
            value={toolSetName}
            onChangeText={setToolSetName}
            style={styles.input}
          />

          <Text style={styles.inputLabel}>Kode Batch / Pouch Indikator Steril:</Text>
          <TextInput value={batchCode} onChangeText={setBatchCode} style={styles.input} />

          <Text style={styles.inputLabel}>Metode Dekontaminasi / Sterilisasi:</Text>
          <View style={styles.chipsWrap}>
            {(
              [
                'AUTOCLAVE_STEAM',
                'DISINFEKSI_TINGKAT_TINGGI',
                'SINGLE_USE_DISPOSED',
              ] as const
            ).map((m) => (
              <Pressable
                key={m}
                onPress={() => setSterilMethod(m)}
                style={[styles.choiceChip, sterilMethod === m && styles.choiceChipActive]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    sterilMethod === m && { color: '#FFFFFF' },
                  ]}
                >
                  {m.replace(/_/g, ' ')}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            disabled={submitting}
            onPress={handleSavePpi}
            style={styles.submitBtn}
          >
            <CheckCircle2 size={16} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>Simpan Log Sterilisasi PPI</Text>
          </Pressable>

          <Text style={[styles.subHeading, { marginTop: 16 }]}>
            Riwayat Sterilisasi Terverifikasi ({sterilizationLogs.length})
          </Text>
          {sterilizationLogs.map((log) => (
            <View key={log.id} style={styles.logRow}>
              <Text style={styles.logTitle}>{log.tool_set_name}</Text>
              <Text style={styles.logSub}>
                Batch: {log.batch_code} • {log.method.replace(/_/g, ' ')} • LULUS INDIKATOR
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* SUBTAB 3: PELAPORAN INSIDEN KESELAMATAN PASIEN (IKP - PMKP AKREDITASI) */}
      {subTab === 'IKP' && (
        <View style={styles.card}>
          <View style={styles.rowGap}>
            <AlertOctagon size={17} color="#DC2626" />
            <Text style={styles.sopTitle}>
              Pelaporan Insiden Keselamatan Pasien (PMKP Non-Punitive)
            </Text>
          </View>

          <Text style={styles.inputLabel}>Jenis Insiden (Standar Komite Nasional KP):</Text>
          <View style={styles.chipsWrap}>
            {(['KPC', 'KNC', 'KTC', 'KTD', 'SENTINEL'] as const).map((tp) => (
              <Pressable
                key={tp}
                onPress={() => setIncidentType(tp)}
                style={[styles.choiceChip, incidentType === tp && styles.choiceChipDanger]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    incidentType === tp && { color: '#FFFFFF' },
                  ]}
                >
                  {tp}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>Bands Grading Risiko:</Text>
          <View style={styles.chipsWrap}>
            {(['BIRU', 'HIJAU', 'KUNING', 'MERAH'] as const).map((rk) => (
              <Pressable
                key={rk}
                onPress={() => setRiskGrading(rk)}
                style={[styles.choiceChip, riskGrading === rk && styles.choiceChipActive]}
              >
                <Text
                  style={[
                    styles.choiceChipText,
                    riskGrading === rk && { color: '#FFFFFF' },
                  ]}
                >
                  RISIKO {rk}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.inputLabel}>Kronologi Kejadian:</Text>
          <TextInput
            value={chronology}
            onChangeText={setChronology}
            multiline
            style={[styles.input, { minHeight: 68 }]}
          />

          <Text style={styles.inputLabel}>Tindakan Segera yang Dilakukan:</Text>
          <TextInput
            value={immediateAction}
            onChangeText={setImmediateAction}
            multiline
            style={[styles.input, { minHeight: 60 }]}
          />

          <Pressable
            disabled={submitting}
            onPress={handleSaveIkp}
            style={[styles.submitBtn, { backgroundColor: '#DC2626' }]}
          >
            <Shield size={16} color="#FFFFFF" />
            <Text style={styles.submitBtnText}>
              Kirim Laporan IKP ke Tim Mutu Klinik (&lt;2x24 Jam)
            </Text>
          </Pressable>
        </View>
      )}

      {/* SUBTAB 4: IMMUTABLE RME AUDIT TRAIL (UU PDP No. 27/2022 & Permenkes 24/2022) */}
      {subTab === 'AUDIT' && (
        <View style={styles.card}>
          <View style={styles.rowGap}>
            <FileLock2 size={17} color="#0F766E" />
            <Text style={styles.sopTitle}>
              Jejak Audit Akses RME Tak Terubah (UU PDP No. 27/2022)
            </Text>
          </View>
          <Text style={styles.sopReg}>
            Setiap pembacaan, asesmen, dan penguncian TTE pada data medis spesifik tercatat otomatis beserta nomor SIP pengakses. Retensi RME aktif minimal 25 tahun.
          </Text>

          {auditLogs.map((al) => (
            <View key={al.id} style={styles.logRow}>
              <View style={styles.rowBetween}>
                <Text style={styles.auditAction}>{al.action}</Text>
                <Text style={styles.auditTime}>
                  {new Date(al.logged_at).toLocaleTimeString('id-ID', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              </View>
              <Text style={styles.logSub}>
                Oleh: {al.actor_name} ({al.actor_sip_number ?? 'SIP Terverifikasi'})
              </Text>
              {al.patient_mrn && (
                <Text style={styles.logSub}>No. RM Pasien: {al.patient_mrn}</Text>
              )}
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingBottom: 36 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  tabsRow: { flexDirection: 'row', gap: 6, marginBottom: 12 },
  tabPill: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 9,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
  },
  tabPillActive: { backgroundColor: '#0F766E' },
  tabPillText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  sopCode: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  sopCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0369A1',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  sopTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginTop: 4, flex: 1 },
  sopReg: { fontSize: 11, color: '#64748B', marginTop: 4, marginBottom: 8 },
  subHeading: { fontSize: 12, fontWeight: '800', color: '#1E293B', marginBottom: 6 },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
    paddingVertical: 4,
  },
  checkText: { fontSize: 12, color: '#334155', flex: 1 },
  approvedFooter: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    fontSize: 11,
    color: '#64748B',
    fontStyle: 'italic',
  },
  inputLabel: {
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
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 },
  choiceChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  choiceChipActive: { backgroundColor: '#0F766E', borderColor: '#0F766E' },
  choiceChipDanger: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  choiceChipText: { fontSize: 11, fontWeight: '800', color: '#334155' },
  submitBtn: {
    marginTop: 14,
    backgroundColor: '#0F766E',
    borderRadius: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  submitBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  logRow: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logTitle: { fontSize: 12, fontWeight: '700', color: '#0F172A' },
  logSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  auditAction: { fontSize: 11, fontWeight: '800', color: '#0F766E' },
  auditTime: { fontSize: 11, color: '#64748B' },
});
