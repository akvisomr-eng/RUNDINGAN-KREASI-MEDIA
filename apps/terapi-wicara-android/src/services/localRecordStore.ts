import AsyncStorage from '@react-native-async-storage/async-storage';
import { OfflineSyncQueueItem } from '../types/clinical';

/**
 * Penyimpanan lokal catatan klinis yang sudah diisi terapis di perangkat.
 *
 * Tujuan: aplikasi terasa seperti aplikasi sungguhan — data yang diisi tetap ada
 * setelah aplikasi ditutup, dapat dilihat di tab Riwayat, dan tetap dapat
 * dibuka saat offline (ruang kedap suara).
 */

const STORAGE_RECORDS_KEY = '@wicarasehat_rme_records_v1';
const STORAGE_PROFILE_KEY = '@wicarasehat_terapis_profile_v1';

export type LocalRecordKind = 'SOAP' | 'ASESMEN' | 'PPI' | 'IKP' | 'RUJUKAN';

export interface LocalClinicalRecord {
  id: string;
  kind: LocalRecordKind;
  patient_id: string;
  patient_name: string;
  medical_record_number: string;
  therapist_name: string;
  title: string;
  summary: string;
  /** true bila sudah terkirim ke server (Supabase) */
  synced: boolean;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface TherapistProfile {
  employee_number: string;
  full_name: string;
  degree_title: string;
  sip_number: string;
  str_number: string;
  pin_set: boolean;
  biometric_enabled: boolean;
  last_login_at: string | null;
}

export const DEFAULT_PROFILE: TherapistProfile = {
  employee_number: 'TW-2023-001',
  full_name: 'Nadia Pramesti, S.Tr.Kes',
  degree_title: 'S.Tr.Kes (Terapis Wicara)',
  sip_number: 'SIP/TW/442.8/2025-001',
  str_number: 'STR-TW-2023-00184',
  pin_set: false,
  biometric_enabled: true,
  last_login_at: null,
};

/* -------------------------------------------------------------------------- */
/* Catatan klinis                                                              */
/* -------------------------------------------------------------------------- */

export async function loadRecords(): Promise<LocalClinicalRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_RECORDS_KEY);
    return raw ? (JSON.parse(raw) as LocalClinicalRecord[]) : [];
  } catch {
    return [];
  }
}

async function persist(records: LocalClinicalRecord[]): Promise<void> {
  // Simpan maksimal 300 catatan terakhir agar perangkat tidak penuh.
  await AsyncStorage.setItem(STORAGE_RECORDS_KEY, JSON.stringify(records.slice(0, 300)));
}

export async function addRecord(
  record: Omit<LocalClinicalRecord, 'id' | 'created_at'>
): Promise<LocalClinicalRecord> {
  const full: LocalClinicalRecord = {
    ...record,
    id: `rec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    created_at: new Date().toISOString(),
  };
  const existing = await loadRecords();
  await persist([full, ...existing]);
  return full;
}

export async function markRecordSynced(id: string): Promise<void> {
  const existing = await loadRecords();
  await persist(existing.map((r) => (r.id === id ? { ...r, synced: true } : r)));
}

export async function markAllSynced(): Promise<void> {
  const existing = await loadRecords();
  await persist(existing.map((r) => ({ ...r, synced: true })));
}

export async function deleteRecord(id: string): Promise<void> {
  const existing = await loadRecords();
  await persist(existing.filter((r) => r.id !== id));
}

export async function clearRecords(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_RECORDS_KEY);
}

/* -------------------------------------------------------------------------- */
/* Profil terapis & PIN                                                        */
/* -------------------------------------------------------------------------- */

export async function loadProfile(): Promise<TherapistProfile> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_PROFILE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...(JSON.parse(raw) as Partial<TherapistProfile>) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export async function saveProfile(profile: TherapistProfile): Promise<void> {
  await AsyncStorage.setItem(STORAGE_PROFILE_KEY, JSON.stringify(profile));
}

/* -------------------------------------------------------------------------- */
/* Statistik ringkas untuk dasbor                                              */
/* -------------------------------------------------------------------------- */

export interface RecordStats {
  total: number;
  synced: number;
  pending: number;
  soap: number;
  asesmen: number;
  ppi: number;
  ikp: number;
  rujukan: number;
  today: number;
}

export function summarize(records: LocalClinicalRecord[]): RecordStats {
  const todayKey = new Date().toISOString().slice(0, 10);
  return {
    total: records.length,
    synced: records.filter((r) => r.synced).length,
    pending: records.filter((r) => !r.synced).length,
    soap: records.filter((r) => r.kind === 'SOAP').length,
    asesmen: records.filter((r) => r.kind === 'ASESMEN').length,
    ppi: records.filter((r) => r.kind === 'PPI').length,
    ikp: records.filter((r) => r.kind === 'IKP').length,
    rujukan: records.filter((r) => r.kind === 'RUJUKAN').length,
    today: records.filter((r) => r.created_at.slice(0, 10) === todayKey).length,
  };
}

const QUEUE_KIND_MAP: Record<OfflineSyncQueueItem['type'], LocalRecordKind> = {
  SOAP: 'SOAP',
  ASSESSMENT: 'ASESMEN',
  PPI_IKP: 'PPI',
  INTERPROF_REFERRAL: 'RUJUKAN',
};

/** Ubah antrean sinkronisasi offline menjadi catatan yang dapat ditampilkan. */
export function queueToRecords(queue: OfflineSyncQueueItem[]): LocalClinicalRecord[] {
  return queue.map((q) => {
    const payload = q.payload as Record<string, unknown>;
    return {
      id: q.queueId,
      kind: QUEUE_KIND_MAP[q.type] ?? 'SOAP',
      patient_id: String(payload.patient_id ?? ''),
      patient_name: String(payload.patient_name ?? ''),
      medical_record_number: String(payload.medical_record_number ?? ''),
      therapist_name: String(payload.therapist_name ?? ''),
      title:
        q.type === 'SOAP'
          ? `SOAP — ${String(payload.target_skill ?? 'Sesi terapi')}`
          : q.type === 'ASSESSMENT'
          ? `Asesmen — ${String(payload.domain ?? 'Domain klinis')}`
          : q.type === 'PPI_IKP'
          ? `PPI / IKP — ${String(payload.log_type ?? 'Log kepatuhan')}`
          : `Rujukan — ${String(payload.to_profession ?? 'Interprofesional')}`,
      summary: 'Menunggu sinkronisasi ke server RME',
      synced: false,
      created_at: q.createdAt,
      payload,
    };
  });
}
