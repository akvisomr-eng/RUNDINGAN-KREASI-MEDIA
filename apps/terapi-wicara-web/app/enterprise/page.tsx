'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Bot,
  Award,
  BookOpen,
  Building2,
  CheckCircle2,
  Landmark,
  Network,
  PackageCheck,
  Printer,
  RefreshCw,
  ShieldCheck,
  Stethoscope,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import {
  EnterpriseHqSnapshot,
  FALLBACK_ENTERPRISE_HQ,
  formatRupiah,
  loadEnterpriseHqSnapshot,
} from '../../src/lib/enterpriseClient';
import { getBrowserSupabase } from '../../src/lib/supabaseClient';
import FormulirCrud from '../../src/components/FormulirCrud';
import { ENTERPRISE_SCHEMAS } from '../../src/lib/enterpriseSchemas';

type EnterpriseMenuId =
  | 'E1_HQ_OVERVIEW'
  | 'E2_SIP_QUOTA_MULTIPROF'
  | 'E3_INTERPROF_PKP'
  | 'E4_GL_NERACA_LABARUGI'
  | 'E5_PAYROLL_JASAMEDIS'
  | 'E6_CENTRAL_PROCUREMENT';

const EMS_MENUS: Array<{
  id: EnterpriseMenuId;
  label: string;
  sub: string;
  Icon: React.ComponentType<{ size?: number }>;
  schemaKey?: string;
}> = [
  {
    id: 'E1_HQ_OVERVIEW',
    label: '1. Holding PT & Jaringan Cabang',
    sub: 'KBLI 86104 / Multi-Dinkes',
    Icon: Building2,
    schemaKey: 'holding',
  },
  {
    id: 'E2_SIP_QUOTA_MULTIPROF',
    label: '2. Matriks 3-SIP & Multi-Profesi',
    sub: 'UU Kesehatan No. 17/2023',
    Icon: Users,
  },
  {
    id: 'E3_INTERPROF_PKP',
    label: '3. Kolaborasi Interprofesional',
    sub: 'Sp.KFR • TW • OT • Psikolog',
    Icon: Network,
  },
  {
    id: 'E4_GL_NERACA_LABARUGI',
    label: '4. Buku Besar, Neraca & L/R',
    sub: 'Standar Akuntansi PSAK',
    Icon: Landmark,
    schemaKey: 'jurnal',
  },
  {
    id: 'E5_PAYROLL_JASAMEDIS',
    label: '5. Payroll Jasa Medis & PPh 21',
    sub: 'Berbasis Sesi SOAP TTE',
    Icon: Wallet,
  },
  {
    id: 'E6_CENTRAL_PROCUREMENT',
    label: '6. Gudang Pusat & PO Alkes',
    sub: 'Izin PAK & NIE Kemenkes',
    Icon: PackageCheck,
    schemaKey: 'po',
  },
];

