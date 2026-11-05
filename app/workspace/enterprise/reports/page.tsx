"use client";

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Row = Record<string, unknown>;
const reports = [
  ['employees','Daftar pegawai','HRD'],['contracts','Register kontrak','HRD'],['attendance','Rekap kehadiran','HRD'],
  ['leave','Permohonan cuti','HRD'],['payroll','Register payroll','HRD'],['stock','Posisi stok','INVENTORY'],
  ['stock-movements','Kartu mutasi stok','INVENTORY'],['procurement','Permintaan pengadaan','PROCUREMENT'],
  ['purchase-orders','Purchase order','PROCUREMENT'],['goods-receipts','Penerimaan barang','INVENTORY']
] as const;
const reportGroups = [
  {label:'HRD & PAYROLL',items:reports.filter(x=>x[2]==='HRD')},
  {label:'INVENTARIS',items:reports.filter(x=>x[2]==='INVENTORY')},
  {label:'PENGADAAN',items:reports.filter(x=>x[2]==='PROCUREMENT')}
] as const;
const money = (v: unknown) => new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0));
const date = (v: unknown) => v ? new Date(String(v)).toLocaleDateString('id-ID') : '—';
const labels: Record<string,string> = {
 employee_code:'Kode pegawai',full_name:'Nama pegawai',email:'Email',phone:'Telepon',employment_type:'Jenis kerja',job_title:'Jabatan',
 start_date:'Mulai',end_date:'Selesai',status:'Status',department_name:'Departemen',business_unit_name:'Unit bisnis',
 contract_number:'Nomor kontrak',contract_type:'Jenis kontrak',base_salary:'Gaji pokok',work_date:'Tanggal',attendance_status:'Kehadiran',
 employee_count:'Jumlah pegawai',overtime_minutes:'Lembur (menit)',leave_type:'Jenis cuti',total_days:'Jumlah hari',
 period_start:'Periode mulai',period_end:'Periode akhir',finance_journal_id:'Jurnal payroll',payment_journal_id:'Jurnal pembayaran',
 gross_total:'Bruto',deductions_total:'Potongan',net_total:'Netto',sku:'SKU',name:'Nama barang',unit:'Satuan',
 minimum_stock:'Minimum',reorder_quantity:'Jumlah reorder',quantity_on_hand:'Stok tersedia',movement_value:'Nilai mutasi bersih',
 created_at:'Waktu',movement_type:'Jenis mutasi',quantity:'Kuantitas',unit_cost:'Harga satuan',reference:'Referensi',
 location_name:'Lokasi',request_number:'Nomor permintaan',description:'Uraian',estimated_total:'Estimasi',needed_by:'Dibutuhkan',
 supplier_name:'Pemasok',po_number:'Nomor PO',order_date:'Tanggal PO',expected_date:'Estimasi tiba',order_total:'Nilai PO',
 received_quantity:'Kuantitas diterima',receipt_number:'Nomor penerimaan',received_at:'Waktu terima',line_count:'Jumlah baris',
 receipt_value:'Nilai penerimaan'
};
const moneyKeys = new Set(['base_salary','gross_total','deductions_total','net_total','movement_value','unit_cost','estimated_total','order_total','receipt_value']);
const dateKeys = new Set(['start_date','end_date','work_date','period_start','period_end','created_at','needed_by','order_date','expected_date','received_at']);

export default function EnterpriseReportsPage(){
 const [report,setReport]=useState<string>('stock');
 const [rows,setRows]=useState<Row[]>([]);
 const [loading,setLoading]=useState(false);
 const [error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setError('');fetch('/api/enterprise/reports?report='+encodeURIComponent(report)).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error||'Laporan gagal dimuat');return j;}).then(j=>{if(active)setRows(Array.isArray(j.rows)?j.rows:[]);}).catch(e=>{if(active){setRows([]);setError(e instanceof Error?e.message:'Laporan gagal dimuat');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[report]);
 const columns=rows.length?Object.keys(rows[0]):[];
 function exportCsv(){const csv=[columns.map(k=>labels[k]||k).join(','),...rows.map(row=>columns.map(k=>{const v=row[k]===null||row[k]===undefined?'':String(row[k]);return '"'+v.replaceAll('"','""')+'"';}).join(','))].join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='rundingan-'+report+'.csv';a.click();URL.revokeObjectURL(url);}
 return <main className="workspace-shell"><header className="workspace-top"><Link className="brand" href="/workspace/enterprise"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></Link><span className="workspace-label">ENTERPRISE / REPORT CENTER</span></header><section className="ops-content"><div className="ops-heading"><div><p className="auth-eyebrow">ENTERPRISE / REPORTS / OPERATIONAL</p><h1>Laporan operasional</h1><p>Pusat laporan HRD & payroll, inventaris, dan pengadaan. Pilih kategori laporan sesuai modul yang sedang Anda kelola.</p></div><div className="ops-quick-links"><Link href="/workspace/enterprise/people">HRD & Payroll ↗</Link><Link href="/workspace/enterprise/inventory">Inventaris ↗</Link></div><Link href="/workspace/enterprise" className="enterprise-back">← Kembali</Link></div><div className="ops-section"><div className="ops-form"><label className="ops-field">Jenis laporan<select value={report} onChange={e=>setReport(e.target.value)}>{reportGroups.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(([value,label])=><option key={value} value={value}>{label}</option>)}</optgroup>)}</select></label><button type="button" onClick={()=>window.print()} disabled={loading}>Print / PDF</button><button type="button" onClick={exportCsv} disabled={loading||!rows.length}>Export CSV</button><button type="button" onClick={()=>{setLoading(true);fetch('/api/enterprise/reports?report='+encodeURIComponent(report)).then(async r=>{const j=await r.json();if(!r.ok)throw new Error(j.error);setRows(j.rows||[]);}).catch(e=>setError(e.message)).finally(()=>setLoading(false));}}>Refresh</button></div><h2>{reports.find(x=>x[0]===report)?.[1]}</h2>{loading?<p className="ops-empty">Memuat laporan…</p>:null}{error?<p className="ops-message" role="alert">{error}</p>:null}{!loading&&!error?<div className="ops-table-wrap"><table className="ops-table"><thead><tr>{columns.map(k=><th key={k}>{labels[k]||k}</th>)}</tr></thead><tbody>{rows.map((row,i)=><tr key={i}>{columns.map(k=><td key={k}>{row[k]===null||row[k]===undefined?'—':moneyKeys.has(k)?money(row[k]):dateKeys.has(k)?date(row[k]):String(row[k])}</td>)}</tr>)}</tbody></table>{!rows.length?<p className="ops-empty">Belum ada data untuk laporan ini.</p>:null}</div>:null}<p className="ops-empty">Nilai stok pada laporan mutasi merupakan nilai pergerakan tercatat, bukan metode valuasi persediaan final. Rekonsiliasi GL dan metode valuasi akan menjadi bagian dari tahap integrasi akuntansi berikutnya.</p></div></section></main>;
}
