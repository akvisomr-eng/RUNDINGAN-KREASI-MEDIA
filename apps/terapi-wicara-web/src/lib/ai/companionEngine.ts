/**
 * AI Companion Engine — orkestrasi jawaban chatbot.
 *
 * Alur:
 *   1. Cari di pengetahuan lokal (selalu tersedia, offline-first).
 *   2. Bila online, periksa cache pembelajaran (localStorage) lalu RPC Supabase
 *      `tw_ai_kb_search` untuk pengetahuan hasil pembelajaran/riset agen.
 *   3. Gabungkan hasil, susun jawaban dengan sitasi regulasi.
 *   4. Bila tidak ada yang cocok, catat "knowledge gap" dan minta bantuan
 *      Agen Riset (tw_ai_report_knowledge_gap) agar pengetahuan bertambah.
 *   5. Simpan transkrip (tw_ai_log_conversation) untuk audit & pembelajaran.
 *
 * Prinsip: AI tidak pernah mengarang nomor rekam medis, diagnosis, atau tarif
 * di luar basis pengetahuan. Bila ragu, sistem mengarahkan ke petugas manusia.
 */

import { getBrowserSupabase } from '../supabaseClient';
import {
  KnowledgeEntry,
  LOCAL_KNOWLEDGE,
  searchKnowledge,
  tokenize,
} from './knowledgeSeed';

const LEARNED_CACHE_KEY = 'wicarasehat.ai.learned_knowledge.v1';
const SESSION_KEY = 'wicarasehat.ai.session_token';
const MAX_LEARNED_CACHE = 120;

export type AnswerSource = 'KB_LOKAL' | 'KB_PEMBELAJARAN' | 'ESKALASI_HUMAN' | 'TIDAK_DITEMUKAN';

export interface CompanionCitation {
  id: string;
  title: string;
  regulationReference?: string;
  category: string;
  sourceKind: string;
  confidence: number;
}

export interface CompanionAnswer {
  text: string;
  citations: CompanionCitation[];
  source: AnswerSource;
  confidence: number;
  intent: string;
  suggestedFollowUps: string[];
  online: boolean;
  responseMs: number;
}

/* -------------------------------------------------------------------------- */
/* Cache pembelajaran lokal                                                    */
/* -------------------------------------------------------------------------- */

interface LearnedCache {
  entries: KnowledgeEntry[];
  lastSyncAt: string | null;
}

export function readLearnedCache(): LearnedCache {
  if (typeof window === 'undefined') return { entries: [], lastSyncAt: null };
  try {
    const raw = window.localStorage.getItem(LEARNED_CACHE_KEY);
    if (!raw) return { entries: [], lastSyncAt: null };
    const parsed = JSON.parse(raw) as LearnedCache;
    return { entries: parsed.entries ?? [], lastSyncAt: parsed.lastSyncAt ?? null };
  } catch {
    return { entries: [], lastSyncAt: null };
  }
}

function writeLearnedCache(entries: KnowledgeEntry[]) {
  if (typeof window === 'undefined') return;
  try {
    const dedup = new Map<string, KnowledgeEntry>();
    for (const e of entries) dedup.set(e.id, e);
    const list = Array.from(dedup.values()).slice(0, MAX_LEARNED_CACHE);
    window.localStorage.setItem(
      LEARNED_CACHE_KEY,
      JSON.stringify({ entries: list, lastSyncAt: new Date().toISOString() })
    );
  } catch {
    /* kuota penuh — abaikan, pengetahuan lokal tetap berfungsi */
  }
}

export function mergeLearned(entries: KnowledgeEntry[]) {
  if (!entries.length) return;
  const current = readLearnedCache().entries;
  writeLearnedCache([...entries, ...current]);
}

/* -------------------------------------------------------------------------- */
/* Sesi percakapan                                                             */
/* -------------------------------------------------------------------------- */

