'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  BookOpen,
  Check,
  Loader2,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import {
  askCompanion,
  CompanionAnswer,
  readLearnedCache,
  syncKnowledgeFromServer,
} from '../lib/ai/companionEngine';
import { LOCAL_KNOWLEDGE } from '../lib/ai/knowledgeSeed';

interface ChatTurn {
  id: string;
  role: 'user' | 'bot';
  text: string;
  answer?: CompanionAnswer;
}

const QUICK_QUESTIONS = [
  'Berapa biaya satu sesi terapi?',
  'Bagaimana cara mendaftar dan buat jadwal?',
  'Kapan anak dianggap terlambat bicara?',
  'Apakah data rekam medis saya aman?',
  'Apakah terapi ditanggung BPJS?',
  'Di mana lokasi dan jam buka klinik?',
];

export default function AiCompanionWidget() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(false);
  const [learnedCount, setLearnedCount] = useState(LOCAL_KNOWLEDGE.length);
  const [turns, setTurns] = useState<ChatTurn[]>([
    {
      id: 'greet',
      role: 'bot',
      text:
        'Selamat datang di WicaraSehat! Saya Wicara, asisten AI klinik. Saya menguasai pengetahuan lokal tentang layanan, tarif, jadwal, tumbuh kembang bicara anak, disfagia, dan keamanan rekam medis. Silakan bertanya, atau pilih salah satu topik di bawah.',
    },
  ]);
  const [unanswered, setUnanswered] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const update = () => setOnline(typeof navigator !== 'undefined' ? navigator.onLine : false);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const cached = readLearnedCache();
    setLearnedCount(LOCAL_KNOWLEDGE.length + cached.entries.length);
    void syncKnowledgeFromServer().then((res) => {
      if (res.online) {
        setOnline(true);
        setLearnedCount(LOCAL_KNOWLEDGE.length + readLearnedCache().entries.length);
      }
    });
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [turns, busy]);

  async function submit(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    setInput('');
    setBusy(true);
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: question },
    ]);

    try {
      const answer = await askCompanion(question, {
        pageContext: typeof window !== 'undefined' ? window.location.pathname : undefined,
        channel: 'WEBSITE_PUBLIK',
      });
      if (answer.source === 'TIDAK_DITEMUKAN') setUnanswered((n) => n + 1);
      else setLearnedCount(LOCAL_KNOWLEDGE.length + readLearnedCache().entries.length);
      setTurns((prev) => [
        ...prev,
        { id: `b-${Date.now()}`, role: 'bot', text: answer.text, answer },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        {
          id: `b-${Date.now()}`,
          role: 'bot',
          text:
            'Koneksi sedang terganggu, namun pengetahuan lokal saya tetap aktif. Silakan coba lagi, atau hubungi petugas klinik di (0354) 689420.',
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Tombol mengambang */}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="ai-launcher"
          aria-label="Buka asisten AI Wicara"
        >
          <span className="ai-launcher-pulse" />
          <Bot size={22} />
          <span className="ai-launcher-label">Tanya Wicara AI</span>
        </button>
      )}

      {open && (
        <div className="ai-panel" role="dialog" aria-label="Asisten AI Wicara">
          <header className="ai-panel-head">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="ai-avatar">
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
                  Wicara — AI Companion
                </div>
                <div
                  style={{
                    fontSize: 11,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    color: online ? '#059669' : '#b45309',
                  }}
                >
                  {online ? <Wifi size={11} /> : <WifiOff size={11} />}
                  {online ? 'Terhubung — pengetahuan diperkaya' : 'Mode lokal (offline)'}
                  <span style={{ color: '#94a3b8' }}>•</span>
                  <BookOpen size={11} />
                  {learnedCount} pengetahuan
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ai-icon-btn"
              aria-label="Tutup"
            >
              <X size={18} />
            </button>
          </header>

          <div className="ai-panel-body" ref={scrollRef}>
            {turns.map((turn) => (
              <div key={turn.id} className={`ai-msg ${turn.role === 'user' ? 'ai-msg-user' : 'ai-msg-bot'}`}>
                <div className="ai-bubble">{turn.text}</div>

                {turn.answer && turn.answer.citations.length > 0 && (
                  <div className="ai-cites">
                    <div className="ai-cites-title">
                      <ShieldCheck size={11} /> Sumber terverifikasi
                    </div>
                    {turn.answer.citations.map((c) => (
                      <div key={c.id} className="ai-cite">
                        <strong>{c.title}</strong>
                        {c.regulationReference && <span> — {c.regulationReference}</span>}
                      </div>
                    ))}
                    <div className="ai-meta">
                      Keyakinan {Math.round(turn.answer.confidence * 100)}% •{' '}
                      {turn.answer.source === 'KB_LOKAL' ? 'Pengetahuan lokal' : 'Pengetahuan pembelajaran'}
                      {turn.answer.online ? ' • sinkron daring' : ''}
                    </div>
                  </div>
                )}

                {turn.answer && turn.answer.suggestedFollowUps.length > 0 && turn.role === 'bot' && (
                  <div className="ai-followups">
                    {turn.answer.suggestedFollowUps.slice(0, 3).map((f) => (
                      <button key={f} type="button" onClick={() => void submit(f)} className="ai-chip">
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="ai-msg ai-msg-bot">
                <div className="ai-bubble ai-typing">
                  <Loader2 size={14} className="ai-spin" /> Mencari di basis pengetahuan…
                </div>
              </div>
            )}

            {turns.length <= 1 && (
              <div className="ai-quick">
                <div className="ai-quick-title">
                  <Sparkles size={12} /> Pertanyaan yang sering diajukan
                </div>
                {QUICK_QUESTIONS.map((q) => (
                  <button key={q} type="button" className="ai-chip" onClick={() => void submit(q)}>
                    {q}
                  </button>
                ))}
              </div>
            )}

            {unanswered > 0 && (
              <div className="ai-gapnote">
                <Check size={12} /> {unanswered} pertanyaan dicatat untuk diriset Agen Peneliti agar
                pengetahuan saya bertambah.
              </div>
            )}
          </div>

          <form
            className="ai-panel-foot"
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tulis pertanyaan Anda…"
              className="ai-input"
              aria-label="Pertanyaan"
            />
            <button type="submit" className="ai-send" disabled={busy || !input.trim()}>
              {busy ? <Loader2 size={16} className="ai-spin" /> : <Send size={16} />}
            </button>
          </form>

          <div className="ai-disclaimer">
            <MessageCircle size={10} /> Asisten AI tidak menggantikan pemeriksaan klinis. Untuk keadaan
            darurat, hubungi (0354) 689420.
          </div>
        </div>
      )}
    </>
  );
}
