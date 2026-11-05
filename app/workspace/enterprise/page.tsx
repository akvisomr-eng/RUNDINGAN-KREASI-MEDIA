import Link from 'next/link';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth/server';
import { hasPermission } from '@/lib/auth/permissions';
import { getSql } from '@/lib/db';

export const dynamic = 'force-dynamic';

type Metric = { label: string; value: number; detail: string };

export default async function EnterpriseCorePage() {
  const { data: session } = await auth.getSession();
  if (!session?.user) redirect('/auth/sign-in');

  const canReadOrganization = await hasPermission(session.user.id, 'core.organization.read');
  if (!canReadOrganization) {
    return (
      <main className="workspace-shell">
        <section className="workspace-content">
          <p className="auth-eyebrow">403 / AKSES TERBATAS</p>
          <h1>Administrasi perusahaan belum dibuka.</h1>
          <p>Halaman ini memerlukan izin core.organization.read. Hubungi Owner atau administrator organisasi.</p>
          <Link className="workspace-link" href="/workspace">Kembali ke workspace ↗</Link>
        </section>
      </main>
    );
  }

  const sql = getSql();
  const rows = await sql`
    SELECT
      o.name,
      o.legal_name,
      o.slug,
      o.status,
      o.timezone,
      o.default_currency,
      (SELECT count(*)::int FROM business_units b WHERE b.organization_id = o.id) AS business_units,
      (SELECT count(*)::int FROM departments d WHERE d.organization_id = o.id) AS departments,
      (SELECT count(*)::int FROM locations l WHERE l.organization_id = o.id) AS locations,
      (SELECT count(*)::int FROM roles r WHERE r.organization_id = o.id AND r.status = 'active') AS active_roles,
      (SELECT count(*)::int FROM user_role_assignments a WHERE a.organization_id = o.id AND a.revoked_at IS NULL) AS active_assignments,
      (SELECT count(*)::int FROM audit_logs al WHERE al.organization_id = o.id) AS audit_events
    FROM organizations o
    WHERE o.slug = 'rundingan-kreasi-media' AND o.deleted_at IS NULL
    LIMIT 1
  ` as unknown as Array<{ name: string; legal_name: string | null; slug: string; status: string; timezone: string; default_currency: string; business_units: number; departments: number; locations: number; active_roles: number; active_assignments: number; audit_events: number }>;
  const organization = rows[0] as {
    name: string; legal_name: string | null; slug: string; status: string;
    timezone: string; default_currency: string; business_units: number;
    departments: number; locations: number; active_roles: number;
    active_assignments: number; audit_events: number;
  } | undefined;

  if (!organization) {
    return (
      <main className="workspace-shell">
        <section className="workspace-content">
          <p className="auth-eyebrow">CORE / ORGANIZATION NOT FOUND</p>
          <h1>Profil organisasi belum tersedia.</h1>
          <p>Data organisasi tidak ditemukan pada database aktif.</p>
          <Link className="workspace-link" href="/workspace">Kembali ke workspace ↗</Link>
        </section>
      </main>
    );
  }

  const canReadUsers = await hasPermission(session.user.id, 'core.users.read');
  const canReadRoles = await hasPermission(session.user.id, 'core.roles.read');
  const canReadUnits = await hasPermission(session.user.id, 'core.business_units.read');
  const [canReadAudit, canReadFinance, canReadPeople, canReadInventory, canReadModules, canReadAgents, canReadReports, canReadAcademy, canReadCreative, canReadEvent, canReadMedia, canReadProduction] = await Promise.all([hasPermission(session.user.id, 'core.audit.read'), hasPermission(session.user.id, 'finance.accounts.read'), hasPermission(session.user.id, 'hr.employees.read'), hasPermission(session.user.id, 'inventory.items.read'), hasPermission(session.user.id, 'modules.catalog.read'), hasPermission(session.user.id, 'agents.read'), hasPermission(session.user.id, 'reports.read'), hasPermission(session.user.id, 'academy.work.read'), hasPermission(session.user.id, 'creative.work.read'), hasPermission(session.user.id, 'event.work.read'), hasPermission(session.user.id, 'media.work.read'), hasPermission(session.user.id, 'production.work.read')]);

  const metrics: Metric[] = [
    { label: 'UNIT BISNIS', value: organization.business_units, detail: canReadUnits ? 'Data unit organisasi' : 'Izin detail unit tidak tersedia' },
    { label: 'DEPARTEMEN', value: organization.departments, detail: 'Master data departemen' },
    { label: 'LOKASI', value: organization.locations, detail: 'Master data lokasi' },
    { label: 'ROLE AKTIF', value: organization.active_roles, detail: canReadRoles ? 'Peran dan kewenangan' : 'Izin baca role tidak tersedia' },
    { label: 'PENUGASAN ROLE', value: organization.active_assignments, detail: canReadUsers ? 'Akun dengan role aktif' : 'Izin baca pengguna tidak tersedia' },
    { label: 'AUDIT EVENT', value: organization.audit_events, detail: canReadAudit ? 'Catatan aktivitas tercatat' : 'Izin baca audit tidak tersedia' },
  ];

  return (
    <main className="workspace-shell">
      <header className="workspace-top">
        <Link className="brand" href="/workspace"><span className="brand-mark">R</span><span>RUNDINGAN<span className="brand-sub">KREASI MEDIA</span></span></Link>
        <span className="workspace-label">ENTERPRISE CORE / ADMINISTRATION</span>
      </header>
      <section className="enterprise-content">
        <div className="enterprise-heading">
          <div>
            <p className="auth-eyebrow">WORKSPACE / ENTERPRISE CORE / 03</p>
            <h1>Administrasi<br /><em>perusahaan.</em></h1>
            <p className="enterprise-intro">Pusat kendali struktur organisasi, akses, dan tata kelola operasional Rundingan Kreasi Media.</p>
          </div>
          <Link className="enterprise-back" href="/workspace">← Workspace</Link>
        </div>

        <section className="enterprise-org">
          <div>
            <p className="auth-eyebrow">ORGANIZATION PROFILE</p>
            <h2>{organization.name}</h2>
            {organization.legal_name ? <p>{organization.legal_name}</p> : null}
          </div>
          <div className="enterprise-org-meta">
            <span className={organization.status === 'active' ? 'enterprise-status active' : 'enterprise-status'}>{organization.status.toUpperCase()}</span>
            <span>{organization.timezone}</span>
            <span>{organization.default_currency}</span>
          </div>
        </section>

        <div className="enterprise-section-head">
          <div><p className="auth-eyebrow">LIVE DATABASE SNAPSHOT</p><h2>Ringkasan organisasi</h2></div>
          <span>ACTIVE ENVIRONMENT</span>
        </div>
        <div className="enterprise-metrics">
          {metrics.map((metric) => (
            <article className="enterprise-metric" key={metric.label}>
              <span>{metric.label}</span>
              <strong>{metric.value.toLocaleString('id-ID')}</strong>
              <small>{metric.detail}</small>
            </article>
          ))}
        </div>

        <div className="enterprise-section-head enterprise-modules-head">
          <div><p className="auth-eyebrow">APPLICATION AREAS</p><h2>Ruang administrasi</h2></div>
          <span>STATUS IMPLEMENTASI</span>
        </div>
        <div className="enterprise-areas">
          <Link href="/workspace/enterprise/access" className="enterprise-area">
            <span>01 / ACCESS CONTROL</span><strong>Identitas & hak akses</strong>
            <small>Role aktif: {organization.active_roles} · Penugasan aktif: {organization.active_assignments}</small>
            <b>Ringkasan tersedia ↗</b>
          </Link>
          <Link href="/workspace/enterprise/structure" className="enterprise-area">
            <span>02 / ORGANIZATION STRUCTURE</span><strong>Struktur organisasi & unit bisnis</strong>
            <small>{organization.business_units} unit bisnis · {organization.departments} departemen · {organization.locations} lokasi</small>
            <b>Ringkasan tersedia ↗</b>
          </Link>
          <Link href="/workspace/crm" className="enterprise-area">
            <span>03 / CUSTOMER RELATIONSHIP</span><strong>CRM & relasi bisnis</strong>
            <small>Direktori pelanggan dan pemasok</small><b>Buka modul ↗</b>
          </Link>
          <Link href="/cms" className="enterprise-area">
            <span>04 / CONTENT MANAGEMENT</span><strong>CMS & SEO Studio</strong>
            <small>Editorial, publikasi, metadata, dan audit SEO</small><b>Buka modul ↗</b>
          </Link>
          <Link href="/workspace/enterprise/finance" className="enterprise-area">
            <span>05 / FINANCE & ACCOUNTING</span><strong>Keuangan & akuntansi</strong><small>Chart of accounts, jurnal umum, dan pemeriksaan keseimbangan.</small><b>{canReadFinance ? "Buka modul ↗" : "Memerlukan izin Finance"}</b></Link>
          <Link href="/workspace/enterprise/people" className="enterprise-area">
            <span>06 / PEOPLE OPERATIONS</span><strong>HRD & payroll</strong><small>Data pegawai, departemen, dan draft payroll manual.</small><b>{canReadPeople ? "Buka modul ↗" : "Memerlukan izin HR"}</b></Link>
          <Link href="/workspace/enterprise/inventory" className="enterprise-area">
            <span>07 / INVENTORY & PROCUREMENT</span><strong>Inventaris & pengadaan</strong><small>Master barang, pergerakan stok, dan permintaan pembelian.</small><b>{canReadInventory ? "Buka modul ↗" : "Memerlukan izin Inventory"}</b></Link>
          <Link href="/workspace/enterprise/governance" className="enterprise-area">
            <span>08 / GOVERNANCE</span><strong>Audit & kepatuhan</strong><small>{canReadAudit ? "Jejak aktivitas pengguna dan perubahan data." : "Memerlukan izin core.audit.read."}</small><b>{canReadAudit ? "Lihat audit log ↗" : "Akses terbatas"}</b></Link>
          {canReadModules ? <Link href="/workspace/enterprise/modules" className="enterprise-area"><span>09 / MODULE PLUGINS</span><strong>Katalog modul & plugin</strong><small>ACADEMY, CREATIVE, EVENT, MEDIA, PRODUCTION dan plugin RENTAL.</small><b>Kelola modul ↗</b></Link> : null}
          {canReadAcademy ? <Link href="/workspace/enterprise/academy" className="enterprise-area"><span>12 / ACADEMY</span><strong>Rundingan Academy</strong><small>Program, kelas, instruktur dan peserta pembelajaran.</small><b>Buka workflow ↗</b></Link> : null}
          {canReadCreative ? <Link href="/workspace/enterprise/creative" className="enterprise-area"><span>13 / CREATIVE</span><strong>Rundingan Creative</strong><small>Creative brief, deliverable, klien dan approval.</small><b>Buka workflow ↗</b></Link> : null}
          {canReadEvent ? <Link href="/workspace/enterprise/event" className="enterprise-area"><span>14 / EVENT</span><strong>Rundingan Event</strong><small>Perencanaan acara, venue, peserta dan anggaran.</small><b>Buka workflow ↗</b></Link> : null}
          {canReadMedia ? <Link href="/workspace/enterprise/media" className="enterprise-area"><span>15 / MEDIA</span><strong>Rundingan Media & Social Operations</strong><small>Editorial, content planner YouTube, Instagram, TikTok, variasi copy dan pemeriksaan hak publikasi.</small><b>Buka workflow ↗</b></Link> : null}
          {canReadProduction ? <Link href="/workspace/enterprise/production" className="enterprise-area"><span>16 / PRODUCTION</span><strong>Rundingan Production</strong><small>Produksi, lokasi, kru dan deliverables.</small><b>Buka workflow ↗</b></Link> : null}
          {canReadAgents ? <Link href="/workspace/enterprise/agents" className="enterprise-area"><span>10 / MULTI-AGENT AI</span><strong>AI Operations & Maintenance</strong><small>Agen domain, pemeriksaan integritas, website dan database.</small><b>Buka control center ↗</b></Link> : null}
          {canReadReports ? <Link href="/workspace/reports" className="enterprise-area"><span>11 / REPORT CENTER</span><strong>Laporan & dokumen cetak</strong><small>Laporan keuangan, SDM, persediaan, CRM, CMS, audit dan transaksi.</small><b>Buka laporan ↗</b></Link> : null}
        </div>
        <p className="enterprise-footnote">Angka di atas dibaca langsung dari database aktif. Lima modul inti menyediakan workflow operasional awal; fitur lanjutan dan kepatuhan sektoral tetap mengikuti tahap implementasi.</p>
      </section>
    </main>
  );
}
