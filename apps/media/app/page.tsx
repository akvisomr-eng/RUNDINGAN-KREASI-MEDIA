const modules = [
  {
    number: "01",
    title: "Newsroom & Editorial",
    description: "Desk berita, pitch, penugasan, riset, draft, dan pemeriksaan fakta.",
    status: "Fondasi disiapkan",
    href: "#editorial",
  },
  {
    number: "02",
    title: "CMS & Publication",
    description: "Artikel, kategori, jadwal terbit, koreksi, dan distribusi kanal.",
    status: "Tahap berikutnya",
    href: "#publication",
  },
  {
    number: "03",
    title: "Media Asset Library",
    description: "Foto, video, dokumen, hak penggunaan, dan bukti persetujuan.",
    status: "Tahap berikutnya",
    href: "#assets",
  },
  {
    number: "04",
    title: "Advertising & Campaign",
    description: "Advertiser, media kit, rate card, placement, dan laporan kampanye.",
    status: "Tahap berikutnya",
    href: "#advertising",
  },
  {
    number: "05",
    title: "Audience & Analytics",
    description: "Performa konten, jangkauan, engagement, dan insight pembaca.",
    status: "Tahap berikutnya",
    href: "#audience",
  },
  {
    number: "06",
    title: "Core Integration",
    description: "Referensi organisasi, pelanggan, entitlement, dan permintaan penagihan.",
    status: "Menunggu kontrak API Core",
    href: "#integration",
  },
];

export default function MediaHome() {
  return (
    <main className="media-shell">
      <aside className="media-rail">
        <a className="brand" href="/" aria-label="Rundingan Media home">
          <span className="brand-mark">R</span>
          <span className="brand-copy"><strong>RUNDINGAN</strong><small>MEDIA</small></span>
        </a>
        <div className="rail-label">WORKSPACE</div>
        <nav className="rail-nav" aria-label="Navigasi workspace">
          <a className="active" href="#overview"><span>◫</span> Overview</a>
          <a href="#editorial"><span>✎</span> Newsroom</a>
          <a href="#publication"><span>▤</span> Publication</a>
          <a href="#assets"><span>▧</span> Media assets</a>
          <a href="#advertising"><span>◈</span> Advertising</a>
          <a href="#audience"><span>⌁</span> Audience</a>
          <a href="#integration"><span>⇄</span> Integrations</a>
        </nav>
        <div className="rail-bottom">
          <span className="status-dot" />
          <div><strong>Development workspace</strong><small>RUNDINGAN Enterprise Ecosystem</small></div>
        </div>
      </aside>

      <section className="media-main" id="overview">
        <header className="topbar">
          <div><span className="eyebrow">SPECIALIST APPLICATION / 01</span><strong>Media Operations</strong></div>
          <div className="topbar-right"><span className="environment">DEVELOPMENT</span><span className="avatar">RM</span></div>
        </header>

        <div className="content">
          <div className="welcome">
            <div>
              <p className="eyebrow">RUNDINGAN MEDIA · NEWSROOM & PUBLISHING</p>
              <h1>Stories that<br /><em>move people.</em></h1>
              <p className="welcome-copy">Pusat kerja editorial, publikasi, aset media, periklanan, dan pengelolaan audiens dalam satu ruang operasional.</p>
            </div>
            <div className="welcome-mark" aria-hidden="true"><span>R.</span><small>MEDIA / 2026</small></div>
          </div>

          <div className="notice">
            <span className="notice-icon">i</span>
            <p><strong>Workspace tahap fondasi.</strong> Modul dan koneksi data akan diaktifkan bertahap setelah autentikasi terpusat, kebijakan akses organisasi, dan kontrak integrasi Enterprise Core lulus pengujian.</p>
          </div>

          <div className="section-heading">
            <div><span className="eyebrow">OPERATING AREAS</span><h2>Media workspace</h2></div>
            <span className="section-count">06 MODULE AREAS</span>
          </div>

          <div className="module-grid">
            {modules.map((item) => (
              <a className="module-card" href={item.href} key={item.number}>
                <div className="module-top"><span>{item.number} / 06</span><span className="module-arrow">↗</span></div>
                <div><h3>{item.title}</h3><p>{item.description}</p></div>
                <div className="module-bottom"><span className="module-state" />{item.status}</div>
              </a>
            ))}
          </div>

          <div className="section-heading integration-heading" id="integration">
            <div><span className="eyebrow">SHARED ENTERPRISE SERVICES</span><h2>Connected, not duplicated.</h2></div>
          </div>
          <div className="integration-strip">
            <div><small>IDENTITY & ACCESS</small><strong>Enterprise Core</strong><span>Central identity · organization · permissions</span></div>
            <div><small>FINANCE & BILLING</small><strong>Enterprise Core</strong><span>Billing requests · journal references · consolidation</span></div>
            <div><small>OPERATIONAL DATA</small><strong>MEDIA DATABASE</strong><span>Editorial · publishing · assets · campaigns</span></div>
          </div>

          <footer className="footer"><span>RUNDINGAN MEDIA · A SPECIALIST BUSINESS APPLICATION</span><span>© 2026 RUNDINGAN KREASI MEDIA</span></footer>
        </div>
      </section>
    </main>
  );
}
