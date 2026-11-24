import React, { useEffect, useRef, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Activity,
  CheckCircle2,
  Mic,
  Pause,
  Play,
  RotateCcw,
  Save,
  ShieldAlert,
} from 'lucide-react-native';
import {
  IDDSI_LEVELS,
  INDONESIAN_PHONEME_INVENTORY,
} from '../data/clinicalCatalogs';
import {
  AssessmentDomain,
  PatientRecord,
  TherapistCredential,
} from '../types/clinical';
import { calculateAgeLabel } from '../utils/clinicalFormatters';

interface AssessmentScreenProps {
  patients: PatientRecord[];
  selectedPatientId: string;
  therapist: TherapistCredential;
  onSelectPatient: (id: string) => void;
  onSubmitAssessment: (payload: Record<string, unknown>) => Promise<void>;
}

type ArticulationScore = 'BENAR' | 'SUBSTITUSI' | 'OMISI' | 'DISTORSI';

export const AssessmentScreen: React.FC<AssessmentScreenProps> = ({
  patients,
  selectedPatientId,
  therapist,
  onSelectPatient,
  onSubmitAssessment,
}) => {
  const activePatient =
    patients.find((p) => p.id === selectedPatientId) ?? patients[0];

  const [activeTab, setActiveTab] = useState<AssessmentDomain>('BICARA_ARTIKULASI');
  const [submitting, setSubmitting] = useState(false);

  // 1. OPE & DDK Timer (/pa/, /ta/, /ka/, /pataka/)
  const [lipClosure, setLipClosure] = useState<'ADEKUAT' | 'LEMAH'>('ADEKUAT');
  const [tongueElevation, setTongueElevation] = useState<'ADEKUAT' | 'TERBATAS'>('ADEKUAT');
  const [velumMovement, setVelumMovement] = useState<'SIMETRIS' | 'HIPERNASAL'>('SIMETRIS');
  const [ddkCount, setDdkCount] = useState(0);
  const [ddkSeconds, setDdkSeconds] = useState(0);
  const [ddkRunning, setDdkRunning] = useState(false);

  // 2. Articulation & Phonology PCC
  const [phonemeScores, setPhonemeScores] = useState<Record<string, ArticulationScore>>({
    '/p/': 'BENAR',
    '/b/': 'BENAR',
    '/m/': 'BENAR',
    '/t/': 'BENAR',
    '/d/': 'BENAR',
    '/s/': 'SUBSTITUSI',
    '/l/': 'BENAR',
    '/r/': 'OMISI',
    '/k/': 'SUBSTITUSI',
    '/g/': 'SUBSTITUSI',
    '/ŋ/ (ng)': 'BENAR',
    '/tʃ/ (c)': 'BENAR',
  });

  // 3. Language Receptive & Expressive
  const [receptiveMonths, setReceptiveMonths] = useState('36');
  const [expressiveMonths, setExpressiveMonths] = useState('22');
  const [jointAttention, setJointAttention] = useState(true);
  const [twoStepCommand, setTwoStepCommand] = useState(true);

  // 4. Voice GRBAS + MPT Stopwatch
  const [grbas, setGrbas] = useState({ G: 1, R: 1, B: 0, A: 0, S: 1 });
  const [mptRunning, setMptRunning] = useState(false);
  const [mptTenths, setMptTenths] = useState(85); // 8.5s default
  const [szRatio, setSzRatio] = useState('1.18');

  // 5. Fluency / Stuttering %SS Counter
  const [fluentSyllables, setFluentSyllables] = useState(88);
  const [stutteredSyllables, setStutteredSyllables] = useState(12);

  // 6. Dysphagia / Swallowing IDDSI + SpO2
  const [iddsiLiquid, setIddsiLiquid] = useState(2);
  const [iddsiFood, setIddsiFood] = useState(5);
  const [spo2Before, setSpo2Before] = useState('98');
  const [spo2After, setSpo2After] = useState('97');
  const [coughObserved, setCoughObserved] = useState(false);
  const [wetVoiceObserved, setWetVoiceObserved] = useState(false);

  const [conclusion, setConclusion] = useState(
    'Ditemukan substitusi konsonan velar /k/, /g/ menjadi alveolar /t/, /d/ (fronting) serta omisi getar /r/. Disarankan intervensi fonologi minimal pairs 2x/minggu.'
  );

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (ddkRunning || mptRunning) {
      timerRef.current = setInterval(() => {
        if (ddkRunning) {
          setDdkSeconds((prev) => prev + 0.1);
        }
        if (mptRunning) {
          setMptTenths((prev) => prev + 1);
        }
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [ddkRunning, mptRunning]);

  // Derived scores
  const totalPhonemes = INDONESIAN_PHONEME_INVENTORY.length;
  const correctPhonemes = Object.values(phonemeScores).filter((v) => v === 'BENAR').length;
  const pccPercentage = Number(((correctPhonemes / totalPhonemes) * 100).toFixed(1));

  const totalSyllables = fluentSyllables + stutteredSyllables;
  const percentSS =
    totalSyllables > 0
      ? Number(((stutteredSyllables / totalSyllables) * 100).toFixed(1))
      : 0;

  const ddkRate =
    ddkSeconds > 0 ? Number((ddkCount / ddkSeconds).toFixed(2)) : 0;

  const spo2Drop = Math.max(
    0,
    (parseInt(spo2Before, 10) || 98) - (parseInt(spo2After, 10) || 98)
  );

  const handleSave = async () => {
    if (!activePatient) return;
    setSubmitting(true);
    try {
      await onSubmitAssessment({
        therapist_id: therapist.id,
        patient_id: activePatient.id,
        domain: activeTab,
        ope_findings: {
          lip_closure: lipClosure,
          tongue_elevation: tongueElevation,
          velopharyngeal: velumMovement,
        },
        ddk_smr_pataka_per_sec: ddkRate || 4.2,
        pcc_score: pccPercentage,
        articulation_matrix: Object.entries(phonemeScores).map(([phoneme, score]) => ({
          phoneme,
          score,
        })),
        mpt_seconds: Number((mptTenths / 10).toFixed(1)),
        sz_ratio: parseFloat(szRatio) || 1.0,
        grbas_score: grbas,
        total_syllables_counted: totalSyllables,
        stuttered_syllables_counted: stutteredSyllables,
        percent_syllables_stuttered: percentSS,
        iddsi_liquid_level: iddsiLiquid,
        iddsi_food_level: iddsiFood,
        spo2_baseline: parseInt(spo2Before, 10) || 98,
        spo2_post_swallow: parseInt(spo2After, 10) || 97,
        clinical_conclusion: conclusion,
        icd10_code: activePatient.referring_diagnosis_icd10 ?? 'F80.0',
        icd9cm_procedure_code: '93.71',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const domainTabs: { id: AssessmentDomain; label: string }[] = [
    { id: 'BICARA_ARTIKULASI', label: '1. Artikulasi (PCC)' },
    { id: 'OPE_OROMOTOR', label: '2. Oromotor & DDK' },
    { id: 'BAHASA', label: '3. Bahasa' },
    { id: 'SUARA_GRBAS', label: '4. Suara (GRBAS/MPT)' },
    { id: 'IRAMA_GAGAP', label: '5. Gagap (%SS)' },
    { id: 'MENELAN_IDDSI', label: '6. Disfagia (IDDSI)' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.headerTitle}>
        Instrumen Asesmen Terapi Wicara (Permenkes 81/2014)
      </Text>
      <Text style={styles.headerSub}>
        Pilih pasien & domain asesmen baku 5 ruang lingkup kompetensi IKATWI
      </Text>

      {/* Patient Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.patientTabs}>
        {patients.map((pt) => {
          const selected = pt.id === activePatient?.id;
          return (
            <Pressable
              key={pt.id}
              onPress={() => onSelectPatient(pt.id)}
              style={[styles.patientChip, selected && styles.patientChipActive]}
            >
              <Text style={[styles.patientChipName, selected && { color: '#FFFFFF' }]}>
                {pt.full_name}
              </Text>
              <Text style={[styles.patientChipSub, selected && { color: '#CCFBF1' }]}>
                {pt.medical_record_number} • {calculateAgeLabel(pt.birth_date)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Domain Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.domainScroll}>
        {domainTabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <Pressable
              key={tab.id}
              onPress={() => setActiveTab(tab.id)}
              style={[styles.domainBtn, active && styles.domainBtnActive]}
            >
              <Text style={[styles.domainBtnText, active && { color: '#FFFFFF' }]}>
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* TAB 1: ARTIKULASI & FONOLOGI (PCC) */}
      {activeTab === 'BICARA_ARTIKULASI' && (
        <View style={styles.panelCard}>
          <View style={styles.scoreBanner}>
            <View>
              <Text style={styles.scoreBannerLabel}>
                Percentage of Consonants Correct (PCC)
              </Text>
              <Text style={styles.scoreBannerSub}>
                Klasifikasi: {pccPercentage >= 85 ? 'Ringan' : pccPercentage >= 65 ? 'Ringan-Sedang' : pccPercentage >= 50 ? 'Sedang-Berat' : 'Berat'}
              </Text>
            </View>
            <Text style={styles.scoreBigValue}>{pccPercentage}%</Text>
          </View>

          {INDONESIAN_PHONEME_INVENTORY.map((item) => {
            const current = phonemeScores[item.phoneme] ?? 'BENAR';
            return (
              <View key={item.phoneme} style={styles.phonemeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.phonemeTitle}>
                    {item.phoneme}{' '}
                    <Text style={styles.phonemeManner}>({item.placeManner})</Text>
                  </Text>
                  <Text style={styles.phonemeWords}>
                    Awal: {item.sampleWords.awal} • Tengah: {item.sampleWords.tengah} • Akhir: {item.sampleWords.akhir}
                  </Text>
                </View>
                <View style={styles.scorePillsRow}>
                  {(['BENAR', 'SUBSTITUSI', 'OMISI', 'DISTORSI'] as ArticulationScore[]).map(
                    (sc) => {
                      const active = current === sc;
                      return (
                        <Pressable
                          key={sc}
                          onPress={() =>
                            setPhonemeScores((prev) => ({ ...prev, [item.phoneme]: sc }))
                          }
                          style={[
                            styles.miniScoreBtn,
                            active &&
                              (sc === 'BENAR'
                                ? { backgroundColor: '#059669', borderColor: '#059669' }
                                : { backgroundColor: '#DC2626', borderColor: '#DC2626' }),
                          ]}
                        >
                          <Text
                            style={[
                              styles.miniScoreText,
                              active && { color: '#FFFFFF' },
                            ]}
                          >
                            {sc.slice(0, 3)}
                          </Text>
                        </Pressable>
                      );
                    }
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* TAB 2: OROMOTOR (OPE) & DIADOKOKINETIK (AMR/SMR) */}
      {activeTab === 'OPE_OROMOTOR' && (
        <View style={styles.panelCard}>
          <Text style={styles.cardSectionTitle}>
            Pemeriksaan Mekanisme Oral-Fasial (OPE)
          </Text>

          <View style={styles.toggleFieldRow}>
            <Text style={styles.fieldLabel}>Penutupan Bibir (Lip Seal):</Text>
            <Pressable
              onPress={() =>
                setLipClosure((p) => (p === 'ADEKUAT' ? 'LEMAH' : 'ADEKUAT'))
              }
              style={styles.stateChip}
            >
              <Text style={styles.stateChipText}>{lipClosure}</Text>
            </Pressable>
          </View>

          <View style={styles.toggleFieldRow}>
            <Text style={styles.fieldLabel}>Elevasi & Lateralisasi Lidah:</Text>
            <Pressable
              onPress={() =>
                setTongueElevation((p) => (p === 'ADEKUAT' ? 'TERBATAS' : 'ADEKUAT'))
              }
              style={styles.stateChip}
            >
              <Text style={styles.stateChipText}>{tongueElevation}</Text>
            </Pressable>
          </View>

          <View style={styles.toggleFieldRow}>
            <Text style={styles.fieldLabel}>Fungsi Velofaringeal (Uvula/Palatum):</Text>
            <Pressable
              onPress={() =>
                setVelumMovement((p) => (p === 'SIMETRIS' ? 'HIPERNASAL' : 'SIMETRIS'))
              }
              style={styles.stateChip}
            >
              <Text style={styles.stateChipText}>{velumMovement}</Text>
            </Pressable>
          </View>

          <View style={styles.divider} />
          <Text style={styles.cardSectionTitle}>
            Kalkulator Diadokokinetik (SMR /pataka/)
          </Text>
          <Text style={styles.helperText}>
            Nyalakan timer lalu ketuk tombol setiap pasien memproduksi urutan /pa-ta-ka/.
          </Text>

          <View style={styles.stopwatchBox}>
            <View>
              <Text style={styles.timerReadout}>{ddkSeconds.toFixed(1)} dtk</Text>
              <Text style={styles.timerSub}>
                {ddkCount} repetisi • Kecepatan: {ddkRate} suku kata/dtk
              </Text>
            </View>
            <View style={styles.rowGap}>
              <Pressable
                style={[styles.roundBtn, ddkRunning && { backgroundColor: '#D97706' }]}
                onPress={() => setDdkRunning((r) => !r)}
              >
                {ddkRunning ? <Pause size={16} color="#FFF" /> : <Play size={16} color="#FFF" />}
              </Pressable>
              <Pressable
                style={styles.tapCountBtn}
                onPress={() => setDdkCount((c) => c + 1)}
              >
                <Text style={styles.tapCountBtnText}>+1 /pataka/</Text>
              </Pressable>
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  setDdkRunning(false);
                  setDdkCount(0);
                  setDdkSeconds(0);
                }}
              >
                <RotateCcw size={15} color="#475569" />
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* TAB 3: BAHASA RESEPTIF, EKSPRESIF & PRAGMATIK */}
      {activeTab === 'BAHASA' && (
        <View style={styles.panelCard}>
          <Text style={styles.cardSectionTitle}>
            Evaluasi Usia Bahasa Reseptif, Ekspresif & Pralinguistik
          </Text>
          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Usia Bahasa Reseptif (Bulan)</Text>
              <TextInput
                value={receptiveMonths}
                onChangeText={setReceptiveMonths}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>Usia Bahasa Ekspresif (Bulan)</Text>
              <TextInput
                value={expressiveMonths}
                onChangeText={setExpressiveMonths}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>
          </View>

          <Pressable
            onPress={() => setJointAttention((v) => !v)}
            style={styles.checkRow}
          >
            <CheckCircle2 size={18} color={jointAttention ? '#059669' : '#94A3B8'} />
            <Text style={styles.checkLabel}>
              Atensi Bersama (Joint Attention) & Kontak Mata Adekuat (&gt;5 detik)
            </Text>
          </Pressable>

          <Pressable
            onPress={() => setTwoStepCommand((v) => !v)}
            style={styles.checkRow}
          >
            <CheckCircle2 size={18} color={twoStepCommand ? '#059669' : '#94A3B8'} />
            <Text style={styles.checkLabel}>
              Memahami Instruksi Lisan 2 Tahap Tanpa Bantuan Gestur
            </Text>
          </Pressable>
        </View>
      )}

      {/* TAB 4: SUARA (GRBAS + STOPWATCH MPT) */}
      {activeTab === 'SUARA_GRBAS' && (
        <View style={styles.panelCard}>
          <Text style={styles.cardSectionTitle}>
            Skala Perseptual Suara GRBAS (0 = Normal, 3 = Berat)
          </Text>
          {(['G', 'R', 'B', 'A', 'S'] as const).map((param) => (
            <View key={param} style={styles.toggleFieldRow}>
              <Text style={styles.fieldLabel}>
                Parameter {param} (
                {param === 'G'
                  ? 'Grade'
                  : param === 'R'
                  ? 'Roughness'
                  : param === 'B'
                  ? 'Breathiness'
                  : param === 'A'
                  ? 'Asthenia'
                  : 'Strain'}
                )
              </Text>
              <View style={styles.rowGap}>
                {[0, 1, 2, 3].map((val) => (
                  <Pressable
                    key={val}
                    onPress={() => setGrbas((prev) => ({ ...prev, [param]: val }))}
                    style={[
                      styles.grbasNumBtn,
                      grbas[param] === val && { backgroundColor: '#0F766E' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.grbasNumText,
                        grbas[param] === val && { color: '#FFFFFF' },
                      ]}
                    >
                      {val}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.divider} />
          <Text style={styles.cardSectionTitle}>
            Maximum Phonation Time (MPT /a/) & Rasio S/Z
          </Text>
          <View style={styles.stopwatchBox}>
            <View>
              <View style={styles.rowGap}>
                <Mic size={16} color="#0F766E" />
                <Text style={styles.timerReadout}>{(mptTenths / 10).toFixed(1)} detik</Text>
              </View>
              <Text style={styles.timerSub}>Target dewasa &ge;15 dtk • Anak &ge;8 dtk</Text>
            </View>
            <View style={styles.rowGap}>
              <Pressable
                style={[styles.tapCountBtn, mptRunning && { backgroundColor: '#DC2626' }]}
                onPress={() => setMptRunning((r) => !r)}
              >
                <Text style={styles.tapCountBtnText}>
                  {mptRunning ? 'Stop Fonasi' : 'Mulai Fonasi /a/'}
                </Text>
              </Pressable>
              <Pressable
                style={styles.resetBtn}
                onPress={() => {
                  setMptRunning(false);
                  setMptTenths(0);
                }}
              >
                <RotateCcw size={15} color="#475569" />
              </Pressable>
            </View>
          </View>

          <Text style={styles.inputLabel}>Rasio S/Z (Indikasi patologi pita suara bila &gt;1.4)</Text>
          <TextInput
            value={szRatio}
            onChangeText={setSzRatio}
            keyboardType="decimal-pad"
            style={styles.textInput}
          />
        </View>
      )}

      {/* TAB 5: IRAMA KELANCARAN / GAGAP (%SS TALLY) */}
      {activeTab === 'IRAMA_GAGAP' && (
        <View style={styles.panelCard}>
          <View style={styles.scoreBanner}>
            <View>
              <Text style={styles.scoreBannerLabel}>
                Percentage of Syllables Stuttered (%SS)
              </Text>
              <Text style={styles.scoreBannerSub}>
                Total {totalSyllables} suku kata ({stutteredSyllables} gagap / disfluensi)
              </Text>
            </View>
            <Text style={styles.scoreBigValue}>{percentSS}%</Text>
          </View>

          <Text style={styles.helperText}>
            Ketuk layar secara real-time saat pasien berbicara/membaca sampel 100 suku kata:
          </Text>

          <View style={styles.fluencyPadsRow}>
            <Pressable
              style={styles.fluentPad}
              onPress={() => setFluentSyllables((c) => c + 1)}
            >
              <Text style={styles.padCount}>{fluentSyllables}</Text>
              <Text style={styles.padLabel}>+ Suku Kata Lancar</Text>
            </Pressable>

            <Pressable
              style={styles.stutterPad}
              onPress={() => setStutteredSyllables((c) => c + 1)}
            >
              <Text style={styles.padCount}>{stutteredSyllables}</Text>
              <Text style={styles.padLabel}>+ Disfluensi / Blok Gagap</Text>
            </Pressable>
          </View>

          <Pressable
            style={styles.resetInlineBtn}
            onPress={() => {
              setFluentSyllables(0);
              setStutteredSyllables(0);
            }}
          >
            <RotateCcw size={14} color="#64748B" />
            <Text style={styles.resetInlineText}>Reset Penghitung Suku Kata</Text>
          </Pressable>
        </View>
      )}

      {/* TAB 6: DISFAGIA / MENELAN (STANDAR IDDSI 0-7 & OXIMETRY SAFETY) */}
      {activeTab === 'MENELAN_IDDSI' && (
        <View style={styles.panelCard}>
          <View style={styles.dysphagiaSafetyNotice}>
            <ShieldAlert size={18} color="#991B1B" />
            <Text style={styles.dysphagiaSafetyText}>
              SOP Keselamatan Pasien: Posisi duduk 90°, pantau SpO2. Hentikan uji menelan bila SpO2 turun &ge;3% atau muncul batuk/suara basah (wet voice).
            </Text>
          </View>

          <View style={styles.twoColRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>SpO2 Awal (%)</Text>
              <TextInput
                value={spo2Before}
                onChangeText={setSpo2Before}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.inputLabel}>SpO2 Pasca Menelan (%)</Text>
              <TextInput
                value={spo2After}
                onChangeText={setSpo2After}
                keyboardType="numeric"
                style={styles.textInput}
              />
            </View>
          </View>

          {spo2Drop >= 3 && (
            <View style={styles.desatWarning}>
              <Activity size={16} color="#FFFFFF" />
              <Text style={styles.desatWarningText}>
                PERINGATAN DESATURASI OKSIGEN (-{spo2Drop}%): Risiko Aspirasi Senyap! Hentikan pemberian per-oral!
              </Text>
            </View>
          )}

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>
            Rekomendasi Kekentalan Cairan Aman (Standar IDDSI 0–4)
          </Text>
          {IDDSI_LEVELS.slice(0, 5).map((lvl) => (
            <Pressable
              key={lvl.level}
              onPress={() => setIddsiLiquid(lvl.level)}
              style={[
                styles.iddsiRow,
                iddsiLiquid === lvl.level && styles.iddsiRowSelected,
              ]}
            >
              <View style={[styles.iddsiBadge, { backgroundColor: lvl.color }]}>
                <Text style={styles.iddsiBadgeText}>IDDSI {lvl.level}</Text>
              </View>
              <Text style={styles.iddsiLabel}>{lvl.label}</Text>
            </Pressable>
          ))}

          <Text style={[styles.inputLabel, { marginTop: 10 }]}>
            Rekomendasi Tekstur Makanan Aman (Standar IDDSI 4–7)
          </Text>
          {IDDSI_LEVELS.slice(4).map((lvl) => (
            <Pressable
              key={`food-${lvl.level}`}
              onPress={() => setIddsiFood(lvl.level)}
              style={[
                styles.iddsiRow,
                iddsiFood === lvl.level && styles.iddsiRowSelected,
              ]}
            >
              <View style={[styles.iddsiBadge, { backgroundColor: lvl.color }]}>
                <Text style={styles.iddsiBadgeText}>IDDSI {lvl.level}</Text>
              </View>
              <Text style={styles.iddsiLabel}>{lvl.label}</Text>
            </Pressable>
          ))}

          <Pressable
            onPress={() => setCoughObserved((v) => !v)}
            style={styles.checkRow}
          >
            <CheckCircle2 size={18} color={coughObserved ? '#DC2626' : '#94A3B8'} />
            <Text style={styles.checkLabel}>Batuk / Tersedak Saat atau Pasca Menelan</Text>
          </Pressable>
          <Pressable
            onPress={() => setWetVoiceObserved((v) => !v)}
            style={styles.checkRow}
          >
            <CheckCircle2 size={18} color={wetVoiceObserved ? '#DC2626' : '#94A3B8'} />
            <Text style={styles.checkLabel}>Kualitas Suara Basah / Bergemericik (Wet Voice)</Text>
          </Pressable>
        </View>
      )}

      {/* Clinical Conclusion & TTE Submit */}
      <View style={styles.panelCard}>
        <Text style={styles.cardSectionTitle}>
          Kesimpulan Diagnosis Terapi Wicara & Rekomendasi RME
        </Text>
        <TextInput
          value={conclusion}
          onChangeText={setConclusion}
          multiline
          numberOfLines={3}
          style={[styles.textInput, { minHeight: 78, textAlignVertical: 'top' }]}
        />

        <Pressable
          disabled={submitting}
          onPress={handleSave}
          style={[styles.saveBtn, submitting && { opacity: 0.6 }]}
        >
          <Save size={16} color="#FFFFFF" />
          <Text style={styles.saveBtnText}>
            {submitting
              ? 'Menyimpan & Menandatangani...'
              : 'Simpan & TTE Asesmen ke Rekam Medis Elektronik'}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  content: { padding: 16, paddingBottom: 36 },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A' },
  headerSub: { fontSize: 12, color: '#64748B', marginTop: 2, marginBottom: 12 },
  patientTabs: { marginBottom: 10 },
  patientChip: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  patientChipActive: {
    backgroundColor: '#0F766E',
    borderColor: '#0F766E',
  },
  patientChipName: { fontSize: 13, fontWeight: '700', color: '#0F172A' },
  patientChipSub: { fontSize: 11, color: '#64748B', marginTop: 1 },
  domainScroll: { marginBottom: 12 },
  domainBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#E2E8F0',
    marginRight: 8,
  },
  domainBtnActive: { backgroundColor: '#0F172A' },
  domainBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  panelCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  scoreBanner: {
    backgroundColor: '#F0FDFA',
    borderRadius: 10,
    padding: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#99F6E4',
  },
  scoreBannerLabel: { fontSize: 13, fontWeight: '800', color: '#115E59' },
  scoreBannerSub: { fontSize: 11, color: '#0F766E', marginTop: 2 },
  scoreBigValue: { fontSize: 26, fontWeight: '900', color: '#0F766E' },
  phonemeRow: {
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  phonemeTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  phonemeManner: { fontSize: 11, fontWeight: '500', color: '#64748B' },
  phonemeWords: { fontSize: 11, color: '#475569', marginTop: 2 },
  scorePillsRow: { flexDirection: 'row', gap: 4 },
  miniScoreBtn: {
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  miniScoreText: { fontSize: 10, fontWeight: '800', color: '#334155' },
  cardSectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  toggleFieldRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  fieldLabel: { fontSize: 12, color: '#334155', fontWeight: '600', flex: 1 },
  stateChip: {
    backgroundColor: '#CCFBF1',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  stateChipText: { fontSize: 11, fontWeight: '800', color: '#115E59' },
  divider: { height: 1, backgroundColor: '#E2E8F0', marginVertical: 12 },
  helperText: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  stopwatchBox: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    flexWrap: 'wrap',
    gap: 8,
  },
  timerReadout: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  timerSub: { fontSize: 11, color: '#64748B', marginTop: 2 },
  rowGap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roundBtn: {
    backgroundColor: '#0F766E',
    padding: 10,
    borderRadius: 10,
  },
  tapCountBtn: {
    backgroundColor: '#0284C7',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tapCountBtnText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  resetBtn: {
    padding: 9,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
  },
  twoColRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#334155', marginBottom: 5 },
  textInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  checkLabel: { fontSize: 12, color: '#1E293B', flex: 1, fontWeight: '600' },
  grbasNumBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  grbasNumText: { fontSize: 12, fontWeight: '800', color: '#334155' },
  fluencyPadsRow: { flexDirection: 'row', gap: 10, marginVertical: 8 },
  fluentPad: {
    flex: 1,
    backgroundColor: '#059669',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
  },
  stutterPad: {
    flex: 1,
    backgroundColor: '#DC2626',
    borderRadius: 14,
    paddingVertical: 22,
    alignItems: 'center',
  },
  padCount: { color: '#FFFFFF', fontSize: 28, fontWeight: '900' },
  padLabel: { color: '#FFFFFF', fontSize: 12, fontWeight: '700', marginTop: 4 },
  resetInlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  resetInlineText: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  dysphagiaSafetyNotice: {
    flexDirection: 'row',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
    borderWidth: 1,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  dysphagiaSafetyText: { flex: 1, fontSize: 11, color: '#991B1B', fontWeight: '600' },
  desatWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    padding: 10,
    borderRadius: 8,
    marginBottom: 10,
  },
  desatWarningText: { color: '#FFFFFF', fontSize: 11, fontWeight: '800', flex: 1 },
  iddsiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 6,
  },
  iddsiRowSelected: {
    borderColor: '#0F766E',
    borderWidth: 2,
    backgroundColor: '#F0FDFA',
  },
  iddsiBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  iddsiBadgeText: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
  iddsiLabel: { fontSize: 12, color: '#1E293B', fontWeight: '600', flex: 1 },
  saveBtn: {
    marginTop: 12,
    backgroundColor: '#0F766E',
    borderRadius: 12,
    paddingVertical: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
});
