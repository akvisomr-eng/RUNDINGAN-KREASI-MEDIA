"use client";

import { useEffect, useMemo, useState } from 'react';

type Post = {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  status: string;
  seo_title: string;
  seo_description: string;
  focus_keyword: string;
  updated_at: string;
};

type Finding = {
  agent: string;
  score: number;
  status: 'good' | 'warning' | 'needs_work';
  summary: string;
  recommendations: string[];
};

type Report = {
  score: number;
  status: string;
  agents: Finding[];
  disclaimer: string;
};

const emptyForm = {
  title: '', slug: '', excerpt: '', content: '',
  seoTitle: '', seoDescription: '', focusKeyword: '',
};

export default function CmsWorkspace({
  userName, canCreate, canUpdate, canAudit, canPublish,
}: { userName: string; canCreate: boolean; canUpdate: boolean; canAudit: boolean; canPublish: boolean }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const wordCount = useMemo(() => form.content.trim() ? form.content.trim().split(/\s+/).length : 0, [form.content]);

  async function loadPosts() {
    setLoading(true);
    try {
      const response = await fetch('/api/cms/posts', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Tidak dapat memuat artikel.');
      setPosts(data.posts || []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Terjadi kesalahan.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void loadPosts(); }, []);

  function updateField(key: keyof typeof emptyForm, value: string) {
    setForm(current => ({ ...current, [key]: value }));
    if (key === 'title' && !form.slug) {
      setForm(current => ({ ...current, title: value, slug: value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') }));
    }
    setReport(null);
  }

  function resetEditor() {
    setSelectedPostId(null);
    setForm(emptyForm);
    setReport(null);
  }

  async function editDraft(id: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch(`/api/cms/posts/${id}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Draft tidak dapat dibuka.');
      const post = data.post;
      setSelectedPostId(post.id);
      setForm({
        title: post.title || '',
        slug: post.slug || '',
        excerpt: post.excerpt || '',
        content: post.content || '',
        seoTitle: post.seo_title || '',
        seoDescription: post.seo_description || '',
        focusKeyword: post.focus_keyword || '',
      });
      setReport(null);
      setMessage(`Sedang mengedit draft “${post.title}”.`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft gagal dibuka.');
    } finally { setBusy(false); }
  }

  async function audit() {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/cms/seo-audit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'SEO audit gagal dijalankan.');
      setReport(data.report);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'SEO audit gagal.');
    } finally { setBusy(false); }
  }


  async function publishPost(id: string, title: string) {
    setBusy(true); setMessage('');
    try {
      const response = await fetch('/api/cms/posts/' + id + '/publish', { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Artikel gagal dipublikasikan.');
      setMessage('Artikel “' + title + '” berhasil dipublikasikan: /artikel/' + data.post.slug);
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Publikasi artikel gagal.');
    } finally { setBusy(false); }
  }

  async function saveDraft() {
    setBusy(true); setMessage('');
    try {
      const editing = Boolean(selectedPostId);
      const response = await fetch(editing ? `/api/cms/posts/${selectedPostId}` : '/api/cms/posts', {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Draft gagal disimpan.');
      setMessage(editing ? `Draft “${data.post.title}” berhasil diperbarui.` : `Draft “${data.post.title}” berhasil disimpan.`);
      resetEditor();
      await loadPosts();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Draft gagal disimpan.');
    } finally { setBusy(false); }
  }

  return (
    <main className="cms-shell">
      <header className="cms-topbar">
        <a href="/" className="cms-brand"><span>R</span><strong>RUNDINGAN <small>CONTENT STUDIO</small></strong></a>
        <div className="cms-user"><span>Workspace editorial</span><strong>{userName}</strong><a href="/workspace/reports">Laporan & cetak ↗</a><a href="/workspace/enterprise/agents">AI Agents ↗</a><a href="/workspace">Workspace ↗</a></div>
      </header>
      <section className="cms-intro">
        <div><p className="cms-kicker">CONTENT MANAGEMENT SYSTEM / V1</p><h1>Editorial <em>Workspace.</em></h1><p>Kelola draft artikel, siapkan metadata pencarian, dan jalankan pemeriksaan SEO multi-agent sebelum masuk ke tahap review editorial.</p></div>
        <div className="cms-intro-stat"><strong>{posts.length.toString().padStart(2, '0')}</strong><span>ARTIKEL TERSIMPAN</span></div>
      </section>
      {message && <div className="cms-message" role="status">{message}</div>}
      <div className="cms-grid">
        {canCreate ? (
          <section className="cms-panel cms-editor">
            <div className="cms-panel-heading"><div><p className="cms-kicker">01 / EDITOR</p><h2>{selectedPostId ? 'Edit article draft' : 'New article draft'}</h2></div><div className="cms-editor-actions"><span className="cms-draft-pill">DRAFT ONLY</span>{selectedPostId && <button className="cms-text-button" onClick={resetEditor}>Batal edit</button>}</div></div>
            <label>Judul artikel<input value={form.title} onChange={e => updateField('title', e.target.value)} placeholder="Tulis judul yang jelas dan menarik" maxLength={180} /></label>
            <label>URL slug<input value={form.slug} onChange={e => updateField('slug', e.target.value)} placeholder="judul-artikel" /></label>
            <label>Ringkasan<textarea rows={2} value={form.excerpt} onChange={e => updateField('excerpt', e.target.value)} placeholder="Ringkasan singkat untuk daftar artikel" /></label>
            <label>Isi artikel<textarea className="cms-content-input" rows={14} value={form.content} onChange={e => updateField('content', e.target.value)} placeholder="Tulis isi artikel di sini. Gunakan baris baru untuk memisahkan paragraf dan format # Judul Bagian untuk heading." /></label>
            <div className="cms-editor-footer"><span>{wordCount} kata · {form.content.length} karakter</span><button className="cms-button cms-button-primary" disabled={busy || form.title.trim().length < 3 || form.content.trim().length < 20} onClick={saveDraft}>{selectedPostId ? 'Simpan perubahan' : 'Simpan sebagai draft'}</button></div>
          </section>
        ) : (
          <section className="cms-panel cms-editor"><p className="cms-kicker">EDITOR / READ ONLY</p><h2>Mode pembaca</h2><p>Peran Anda dapat melihat artikel, tetapi belum memiliki izin membuat draft.</p></section>
        )}
        <aside className="cms-side">
          <section className="cms-panel">
            <div className="cms-panel-heading"><div><p className="cms-kicker">02 / SEARCH PREVIEW</p><h2>SEO metadata</h2></div></div>
            {canCreate ? (
              <>
                <label>Focus keyword<input value={form.focusKeyword} onChange={e => updateField('focusKeyword', e.target.value)} placeholder="Kata kunci utama" /></label>
                <label>SEO title<input value={form.seoTitle} onChange={e => updateField('seoTitle', e.target.value)} placeholder="Judul untuk mesin pencari" maxLength={70} /></label>
                <div className="cms-counter">{(form.seoTitle || form.title).length} karakter · target 30–60</div>
                <label>Meta description<textarea rows={3} value={form.seoDescription} onChange={e => updateField('seoDescription', e.target.value)} placeholder="Deskripsi ringkas yang menjelaskan manfaat artikel" maxLength={200} /></label>
                <div className="cms-counter">{form.seoDescription.length} karakter · target 120–160</div>
                <div className="cms-search-preview"><small>PREVIEW GOOGLE (SIMULASI)</small><strong>{form.seoTitle || form.title || 'Judul artikel akan tampil di sini'}</strong><span>rundingan-kreasi-media.vercel.app/artikel/{form.slug || 'url-artikel'}</span><p>{form.seoDescription || form.excerpt || 'Meta description akan tampil sebagai ringkasan hasil pencarian.'}</p></div>
              </>
            ) : <p className="cms-empty">Metadata tersedia dalam mode baca setelah artikel dipilih.</p>}
            {canAudit && <button className="cms-button cms-button-outline" disabled={busy || !form.title.trim() || !form.content.trim()} onClick={audit}>{busy ? 'Memproses…' : 'Jalankan 6 SEO Agents'}</button>}
          </section>
          <section className="cms-panel cms-agents-panel">
            <div className="cms-panel-heading"><div><p className="cms-kicker">03 / MULTI-AGENT</p><h2>SEO intelligence</h2></div><span className="cms-agent-count">06</span></div>
            <div className="cms-agent-list">
              {['Title & Keyword Agent','Meta Description Agent','Content Structure Agent','Keyword Placement Agent','Readability Agent','Technical On-page Agent'].map((agent, index) => <div className="cms-agent-item" key={agent}><span>0{index + 1}</span><strong>{agent}</strong><i>{canAudit ? 'READY' : 'READ ONLY'}</i></div>)}
            </div>
            {report && <div className="cms-report"><div className="cms-score"><strong>{report.score}</strong><span>/ 100 SEO SCORE</span></div>{report.agents.map(item => <div className="cms-finding" key={item.agent}><div><strong>{item.agent}</strong><b>{item.score}/100</b></div><p>{item.summary}</p>{item.recommendations.map(rec => <small key={rec}>• {rec}</small>)}</div>)}<p className="cms-disclaimer">{report.disclaimer}</p></div>}
          </section>
        </aside>
      </div>
      <section className="cms-panel cms-posts">
        <div className="cms-panel-heading"><div><p className="cms-kicker">04 / CONTENT LIBRARY</p><h2>Recent articles</h2></div><button className="cms-button cms-button-outline" onClick={loadPosts}>Refresh ↻</button></div>
        {loading ? <p className="cms-empty">Memuat artikel…</p> : posts.length === 0 ? <p className="cms-empty">Belum ada artikel. Draft pertama Anda akan muncul di sini setelah migrasi database diterapkan.</p> : <div className="cms-post-list">{posts.map(post => <article className="cms-post-row" key={post.id}><div><strong>{post.title}</strong><span>/artikel/{post.slug}</span></div><span className="cms-status">{post.status}</span><time>{new Date(post.updated_at).toLocaleDateString('id-ID')}</time>{canUpdate && post.status === 'draft' && <button className="cms-text-button" disabled={busy} onClick={() => editDraft(post.id)}>Edit draft</button>}{canPublish && (post.status === 'draft' || post.status === 'review') && <button className="cms-text-button" disabled={busy} onClick={() => publishPost(post.id, post.title)}>Publikasikan ↗</button>}{post.status === 'published' && <a className="cms-text-button" href={'/artikel/' + post.slug} target="_blank" rel="noreferrer">Lihat artikel ↗</a>}</article>)}</div>}
      </section>
      <footer className="cms-footer">RUNDINGAN KREASI MEDIA · EDITORIAL CONTROL DESK · V1</footer>
    </main>
  );
}
