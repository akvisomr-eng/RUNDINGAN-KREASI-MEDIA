import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OFFLINE_FALLBACK_BOOTSTRAP } from '../data/clinicalCatalogs';
import { BootstrapClinicalData, OfflineSyncQueueItem } from '../types/clinical';

const STORAGE_CACHE_KEY = '@wicarasehat_rme_bootstrap_v1';
const STORAGE_QUEUE_KEY = '@wicarasehat_rme_offline_queue_v1';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const DEFAULT_EMPLOYEE_NUMBER =
  process.env.EXPO_PUBLIC_DEFAULT_EMPLOYEE_NUMBER ?? 'TW-2023-001';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return null;
  }
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabaseClient;
}

export async function loadOfflineQueue(): Promise<OfflineSyncQueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_QUEUE_KEY);
    return raw ? (JSON.parse(raw) as OfflineSyncQueueItem[]) : [];
  } catch {
    return [];
  }
}

async function saveOfflineQueue(queue: OfflineSyncQueueItem[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_QUEUE_KEY, JSON.stringify(queue));
}

export async function enqueueOfflineRecord(item: OfflineSyncQueueItem): Promise<number> {
  const queue = await loadOfflineQueue();
  queue.push(item);
  await saveOfflineQueue(queue);
  return queue.length;
}

export async function flushOfflineQueue(): Promise<{
  flushed: number;
  remaining: number;
}> {
  const client = getSupabaseClient();
  const queue = await loadOfflineQueue();
  if (!client || queue.length === 0) {
    return { flushed: 0, remaining: queue.length };
  }

  const remaining: OfflineSyncQueueItem[] = [];
  let flushed = 0;

  for (const item of queue) {
    try {
      const rpcName =
        item.type === 'SOAP'
          ? 'tw_android_submit_soap'
          : item.type === 'ASSESSMENT'
          ? 'tw_android_submit_assessment'
          : item.type === 'INTERPROF_REFERRAL'
          ? 'tw_android_submit_interprofessional_referral'
          : 'tw_android_log_ppi_or_ikp';

      const { error } = await client.rpc(rpcName, { p_payload: item.payload });
      if (error) {
        remaining.push(item);
      } else {
        flushed += 1;
      }
    } catch {
      remaining.push(item);
    }
  }

  await saveOfflineQueue(remaining);
  return { flushed, remaining: remaining.length };
}

export async function fetchClinicalBootstrap(
  employeeNumber: string = DEFAULT_EMPLOYEE_NUMBER,
  forceOffline: boolean = false
): Promise<{
  data: BootstrapClinicalData;
  source: 'CLOUD_SUPABASE_RME' | 'ENCRYPTED_LOCAL_CACHE';
  pendingQueueCount: number;
}> {
  const client = getSupabaseClient();

  if (!forceOffline && client) {
    try {
      await flushOfflineQueue();
      const { data, error } = await client.rpc('tw_android_fetch_bootstrap', {
        p_employee_number: employeeNumber,
      });

      if (!error && data) {
        const parsed = data as BootstrapClinicalData;
        await AsyncStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(parsed));
        const q = await loadOfflineQueue();
        return {
          data: parsed,
          source: 'CLOUD_SUPABASE_RME',
          pendingQueueCount: q.length,
        };
      }
    } catch {
      // Fall back cleanly to offline RME cache (e.g. inside soundproof therapy room)
    }
  }

  try {
    const cached = await AsyncStorage.getItem(STORAGE_CACHE_KEY);
    const q = await loadOfflineQueue();
    if (cached) {
      return {
        data: JSON.parse(cached) as BootstrapClinicalData,
        source: 'ENCRYPTED_LOCAL_CACHE',
        pendingQueueCount: q.length,
      };
    }
  } catch {
    // ignore storage read error
  }

  const q = await loadOfflineQueue();
  return {
    data: OFFLINE_FALLBACK_BOOTSTRAP,
    source: 'ENCRYPTED_LOCAL_CACHE',
    pendingQueueCount: q.length,
  };
}