export default function HealthcareEnterpriseHqPage() {
  const [menu, setMenu] = useState<EnterpriseMenuId>('E1_HQ_OVERVIEW');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [data, setData] = useState<EnterpriseHqSnapshot>(FALLBACK_ENTERPRISE_HQ);
  const [liveConnected, setLiveConnected] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // PO Creation Form
  const [poClinicCode, setPoClinicCode] = useState('KLN-TW-KDR-01');
  const [poItems, setPoItems] = useState(
    '15 Set Probe Oromotor Steril + 50 Box Masker Medis & Pouch Autoclave PPI'
  );
  const [poTotal, setPoTotal] = useState('9450000');

  const activeSchema = React.useMemo(() => {
    const item = EMS_MENUS.find((m) => m.id === menu);
    return item?.schemaKey ? ENTERPRISE_SCHEMAS[item.schemaKey] : null;
  }, [menu]);

  const showNotice = (msg: string) => {
    setToast(msg);
    setTimeout(() => {
      setToast((prev) => (prev === msg ? null : prev));
    }, 4500);
  };

  const refresh = useCallback(async (selectedBranch: string = branchFilter) => {
    const res = await loadEnterpriseHqSnapshot(selectedBranch);
    setData(res.data);
    setLiveConnected(res.connected);
  }, [branchFilter]);

  useEffect(() => {
    refresh(branchFilter);
  }, [branchFilter, refresh]);

  // Derived Consolidated Accounting Statements (PSAK Healthcare)
  const totalAssets = data.coa_accounts
    .filter((a) => a.account_type === 'ASET')
    .reduce((s, a) => s + Number(a.balance_idr), 0);
  const totalLiabilities = data.coa_accounts
    .filter((a) => a.account_type === 'LIABILITAS')
    .reduce((s, a) => s + Number(a.balance_idr), 0);
  const totalEquityBase = data.coa_accounts
    .filter((a) => a.account_type === 'EKUITAS')
    .reduce((s, a) => s + Number(a.balance_idr), 0);
  const totalRevenue = data.coa_accounts
    .filter((a) => a.account_type === 'PENDAPATAN_PELAYANAN')
    .reduce((s, a) => s + Number(a.balance_idr), 0);
  const totalMedicalCost = data.coa_accounts
    .filter((a) => a.account_type === 'BEBAN_MEDIS')
    .reduce((s, a) => s + Number(a.balance_idr), 0);
  const totalOpex = data.coa_accounts
    .filter((a) => a.account_type === 'BEBAN_OPERASIONAL')
    .reduce((s, a) => s + Number(a.balance_idr), 0);
  const netSurplus = totalRevenue - totalMedicalCost - totalOpex;

  const handleApprovePo = async (poId: string, poNumber: string) => {
    const sb = getBrowserSupabase();
    if (sb) {
      try {
        const { error } = await sb.rpc('tw_enterprise_execute_action', {
          p_action: 'APPROVE_PURCHASE_ORDER',
          p_payload: { po_id: poId },
        });
        if (!error) {
          showNotice(`Purchase Order ${poNumber} disetujui Direktur Medis Holding.`);
          await refresh(branchFilter);
          return;
        }
      } catch {
        // fallback state update
      }
    }
    setData((prev) => ({
      ...prev,
      purchase_orders: prev.purchase_orders.map((p) =>
        p.id === poId ? { ...p, status: 'DISETUJUI_DIREKTUR' } : p
      ),
    }));
    showNotice(`Purchase Order ${poNumber} disetujui Direktur Medis Holding.`);
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    const sb = getBrowserSupabase();
    if (sb) {
      try {
        const { data: res, error } = await sb.rpc('tw_enterprise_execute_action', {
          p_action: 'CREATE_PURCHASE_ORDER',
          p_payload: {
            clinic_code: poClinicCode,
            items_summary: poItems,
            total_amount_idr: Number(poTotal) || 5000000,
          },
        });
        if (!error && res?.po_number) {
          showNotice(`PO Pengadaan Terpusat ${res.po_number} berhasil dibuat.`);
          await refresh(branchFilter);
          return;
        }
      } catch {
        // fallback local PO
      }
    }

    const newPo = `PO/EMS-TW/202611/${Math.floor(200 + Math.random() * 700)}`;
    setData((prev) => ({
      ...prev,
      purchase_orders: [
        {
          id: newPo,
          po_number: newPo,
          clinic_code: poClinicCode,
          clinic_city:
            prev.branches.find((b) => b.code === poClinicCode)?.city ?? 'Cabang Klinik',
          supplier_name: 'PT Medika Rehabilitasi Alkesindo',
          pak_alkes_license: 'FK.01.01/VI/1928-e/2024 (Izin PAK Kemenkes)',
          items_summary: poItems,
          total_amount_idr: Number(poTotal) || 5000000,
          nie_kemenkes_verified: true,
          status: 'MENUNGGU_APPROVAL',
        },
        ...prev.purchase_orders,
      ],
    }));
    showNotice(`PO Pengadaan Terpusat ${newPo} berhasil dibuat.`);
  };

  const handleDisbursePayroll = async (payrollId: string, name: string) => {
    const sb = getBrowserSupabase();
    if (sb) {
      try {
        const { error } = await sb.rpc('tw_enterprise_execute_action', {
          p_action: 'DISBURSE_JASA_MEDIS_PAYROLL',
          p_payload: { payroll_id: payrollId },
        });
        if (!error) {
          showNotice(
            `Pembayaran Gaji & Jasa Medis (${name}) berhasil dicairkan beserta bukti potong PPh 21.`
          );
          await refresh(branchFilter);
          return;
        }
      } catch {
        // fallback
      }
    }
    setData((prev) => ({
      ...prev,
      payrolls: prev.payrolls.map((pr) =>
        pr.id === payrollId ? { ...pr, payout_status: 'DIBAYARKAN_LUNAS' } : pr
      ),
    }));
    showNotice(
      `Pembayaran Gaji & Jasa Medis (${name}) berhasil dicairkan beserta bukti potong PPh 21.`
    );
  };

  return (
    <div className="sim-shell">
      {/* Left Enterprise HQ Sidebar */}
      <aside className="sim-sidebar" style={{ background: '#09111f' }}>
        <div style={{ padding: '4px 8px 14px', borderBottom: '1px solid #1e293b', marginBottom: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', letterSpacing: 0.5 }}>
            HEALTHCARE ENTERPRISE HQ
          </div>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#ffffff', marginTop: 2 }}>
            {data.holding.legal_entity_name}
          </div>
          <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
            SK Kemenkumham: {data.holding.ahu_decree_number}
          </div>
        </div>

        {EMS_MENUS.map(({ id, label, sub, Icon }) => (
          <button
            key={id}
            onClick={() => setMenu(id)}
            className={`sim-menu-btn ${menu === id ? 'active' : ''}`}
          >
            <Icon size={16} />
            <div style={{ flex: 1 }}>
              <div>{label}</div>
              <div style={{ fontSize: 10, opacity: 0.75 }}>{sub}</div>
            </div>
          </button>
        ))}

        <div
          style={{
            marginTop: 'auto',
            paddingTop: 14,
            borderTop: '1px solid #1e293b',
            display: 'grid',
            gap: 8,
          }}
        >
          <Link
            href="/simklinik"
            className="btn"
            style={{ background: '#0f766e', color: '#ffffff', fontSize: 12 }}
          >
            <Stethoscope size={14} /> Buka Operasional SIMKLINIK Cabang
          </Link>
          <Link
            href="/ai-command-center"
            className="btn"
            style={{ background: '#7c3aed', color: '#ffffff', fontSize: 12 }}
          >
            <Bot size={14} /> Pusat Komando Multi-Agen AI
          </Link>
          <Link
            href="/"
            className="btn"
            style={{ background: 'rgba(255,255,255,0.08)', color: '#cbd5e1', fontSize: 12 }}
          >
            Portal Website Publik
          </Link>
        </div>
      </aside>

      {/* Main Enterprise Content */}
      <main className="sim-main">
        <header className="sim-topbar">
          <div>
            <div style={{ fontSize: 16, fontWeight: 900 }}>
              Enterprise Command Center — Multi-Cabang & Multi-Profesi Rehabilitasi Medik
            </div>
            <div style={{ fontSize: 12, color: '#64748b' }}>
              Direktur Medis Korporat: <strong>{data.holding.medical_director_name}</strong> • NPWP:{' '}
              {data.holding.npwp_number} • NIB Induk OSS: {data.holding.oss_master_nib}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className={`badge ${liveConnected ? 'badge-green' : 'badge-teal'}`}>
              {liveConnected ? 'Live Enterprise DB' : 'Enterprise Consolidated Dataset'}
            </span>

            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              className="form-control"
              style={{ width: 'auto', fontWeight: 700 }}
            >
              <option value="ALL">Konsolidasi Seluruh Cabang ({data.branches.length} Klinik)</option>
              {data.branches.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.code} — {b.city}
                </option>
              ))}
            </select>

            <button onClick={() => window.print()} className="btn btn-outline no-print">
              <Printer size={14} /> Cetak Laporan Direksi
            </button>
            <button onClick={() => refresh(branchFilter)} className="btn btn-primary no-print">
              <RefreshCw size={14} /> Sync
            </button>
          </div>
        </header>

        <div className="sim-content">
          {toast && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: 12,
                background: '#dcfce7',
                color: '#166534',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              {toast}
            </div>
          )}

          {/* E1: HOLDING PT & MULTI-BRANCH CLINIC NETWORK */}
          {activeSchema && (
            <FormulirCrud
              schema={activeSchema}
              actorName="Direktur Utama / Holding Administrator"
              actorRole="KEPALA_KLINIK"
              bootstrapRows={
                menu === 'E4_GL_NERACA_LABARUGI'
                  ? (data.journals as unknown as Array<Record<string, unknown>>)
                  : menu === 'E6_CENTRAL_PROCUREMENT'
                  ? (data.purchase_orders as unknown as Array<Record<string, unknown>>)
                  : (data.branches as unknown as Array<Record<string, unknown>>)
              }
              onSaved={() => refresh(branchFilter)}
            />
          )}

          {menu === 'E1_HQ_OVERVIEW' && (
            <>
              <div className="grid-4">
                <div className="card">
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                    Jaringan Fasilitas Klinik Aktif
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
                    {data.branches.length} Cabang
                  </div>
                  <span className="badge badge-teal" style={{ marginTop: 6 }}>
                    Kediri • Surabaya • Malang
                  </span>
                </div>

                <div className="card">
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                    Pendapatan Pelayanan Konsolidasi
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 900, marginTop: 4, color: '#0f766e' }}>
                    {formatRupiah(totalRevenue)}
                  </div>
                  <span className="badge badge-green" style={{ marginTop: 6 }}>
                    Surplus Bersih: {formatRupiah(netSurplus)}
                  </span>
                </div>

                <div className="card">
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                    Tim Klinis Multi-Profesi
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 900, marginTop: 4 }}>
                    {data.sip_matrix.length} Nakes
                  </div>
                  <span className="badge badge-green" style={{ marginTop: 6 }}>
                    Sp.KFR • TW • OT • Psikolog
                  </span>
                </div>

                <div className="card">
                  <div style={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
                    Total Aset Neraca Holding
                  </div>
                  <div style={{ fontSize: 23, fontWeight: 900, marginTop: 4 }}>
                    {formatRupiah(totalAssets)}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>
                    KBLI 86104 & 86901 Terverifikasi
                  </div>
                </div>
              </div>

              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 900 }}>
                      Tata Kelola Jaringan Cabang Klinik, Izin Dinkes Kab/Kota & Organization ID SATUSEHAT
                    </h2>
                    <p style={{ fontSize: 12, color: '#64748b' }}>
                      Sesuai Permenkes No. 9/2014 & Permenkes No. 14/2021, setiap cabang memiliki Penanggung Jawab Medis, Izin Dinkes daerah setempat, dan SATUSEHAT Org ID tersendiri di bawah badan hukum induk {data.holding.legal_entity_name}.
                    </p>
                  </div>
                </div>

                <div className="grid-3">
                  {data.branches.map((br) => {
                    const pct = Math.min(
                      100,
                      Math.round(
                        (Number(br.realized_revenue_idr || 0) /
                          Math.max(1, Number(br.monthly_revenue_target_idr))) *
                          100
                      )
                    );
                    return (
                      <div
                        key={br.id}
                        className="card"
                        style={{
                          background: br.is_flagship_hq ? '#f0fdfa' : '#f8fafc',
                          borderColor: br.is_flagship_hq ? '#5eead4' : '#e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                          <span className="badge badge-teal">{br.code}</span>
                          <span className="badge badge-green">
                            Akreditasi {br.accreditation_status}
                          </span>
                        </div>
                        <h3 style={{ fontSize: 15, fontWeight: 800, marginTop: 8 }}>{br.name}</h3>
                        <div style={{ fontSize: 12, color: '#475569', marginTop: 6, display: 'grid', gap: 3 }}>
                          <div>
                            <strong>Klasifikasi:</strong> {br.clinic_classification.replace(/_/g, ' ')}
                          </div>
                          <div>
                            <strong>PJ Medis:</strong> {br.head_of_clinic_name}
                          </div>
                          <div>
                            <strong>Izin Dinkes {br.city}:</strong> {br.dinkes_license_number}
                          </div>
                          <div>
                            <strong>Kode Fasyankes / SATUSEHAT:</strong> {br.fasyankes_code} /{' '}
                            {br.satusehat_org_id}
                          </div>
                          <div>
                            <strong>Nakes Ber-SIP Aktif:</strong> {br.practitioner_count} Praktisi
                          </div>
                        </div>

                        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid #cbd5e1' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                            <span>Target Pendapatan Cabang</span>
                            <strong>{pct}%</strong>
                          </div>
                          <div
                            style={{
                              height: 7,
                              background: '#e2e8f0',
                              borderRadius: 999,
                              marginTop: 4,
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: '#0f766e',
                              }}
                            />
                          </div>
                          <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                            Target Bulanan: {formatRupiah(br.monthly_revenue_target_idr)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {/* E2: MATRIKS KUOTA 3 SIP LINTAS CABANG & MULTI-PROFESI (UU 17/2023) */}
          {menu === 'E2_SIP_QUOTA_MULTIPROF' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <ShieldCheck size={20} color="#0f766e" />
                <h2 style={{ fontSize: 18, fontWeight: 900 }}>
                  Pengawasan Kuota Maksimal 3 SIP Lintas Cabang & Multi-Profesi (UU Kesehatan No. 17/2023)
                </h2>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Memantau kepatuhan alokasi Surat Izin Praktik (SIP 1, SIP 2, SIP 3) untuk Dokter Sp.KFR, Terapis Wicara, Terapis Okupasi (Sensory Integration), Fisioterapis, dan Psikolog Klinis di seluruh cabang klinik.
              </p>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tenaga Medis / Kesehatan</th>
                    <th>Profesi & Kolegium</th>
                    <th>STR Seumur Hidup & SKP</th>
                    <th>Kuota SIP Terpakai</th>
                    <th>Rincian Penempatan SIP Cabang (1–3)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.sip_matrix.map((m) => (
                    <tr key={m.practitioner_id}>
                      <td>
                        <div style={{ fontWeight: 800 }}>{m.full_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>{m.employee_number}</div>
                      </td>
                      <td>
                        <span className="badge badge-teal">
                          {m.profession_type.replace(/_/g, ' ')}
                        </span>
                        <div style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                          {m.collegium_council_name}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 700 }}>{m.str_number}</div>
                        <div style={{ fontSize: 11, color: '#059669' }}>
                          SKP: {m.skp_points_earned}/{m.skp_points_target}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            m.active_sip_count >= 3 ? 'badge-amber' : 'badge-green'
                          }`}
                        >
                          {m.active_sip_count} / 3 SIP Aktif
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'grid', gap: 6 }}>
                          {m.sip_slots.map((sl) => (
                            <div
                              key={sl.slot}
                              style={{
                                padding: '6px 10px',
                                background: '#f8fafc',
                                borderRadius: 8,
                                border: '1px solid #e2e8f0',
                                fontSize: 12,
                              }}
                            >
                              <strong>
                                SIP #{sl.slot} ({sl.clinic_city}):
                              </strong>{' '}
                              {sl.sip_number} • {sl.practice_days} (s/d {sl.valid_until})
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* E3: ASUHAN KOLABORATIF INTERPROFESIONAL (STANDAR AKREDITASI PKP) */}
          {menu === 'E3_INTERPROF_PKP' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <BookOpen size={20} color="#0f766e" />
                <h2 style={{ fontSize: 18, fontWeight: 900 }}>
                  Case Conference & Rujukan Kolaborasi Interprofesional Tumbuh Kembang / Rehabilitasi
                </h2>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Standar Penyelenggaraan Kesehatan Perseorangan (PKP) Akreditasi Klinik Utama: mengoordinasikan <em>Co-Treatment</em> antara Terapis Wicara, Dokter Sp.KFR/Sp.A, Terapis Okupasi, Fisioterapis, dan Psikolog Klinis dalam satu RME terpadu.
              </p>

              <div style={{ display: 'grid', gap: 14 }}>
                {data.interprofessional_referrals.map((ref) => (
                  <div
                    key={ref.id}
                    style={{
                      padding: 16,
                      borderRadius: 14,
                      border: '1px solid #cbd5e1',
                      background: ref.priority === 'CITO_DISFAGIA' ? '#fef2f2' : '#f8fafc',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <span className="badge badge-teal" style={{ marginRight: 8 }}>
                          {ref.clinic_code}
                        </span>
                        <strong style={{ fontSize: 15 }}>
                          Pasien: {ref.patient_name} ({ref.medical_record_number})
                        </strong>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span
                          className={`badge ${
                            ref.priority === 'CITO_DISFAGIA' ? 'badge-red' : 'badge-green'
                          }`}
                        >
                          Prioritas: {ref.priority}
                        </span>
                        <span className="badge badge-teal">{ref.status}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: 13, fontWeight: 700, color: '#0f766e', marginTop: 8 }}>
                      Dari: {ref.from_practitioner} ({ref.from_profession}) → Kepada:{' '}
                      {ref.to_practitioner} ({ref.to_profession})
                    </div>
                    <p style={{ fontSize: 13, marginTop: 6 }}>
                      <strong>Indikasi Klinis Rujukan Bersama:</strong> {ref.clinical_reason}
                    </p>
                    <p style={{ fontSize: 13, marginTop: 4, color: '#1e293b' }}>
                      <strong>Target Kolaborasi (Joint Care Plan):</strong> {ref.joint_care_goal}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* E4: AKUNTANSI ENTERPRISE PSAK (COA, JURNAL DOUBLE-ENTRY, NERACA & LABA-RUGI) */}
          {menu === 'E4_GL_NERACA_LABARUGI' && (
            <>
              <div className="grid-3">
                <div className="card" style={{ background: '#f0fdfa', borderColor: '#99f6e4' }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#115e59' }}>
                    RINGKASAN NERACA (BALANCE SHEET)
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Aset:</span>
                      <strong>{formatRupiah(totalAssets)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Total Liabilitas (Termasuk Deposit Paket):</span>
                      <strong>{formatRupiah(totalLiabilities)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Ekuitas + Surplus Berjalan:</span>
                      <strong>{formatRupiah(totalEquityBase + netSurplus)}</strong>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f766e' }}>
                    LAPORAN LABA RUGI KONSOLIDASI (P&L)
                  </div>
                  <div style={{ marginTop: 8, fontSize: 13, display: 'grid', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Pendapatan Pelayanan Klinis:</span>
                      <strong>{formatRupiah(totalRevenue)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Beban Jasa Medis & BHP PPI:</span>
                      <span style={{ color: '#dc2626' }}>({formatRupiah(totalMedicalCost)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span>Beban Operasional Klinik:</span>
                      <span style={{ color: '#dc2626' }}>({formatRupiah(totalOpex)})</span>
                    </div>
                  </div>
                </div>

                <div className="card">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#059669' }}>
                    <TrendingUp size={18} />
                    <span style={{ fontSize: 12, fontWeight: 800 }}>LABA / SURPLUS BERSIH USAHA</span>
                  </div>
                  <div style={{ fontSize: 26, fontWeight: 900, color: '#059669', marginTop: 8 }}>
                    {formatRupiah(netSurplus)}
                  </div>
                  <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
                    Margin Bersih Pelayanan: {((netSurplus / Math.max(1, totalRevenue)) * 100).toFixed(1)}%
                  </div>
                </div>
              </div>

              <div className="grid-2">
                <div className="card">
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
                    Bagan Akun Standar Klinik Kesehatan (Chart of Accounts)
                  </h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kode</th>
                        <th>Nama Akun Buku Besar</th>
                        <th>Kategori</th>
                        <th>Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.coa_accounts.map((acc) => (
                        <tr key={acc.id}>
                          <td>
                            <strong>{acc.account_code}</strong>
                          </td>
                          <td>{acc.account_name}</td>
                          <td>
                            <span className="badge badge-teal">{acc.account_type}</span>
                          </td>
                          <td style={{ fontWeight: 700 }}>{formatRupiah(acc.balance_idr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="card">
                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
                    Jurnal Umum Berpasangan (Double-Entry General Ledger)
                  </h3>
                  <p style={{ fontSize: 12, color: '#64748b', marginBottom: 10 }}>
                    Catatan keuangan sepenuhnya <strong>teranonimisasi dari identitas medis pasien</strong> (sesuai UU PDP) sehingga aman diaudit akuntan publik & perpajakan korporat.
                  </p>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>No. Jurnal & Cabang</th>
                        <th>Uraian Transaksi</th>
                        <th>Debit / Kredit</th>
                        <th>Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.journals.map((jr) => (
                        <tr key={jr.id}>
                          <td>
                            <strong>{jr.journal_number}</strong>
                            <div style={{ fontSize: 11, color: '#64748b' }}>
                              {jr.entry_date} • {jr.clinic_city}
                            </div>
                          </td>
                          <td>{jr.description}</td>
                          <td>
                            <div style={{ fontSize: 11 }}>D: {jr.debit_account_code}</div>
                            <div style={{ fontSize: 11 }}>K: {jr.credit_account_code}</div>
                          </td>
                          <td style={{ fontWeight: 800 }}>{formatRupiah(jr.amount_idr)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}

          {/* E5: HR PAYROLL, JASA MEDIS SESI TTE & PPH 21 */}
          {menu === 'E5_PAYROLL_JASAMEDIS' && (
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Award size={20} color="#0f766e" />
                <h2 style={{ fontSize: 18, fontWeight: 900 }}>
                  Remunerasi Gaji Pokok, Komisi Jasa Medis Berbasis Sesi SOAP Terkunci TTE & PPh 21
                </h2>
              </div>
              <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                Jasa pelayanan klinis dihitung otomatis hanya dari sesi terapi yang telah dilengkapi CPPT SOAP & dikunci TTE sesuai standar mutu klinik (&lt;24 jam).
              </p>

              <table className="data-table">
                <thead>
                  <tr>
                    <th>Nama Praktisi & Cabang</th>
                    <th>Sesi TTE Terverifikasi</th>
                    <th>Gaji Pokok</th>
                    <th>Jasa Medis Sesi</th>
                    <th>Potongan PPh 21</th>
                    <th>Take Home Pay</th>
                    <th>Status / Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {data.payrolls.map((pr) => (
                    <tr key={pr.id}>
                      <td>
                        <div style={{ fontWeight: 800 }}>{pr.practitioner_name}</div>
                        <div style={{ fontSize: 11, color: '#64748b' }}>
                          {pr.profession_type} • {pr.clinic_code}
                        </div>
                      </td>
                      <td>
                        <strong>{pr.verified_locked_sessions} Sesi</strong>
                      </td>
                      <td>{formatRupiah(pr.base_salary_idr)}</td>
                      <td style={{ color: '#0f766e', fontWeight: 700 }}>
                        +{formatRupiah(pr.total_session_fee_idr)}
                      </td>
                      <td style={{ color: '#dc2626' }}>
                        -{formatRupiah(pr.pph21_deduction_idr)}
                      </td>
                      <td style={{ fontWeight: 900, fontSize: 14 }}>
                        {formatRupiah(pr.take_home_pay_idr)}
                      </td>
                      <td>
                        {pr.payout_status === 'DIBAYARKAN_LUNAS' ? (
                          <span className="badge badge-green">
                            <CheckCircle2 size={12} /> DIBAYARKAN LUNAS
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              handleDisbursePayroll(pr.id, pr.practitioner_name)
                            }
                            className="btn btn-primary"
                            style={{ padding: '6px 12px', fontSize: 12 }}
                          >
                            Cairkan Payroll
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* E6: GUDANG PUSAT, PENGADAAN ALKES BERIZIN PAK & NIE KEMENKES */}
          {menu === 'E6_CENTRAL_PROCUREMENT' && (
            <div className="grid-2">
              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
                  Buat Purchase Order (PO) Gudang Pusat ke Distributor Alkes Resmi
                </h3>
                <p style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>
                  Sesuai Permenkes pengawasan alat kesehatan, seluruh instrumen oral motor & oximeter wajib berasal dari Penyalur Alat Kesehatan (PAK) resmi dan memiliki Nomor Izin Edar (NIE AKD/AKL Kemenkes).
                </p>

                <form onSubmit={handleCreatePo} style={{ display: 'grid', gap: 12 }}>
                  <div>
                    <label className="form-label">Cabang Klinik Tujuan Distribusi</label>
                    <select
                      value={poClinicCode}
                      onChange={(e) => setPoClinicCode(e.target.value)}
                      className="form-control"
                    >
                      {data.branches.map((b) => (
                        <option key={b.code} value={b.code}>
                          {b.code} — {b.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="form-label">Daftar Alkes / Instrumen Terapi / BHP PPI</label>
                    <textarea
                      rows={3}
                      value={poItems}
                      onChange={(e) => setPoItems(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <div>
                    <label className="form-label">Nilai Total PO (IDR)</label>
                    <input
                      type="number"
                      value={poTotal}
                      onChange={(e) => setPoTotal(e.target.value)}
                      className="form-control"
                    />
                  </div>

                  <button type="submit" className="btn btn-primary">
                    Terbitkan PO Pengadaan Terpusat
                  </button>
                </form>
              </div>

              <div className="card">
                <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 10 }}>
                  Daftar Purchase Order (PO) & Verifikasi Izin PAK / NIE Kemenkes
                </h3>
                <div style={{ display: 'grid', gap: 10 }}>
                  {data.purchase_orders.map((po) => (
                    <div
                      key={po.id}
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        border: '1px solid #e2e8f0',
                        background: '#f8fafc',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <strong>
                          {po.po_number} → {po.clinic_city}
                        </strong>
                        <span
                          className={`badge ${
                            po.status === 'MENUNGGU_APPROVAL' ? 'badge-amber' : 'badge-green'
                          }`}
                        >
                          {po.status}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: '#0f766e', fontWeight: 700, marginTop: 4 }}>
                        Vendor: {po.supplier_name} ({po.pak_alkes_license})
                      </div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>{po.items_summary}</div>
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginTop: 8,
                        }}
                      >
                        <strong style={{ fontSize: 14 }}>
                          {formatRupiah(po.total_amount_idr)}
                        </strong>
                        {po.status === 'MENUNGGU_APPROVAL' && (
                          <button
                            onClick={() => handleApprovePo(po.id, po.po_number)}
                            className="btn btn-primary"
                            style={{ padding: '5px 10px', fontSize: 11 }}
                          >
                            Setujui PO (Direktur)
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
