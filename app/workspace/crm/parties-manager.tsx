"use client";

import { FormEvent, useEffect, useState } from 'react';

type Party = {
  id: string;
  party_type: 'customer' | 'supplier' | 'both';
  legal_name: string;
  display_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  created_at: string;
};

export function PartiesManager() {
  const [parties, setParties] = useState<Party[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [partyType, setPartyType] = useState<Party['party_type']>('customer');
  const [legalName, setLegalName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/private/parties')
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.message || payload.error || 'Gagal memuat data CRM.');
        return payload.data as Party[];
      })
      .then((data) => { if (active) setParties(data); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function createParty(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/private/parties', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          party_type: partyType,
          legal_name: legalName,
          display_name: displayName || legalName,
          email: email || null,
          phone: phone || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.message || payload.error || 'Gagal menyimpan data.');
      setParties((current) => [...current, payload.data as Party].sort((a, b) => a.display_name.localeCompare(b.display_name)));
      setLegalName('');
      setDisplayName('');
      setEmail('');
      setPhone('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Terjadi kesalahan.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="crm-layout">
      <section className="crm-form-panel">
        <p className="auth-eyebrow">MASTER DATA / SHARED RECORDS</p>
        <h2>Tambah relasi bisnis</h2>
        <p className="crm-hint">Satu data dapat digunakan lintas unit bisnis tanpa duplikasi.</p>
        <form onSubmit={createParty} className="crm-form">
          <label>Jenis relasi
            <select value={partyType} onChange={(event) => setPartyType(event.target.value as Party['party_type'])}>
              <option value="customer">Pelanggan</option>
              <option value="supplier">Pemasok</option>
              <option value="both">Pelanggan & pemasok</option>
            </select>
          </label>
          <label>Nama legal *
            <input required maxLength={200} value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Nama perusahaan / individu" />
          </label>
          <label>Nama tampilan
            <input maxLength={160} value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Nama yang dikenal tim" />
          </label>
          <label>Email
            <input type="email" maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="kontak@perusahaan.id" />
          </label>
          <label>Nomor telepon
            <input maxLength={40} value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+62 ..." />
          </label>
          <button type="submit" disabled={saving || !legalName.trim()}>{saving ? 'Menyimpan…' : 'Simpan relasi ↗'}</button>
        </form>
        {error ? <p className="crm-error" role="alert">{error}</p> : null}
      </section>
      <section className="crm-list-panel">
        <div className="crm-list-heading">
          <div><p className="auth-eyebrow">DATABASE / CRM</p><h2>Daftar relasi</h2></div>
          <span>{parties.length} RECORD</span>
        </div>
        {loading ? <p className="crm-hint">Memuat data…</p> : parties.length === 0 ? <div className="crm-empty"><strong>Belum ada relasi bisnis.</strong><p>Data baru akan muncul di sini setelah disimpan.</p></div> : (
          <div className="crm-table-wrap">
            <table className="crm-table">
              <thead><tr><th>Nama</th><th>Jenis</th><th>Kontak</th><th>Status</th></tr></thead>
              <tbody>{parties.map((party) => (
                <tr key={party.id}>
                  <td><strong>{party.display_name}</strong><small>{party.legal_name}</small></td>
                  <td>{party.party_type === 'both' ? 'Keduanya' : party.party_type === 'customer' ? 'Pelanggan' : 'Pemasok'}</td>
                  <td>{party.email || '—'}<small>{party.phone || ''}</small></td>
                  <td><span className="crm-status">{party.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