export async function submitClinicalSoap(
  payload: Record<string, unknown>,
  forceOffline: boolean = false
): Promise<{ syncedToCloud: boolean; message: string }> {
  const client = getSupabaseClient();
  const offlineUuid =
    (payload.client_offline_uuid as string) ??
    `offline-soap-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const enriched = { ...payload, client_offline_uuid: offlineUuid };

  if (!forceOffline && client) {
    try {
      const { error } = await client.rpc('tw_android_submit_soap', {
        p_payload: enriched,
      });
      if (!error) {
        return {
          syncedToCloud: true,
          message:
            'CPPT SOAP berhasil dikunci dengan TTE (Permenkes 24/2022) & tersinkron ke Cloud RME / antrean SATUSEHAT.',
        };
      }
      throw new Error(error.message);
    } catch {
      // Fall through to offline sync queue
    }
  }

  await enqueueOfflineRecord({
    queueId: offlineUuid,
    type: 'SOAP',
    createdAt: new Date().toISOString(),
    payload: enriched,
  });

  return {
    syncedToCloud: false,
    message:
      'Ruang kedap suara / mode offline aktif: CPPT SOAP dikunci lokal & masuk Antrean Sinkronisasi Otomatis.',
  };
}

export async function submitClinicalAssessment(
  payload: Record<string, unknown>,
  forceOffline: boolean = false
): Promise<{ syncedToCloud: boolean; message: string }> {
  const client = getSupabaseClient();
  const queueId = `offline-assess-${Date.now()}`;

  if (!forceOffline && client) {
    try {
      const { error } = await client.rpc('tw_android_submit_assessment', {
        p_payload: payload,
      });
      if (!error) {
        return {
          syncedToCloud: true,
          message:
            'Instrumen Asesmen Terapi Wicara berhasil disimpan & ditandatangani elektronik di RME.',
        };
      }
    } catch {
      // queue offline
    }
  }

  await enqueueOfflineRecord({
    queueId,
    type: 'ASSESSMENT',
    createdAt: new Date().toISOString(),
    payload,
  });

  return {
    syncedToCloud: false,
    message: 'Asesmen tersimpan di brankas Offline RME & akan disinkronkan saat online.',
  };
}

export async function submitPpiOrIncidentLog(
  payload: Record<string, unknown>,
  forceOffline: boolean = false
): Promise<{ syncedToCloud: boolean; message: string }> {
  const client = getSupabaseClient();
  const queueId = `offline-ppi-${Date.now()}`;

  if (!forceOffline && client) {
    try {
      const { error } = await client.rpc('tw_android_log_ppi_or_ikp', {
        p_payload: payload,
      });
      if (!error) {
        return {
          syncedToCloud: true,
          message: 'Log Kepatuhan PPI / Insiden Keselamatan Pasien tercatat di server mutu klinik.',
        };
      }
    } catch {
      // queue offline
    }
  }

  await enqueueOfflineRecord({
    queueId,
    type: 'PPI_IKP',
    createdAt: new Date().toISOString(),
    payload,
  });

  return {
    syncedToCloud: false,
    message: 'Log PPI/IKP tersimpan di antrean perangkat lokal.',
  };
}

export async function submitInterprofessionalReferral(
  payload: Record<string, unknown>,
  forceOffline: boolean = false
): Promise<{ syncedToCloud: boolean; message: string }> {
  const client = getSupabaseClient();
  const queueId = `offline-ref-${Date.now()}`;

  if (!forceOffline && client) {
    try {
      const { error } = await client.rpc(
        'tw_android_submit_interprofessional_referral',
        { p_payload: payload }
      );
      if (!error) {
        return {
          syncedToCloud: true,
          message:
            'Rujukan Kolaborasi Interprofesional (PKP) terkirim ke tim spesialis & Enterprise HQ.',
        };
      }
    } catch {
      // queue offline
    }
  }

  await enqueueOfflineRecord({
    queueId,
    type: 'INTERPROF_REFERRAL',
    createdAt: new Date().toISOString(),
    payload,
  });

  return {
    syncedToCloud: false,
    message:
      'Rujukan kolaborasi interprofesional masuk antrean Offline Sync & akan terkirim otomatis.',
  };
}