export function getSessionToken(): string {
  if (typeof window === 'undefined') return 'server';
  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) return existing;
  const token = `sesi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_KEY, token);
  return token;
}

/* -------------------------------------------------------------------------- */
/* Klasifikasi intent sederhana                                                */
/* -------------------------------------------------------------------------- */

const INTENT_RULES: Array<{ intent: string; terms: string[] }> = [
  { intent: 'TARIF_BIAYA', terms: ['tarif', 'biaya', 'harga', 'bayar', 'paket', 'qris', 'mahal'] },
  { intent: 'PENDAFTARAN', terms: ['daftar', 'booking', 'jadwal', 'reservasi', 'antrean', 'slot'] },
  { intent: 'KLINIS_ANAK', terms: ['anak', 'bicara', 'gagap', 'terlambat', 'speech', 'artikulasi', 'bahasa'] },
  { intent: 'KLINIS_MENELAN', terms: ['menelan', 'disfagia', 'iddsi', 'tersedak', 'aspirasi'] },
  { intent: 'KLINIS_SUARA', terms: ['suara', 'serak', 'grbas', 'mpt', 'parau'] },
  { intent: 'REGULASI_PRIVASI', terms: ['privasi', 'pdp', 'aman', 'rekam medis', 'nik', 'audit', 'hak'] },
  { intent: 'PORTAL_PASIEN', terms: ['portal', 'login', 'masuk', 'akun', 'password'] },
  { intent: 'ASURANSI', terms: ['asuransi', 'bpjs', 'jaminan', 'klaim', 'tanggungan'] },
  { intent: 'LOKASI_KONTAK', terms: ['lokasi', 'alamat', 'dimana', 'telepon', 'kontak', 'jam', 'buka'] },
  { intent: 'SISTEM_AI', terms: ['agen', 'ai', 'sistem', 'otomatis', 'chatbot'] },
];

function classifyIntent(query: string): string {
  const lower = query.toLowerCase();
  let best = { intent: 'UMUM', hits: 0 };
  for (const rule of INTENT_RULES) {
    const hits = rule.terms.reduce((n, t) => (lower.includes(t) ? n + 1 : n), 0);
    if (hits > best.hits) best = { intent: rule.intent, hits };
  }
  return best.intent;
}

/* -------------------------------------------------------------------------- */
/* Penyusunan jawaban                                                          */
/* -------------------------------------------------------------------------- */

const GREETING = /^(halo|hai|hi|selamat (pagi|siang|sore|malam)|assalam)/i;

function buildFollowUps(intent: string): string[] {
  const map: Record<string, string[]> = {
    TARIF_BIAYA: ['Apakah ada paket sesi yang lebih hemat?', 'Apakah bisa ditanggung asuransi?', 'Bagaimana cara membayar?'],
    PENDAFTARAN: ['Apa dokumen yang harus dibawa?', 'Berapa lama menunggu jadwal?', 'Bagaimana cara membatalkan jadwal?'],
    KLINIS_ANAK: ['Kapan anak perlu skrining tumbuh kembang?', 'Latihan apa yang bisa dilakukan di rumah?', 'Berapa lama terapi biasanya berlangsung?'],
    KLINIS_MENELAN: ['Apa standar IDDSI itu?', 'Bagaimana penanganan aspirasi?', 'Apakah klinik melayani pasien dewasa?'],
    KLINIS_SUARA: ['Bagaimana penilaian suara dengan GRBAS?', 'Berapa nilai MPT normal?', 'Latihan apa untuk menjaga suara?'],
    REGULASI_PRIVASI: ['Berapa lama rekam medis disimpan?', 'Apakah data saya dikirim ke SATUSEHAT?', 'Apa hak saya sebagai pasien?'],
    PORTAL_PASIEN: ['Bagaimana kalau lupa nomor rekam medis?', 'Apa saja isi Portal Pasien?'],
    ASURANSI: ['Dokumen apa yang diperlukan untuk klaim?', 'Berapa biaya sesi reguler?'],
    LOKASI_KONTAK: ['Bagaimana cara membuat janji?', 'Kapan jam pendaftaran?'],
    SISTEM_AI: ['Agen apa saja yang aktif?', 'Bagaimana keamanan data dijaga?'],
  };
  return map[intent] ?? ['Bagaimana cara mendaftar?', 'Berapa biaya terapi?', 'Di mana lokasi klinik?'];
}

function composeAnswer(
  query: string,
  matches: Array<{ entry: KnowledgeEntry; score: number }>,
  intent: string,
  online: boolean
): CompanionAnswer {
  const startedAt = Date.now();

  if (!matches.length) {
    return {
      text:
        'Maaf, saya belum memiliki informasi terpercaya untuk pertanyaan itu agar tidak memberikan jawaban yang keliru. ' +
        'Pertanyaan Anda sudah saya catat dan akan diriset oleh Agen Peneliti kami agar pengetahuan saya bertambah. ' +
        'Sementara itu, Anda dapat menghubungi petugas klinik di (0354) 689420 atau melalui formulir Booking Online.',
      citations: [],
      source: 'TIDAK_DITEMUKAN',
      confidence: 0.2,
      intent,
      suggestedFollowUps: buildFollowUps(intent),
      online,
      responseMs: Date.now() - startedAt,
    };
  }

  const top = matches[0].entry;
  const supporting = matches.slice(1, 3);
  const parts: string[] = [top.content.trim()];

  if (supporting.length) {
    parts.push(
      'Informasi pendukung: ' +
        supporting.map((m) => `“${m.entry.title}”`).join(' dan ') +
        ' juga tersedia dan dapat ditanyakan lebih lanjut.'
    );
  }

  if (top.regulationReference) {
    parts.push(`Rujukan regulasi: ${top.regulationReference}.`);
  }
  parts.push('Apakah informasi ini menjawab pertanyaan Anda? Anda dapat bertanya lanjutan kapan saja.');

  const confidence = Math.min(
    0.98,
    0.6 + matches[0].score * 0.03 + (top.sourceKind === 'SEED_LOKAL' ? 0.15 : 0.05)
  );

  return {
    text: parts.join(' '),
    citations: matches.map((m) => ({
      id: m.entry.id,
      title: m.entry.title,
      regulationReference: m.entry.regulationReference,
      category: m.entry.category,
      sourceKind: m.entry.sourceKind,
      confidence: m.entry.confidence,
    })),
    source: top.sourceKind === 'SEED_LOKAL' ? 'KB_LOKAL' : 'KB_PEMBELAJARAN',
    confidence: Number(confidence.toFixed(3)),
    intent,
    suggestedFollowUps: buildFollowUps(intent),
    online,
    responseMs: Date.now() - startedAt,
  };
}

/* -------------------------------------------------------------------------- */
/* API utama                                                                   */
/* -------------------------------------------------------------------------- */

export interface AskOptions {
  pageContext?: string;
  channel?: 'WEBSITE_PUBLIK' | 'PORTAL_PASIEN' | 'SIMKLINIK' | 'ENTERPRISE_HQ';
  /** Lewati panggilan jaringan (dipakai saat offline terdeteksi). */
  forceOffline?: boolean;
}

export async function askCompanion(
  query: string,
  options: AskOptions = {}
): Promise<CompanionAnswer> {
  const startedAt = Date.now();
  const trimmed = query.trim();

  if (!trimmed) {
    return {
      text: 'Silakan tuliskan pertanyaan Anda.',
      citations: [],
      source: 'TIDAK_DITEMUKAN',
      confidence: 0,
      intent: 'UMUM',
      suggestedFollowUps: buildFollowUps('UMUM'),
      online: false,
      responseMs: 0,
    };
  }

  const intent = classifyIntent(trimmed);

  if (GREETING.test(trimmed) && trimmed.length < 40) {
    return {
      text:
        'Halo! Saya Wicara, asisten AI Klinik Terapi Wicara WicaraSehat. Saya bisa membantu menjawab pertanyaan tentang layanan, jadwal, tarif, tumbuh kembang bicara anak, disfagia, serta keamanan rekam medis. Apa yang ingin Anda ketahui?',
      citations: [],
      source: 'KB_LOKAL',
      confidence: 0.99,
      intent: 'SALAM',
      suggestedFollowUps: buildFollowUps('UMUM'),
      online: false,
      responseMs: Date.now() - startedAt,
    };
  }

  // 1. Pencarian lokal (selalu jalan, offline-first)
  const learned = readLearnedCache().entries;
  const corpus = [...LOCAL_KNOWLEDGE, ...learned];
  let matches = searchKnowledge(trimmed, corpus, 4);
  let online = false;

  // 2. Pengayaan online via Supabase
  const supabase = options.forceOffline ? null : getBrowserSupabase();
  if (supabase) {
    try {
      const { data, error } = await supabase.rpc('tw_ai_kb_search', {
        p_query: trimmed,
        p_limit: 4,
      });
      if (!error && data?.matches) {
        online = true;
        const remote: Array<{ entry: KnowledgeEntry; score: number }> = (
          data.matches as Array<Record<string, unknown>>
        ).map((m) => ({
          entry: {
            id: String(m.id),
            topic: String(m.topic ?? ''),
            category: (m.category as KnowledgeEntry['category']) ?? 'FAQ',
            title: String(m.title),
            content: String(m.content),
            keywords: tokenize(String(m.title)),
            regulationReference: m.regulation_reference
              ? String(m.regulation_reference)
              : undefined,
            sourceKind: (m.source_kind as KnowledgeEntry['sourceKind']) ?? 'PEMBELAJARAN_WEB',
            sourceUrl: m.source_url ? String(m.source_url) : undefined,
            confidence: Number(m.confidence ?? 0.9),
            updatedAt: new Date().toISOString(),
          },
          score: Number(m.score ?? 0) + 2, // sedikit diprioritaskan: hasil terkurasi server
        }));

        // Simpan hasil server sebagai pembelajaran lokal untuk sesi offline berikutnya
        if (remote.length) {
          mergeLearned(remote.map((r) => r.entry));
        }

        const known = new Set(matches.map((m) => m.entry.id));
        matches = [...matches, ...remote.filter((r) => !known.has(r.entry.id))]
          .sort((a, b) => b.score - a.score)
          .slice(0, 4);
      }
    } catch {
      online = false;
    }
  }

  const answer = composeAnswer(trimmed, matches, intent, online);
  answer.responseMs = Date.now() - startedAt;

  // 3. Telemetri & pembelajaran (tidak memblokir UI)
  if (supabase) {
    const token = getSessionToken();
    void (async () => {
      try {
        await supabase.rpc('tw_ai_log_conversation', {
          p_session_token: token,
          p_role: 'PENGGUNA',
          p_message: trimmed,
          p_intent: answer.intent,
          p_channel: options.channel ?? 'WEBSITE_PUBLIK',
          p_page_context: options.pageContext ?? null,
        });
        await supabase.rpc('tw_ai_log_conversation', {
          p_session_token: token,
          p_role: 'ASISTEN',
          p_message: answer.text,
          p_cited: answer.citations
            .map((c) => c.id)
            .filter((id) => /^[0-9a-f-]{36}$/i.test(id)),
          p_intent: answer.intent,
          p_confidence: answer.confidence,
          p_answer_source: answer.source,
          p_response_ms: answer.responseMs,
          p_channel: options.channel ?? 'WEBSITE_PUBLIK',
          p_page_context: options.pageContext ?? null,
        });
        if (answer.source === 'TIDAK_DITEMUKAN') {
          await supabase.rpc('tw_ai_report_knowledge_gap', {
            p_question: trimmed,
            p_intent: answer.intent,
          });
        }
      } catch {
        /* offline / RLS — abaikan, tidak mengganggu pengguna */
      }
    })();
  }

  return answer;
}

/** Pemanasan cache: ambil pengetahuan terbaru dari server saat online. */
export async function syncKnowledgeFromServer(): Promise<{ synced: number; online: boolean }> {
  const supabase = getBrowserSupabase();
  if (!supabase) return { synced: 0, online: false };
  try {
    const { data, error } = await supabase.rpc('tw_crud_list', {
      p_table: 'ai_knowledge_base',
      p_limit: 100,
    });
    if (error || !data?.rows) return { synced: 0, online: false };
    const entries: KnowledgeEntry[] = (data.rows as Array<Record<string, unknown>>).map((r) => ({
      id: String(r.id),
      topic: String(r.topic ?? ''),
      subtopic: r.subtopic ? String(r.subtopic) : undefined,
      category: (r.category as KnowledgeEntry['category']) ?? 'FAQ',
      title: String(r.title),
      content: String(r.content),
      keywords: Array.isArray(r.keywords) ? (r.keywords as string[]) : [],
      regulationReference: r.regulation_reference ? String(r.regulation_reference) : undefined,
      sourceKind: (r.source_kind as KnowledgeEntry['sourceKind']) ?? 'PEMBELAJARAN_WEB',
      sourceUrl: r.source_url ? String(r.source_url) : undefined,
      confidence: Number(r.confidence ?? 0.9),
      updatedAt: String(r.updated_at ?? new Date().toISOString()),
    }));
    mergeLearned(entries);
    return { synced: entries.length, online: true };
  } catch {
    return { synced: 0, online: false };
  }
}
