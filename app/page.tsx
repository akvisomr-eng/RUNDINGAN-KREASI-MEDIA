const units = [
  { no: "01", name: "Rundingan Media", label: "MEDIA & PUBLISHING", color: "tile-blue", icon: "▶", href: "https://www.youtube.com/@rundingan" },
  { no: "02", name: "Rundingan Academy", label: "LEARN & GROW", color: "tile-teal", icon: "✳", href: "#kontak" },
  { no: "03", name: "Rundingan Rental", label: "PRODUCTION GEAR", color: "tile-violet", icon: "▣", href: "#kontak" },
  { no: "04", name: "Rundingan Production", label: "VIDEO & PODCAST", color: "tile-orange", icon: "◉", href: "#podcast" },
  { no: "05", name: "Rundingan Creative", label: "BRAND & DESIGN", color: "tile-rose", icon: "✎", href: "#kontak" },
  { no: "06", name: "Rundingan Event", label: "LIVE EXPERIENCE", color: "tile-navy", icon: "✦", href: "#kontak" },
];

const videos = [
  {
    id: "IlsxmhJ5g1A",
    title: "Khilma Anis — Hati Suhita",
    subtitle: "Perempuan Mengalah, Yang Bekerja Bukan Mulut atau Jarinya, Tapi Doanya",
    tag: "PODCAST / ZONA NYAMAN",
  },
  {
    id: "nAUd9vJXcys",
    title: "Perempuan Bukan Objek Seksual",
    subtitle: "Percakapan bersama Dr. Nur Rofiah",
    tag: "PODCAST / RUNDINGAN",
  },
];

export default function Home() {
  return (
    <main id="home" className="metro-site">
      <header className="metro-header">
        <a className="metro-brand" href="#home" aria-label="Rundingan Kreasi Media home">
          <span className="metro-brand-mark">R</span>
          <span><strong>RUNDINGAN</strong><small>KREASI MEDIA</small></span>
        </a>
        <nav className="metro-nav" aria-label="Navigasi utama">
          <a href="#podcast">Podcast</a>
          <a href="#ekosistem">Ekosistem</a>
          <a href="#tentang">Tentang</a>
          <a href="/auth/sign-in">Portal Tim</a>
          <a className="metro-nav-cta" href="#kontak">Hubungi Kami <span>↗</span></a>
        </nav>
        <details className="metro-mobile-nav">
          <summary aria-label="Buka menu navigasi">☰</summary>
          <div><a href="#podcast">Podcast</a><a href="#ekosistem">Ekosistem</a><a href="#tentang">Tentang</a><a href="/auth/sign-in">Portal Tim</a><a href="#kontak">Hubungi Kami</a></div>
        </details>
      </header>

      <section className="metro-hero" aria-labelledby="hero-title">
        <div className="metro-intro">
          <p className="metro-eyebrow"><span /> CREATIVE MEDIA · PRODUCTION · EXPERIENCE</p>
          <h1 id="hero-title">Ideas move<br /><em>people forward.</em></h1>
          <p>Ruang kolaborasi untuk cerita, kreativitas, teknologi, dan pengalaman yang memberi dampak.</p>
          <div className="metro-intro-actions"><a href="#ekosistem" className="metro-button">Jelajahi ekosistem <span>↘</span></a><a href="#podcast" className="metro-text-link">Tonton produksi kami</a></div>
          <div className="metro-intro-foot"><span>INDONESIA · EST. 2026</span><span>IDEA → PRODUCTION → IMPACT</span></div>
        </div>

        <div className="metro-hero-board" aria-label="Pilihan konten dan unit bisnis Rundingan">
          <a className="metro-tile tile-featured" href="https://www.youtube.com/watch?v=IlsxmhJ5g1A" target="_blank" rel="noreferrer">
            <div className="tile-media">
              <iframe
                src="https://www.youtube-nocookie.com/embed/IlsxmhJ5g1A?rel=0&modestbranding=1"
                title="Rundingan Podcast — Khilma Anis, Hati Suhita"
                loading="lazy"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
              />
            </div>
            <span className="tile-play" aria-hidden="true">▶</span>
            <span className="tile-caption"><small>FEATURED PODCAST / ZONA NYAMAN</small><strong>Khilma Anis — Hati Suhita</strong><em>Putar di YouTube ↗</em></span>
          </a>
          <a className="metro-tile tile-video tile-video-two" href="https://www.youtube.com/watch?v=nAUd9vJXcys" target="_blank" rel="noreferrer" style={{ backgroundImage: "linear-gradient(180deg, transparent 20%, rgba(3,18,38,.88)), url(https://img.youtube.com/vi/nAUd9vJXcys/hqdefault.jpg)" }}>
            <span className="tile-play" aria-hidden="true">▶</span><span className="tile-caption"><small>PODCAST / RUNDINGAN</small><strong>Perempuan Bukan Objek Seksual</strong></span>
          </a>
          <a className="metro-tile tile-blue tile-channel" href="https://www.youtube.com/@rundingan" target="_blank" rel="noreferrer">
            <span className="tile-icon">▶</span><span className="tile-caption"><small>WATCH · LISTEN · SUBSCRIBE</small><strong>Rundingan Channel</strong><em>Jelajahi semua video ↗</em></span>
          </a>
          <a className="metro-tile tile-social tile-instagram" href="https://www.instagram.com/rundingan.id/" target="_blank" rel="noreferrer">
            <span className="tile-icon">◎</span><span className="tile-caption"><small>FOLLOW OUR JOURNEY</small><strong>Instagram</strong><em>@rundingan.id ↗</em></span>
          </a>
          <a className="metro-tile tile-social tile-tiktok" href="https://www.tiktok.com/@rundingan.id" target="_blank" rel="noreferrer">
            <span className="tile-icon">♪</span><span className="tile-caption"><small>SHORT FORM STORIES</small><strong>TikTok</strong><em>@rundingan.id ↗</em></span>
          </a>
        </div>
        <div className="metro-scroll-cue">SCROLL TO EXPLORE <span>↓</span></div>
      </section>

      <section className="metro-section metro-podcast" id="podcast">
        <div className="metro-section-heading"><div><p className="metro-section-kicker">01 / ON THE CHANNEL</p><h2>Stories worth<br /><em>spending time with.</em></h2></div><a href="https://www.youtube.com/@rundingan" target="_blank" rel="noreferrer">Lihat channel YouTube ↗</a></div>
        <div className="metro-video-grid">
          {videos.map((video, index) => (
            <a className="metro-video-card" href={`https://www.youtube.com/watch?v=${video.id}`} target="_blank" rel="noreferrer" key={video.id}>
              <div className="metro-video-thumb" style={{ backgroundImage: `linear-gradient(180deg, transparent 25%, rgba(4,17,35,.86)), url(https://img.youtube.com/vi/${video.id}/hqdefault.jpg)` }}>
                <span className="metro-video-play">▶</span><span className="metro-video-index">0{index + 1}</span>
              </div>
              <div className="metro-video-meta"><small>{video.tag}</small><h3>{video.title}</h3><p>{video.subtitle}</p><span>Tonton episode ↗</span></div>
            </a>
          ))}
        </div>
        <p className="metro-source-note">Video ditautkan langsung ke kanal YouTube Rundingan. Pemutaran dapat dilakukan di halaman ini atau melalui YouTube.</p>
      </section>

      <section className="metro-section metro-ecosystem" id="ekosistem">
        <div className="metro-section-heading"><div><p className="metro-section-kicker">02 / ONE CREATIVE ECOSYSTEM</p><h2>Six units.<br /><em>One direction.</em></h2></div><p>Dari gagasan pertama hingga karya siap dinikmati, enam unit kami bergerak sebagai satu ekosistem.</p></div>
        <div className="metro-unit-board">
          {units.map((unit) => <a className={`metro-unit-tile ${unit.color}`} href={unit.href} key={unit.no}><span className="metro-unit-number">{unit.no} / 06</span><span className="metro-unit-icon">{unit.icon}</span><span className="metro-unit-copy"><small>{unit.label}</small><strong>{unit.name}</strong><em>Explore ↗</em></span></a>)}
        </div>
      </section>

      <section className="metro-about" id="tentang">
        <div className="metro-about-mark">R.</div>
        <div><p className="metro-section-kicker">03 / ABOUT RUNDINGAN</p><h2>We make ideas<br /><em>mean something.</em></h2><p>Rundingan Kreasi Media adalah ekosistem layanan media dan kreatif yang menghubungkan publikasi, edukasi, peralatan, produksi, desain, dan event. Kami percaya karya yang kuat lahir dari kolaborasi yang terarah dan proses yang bertanggung jawab.</p><a href="#kontak" className="metro-button metro-button-light">Mulai kolaborasi ↗</a></div>
      </section>

      <section className="metro-contact" id="kontak">
        <div><p className="metro-section-kicker">04 / LET'S CREATE TOGETHER</p><h2>Have a story<br /><em>to tell?</em></h2><p>Ceritakan kebutuhan produksi, ide konten, kerja sama, atau acara yang ingin Anda wujudkan bersama kami.</p></div>
        <div className="metro-contact-links"><a href="https://www.youtube.com/@rundingan" target="_blank" rel="noreferrer">YouTube <span>↗</span></a><a href="https://www.instagram.com/rundingan.id/" target="_blank" rel="noreferrer">Instagram <span>↗</span></a><a href="https://www.tiktok.com/@rundingan.id" target="_blank" rel="noreferrer">TikTok <span>↗</span></a><a href="mailto:contact@rundingankreasi.media?subject=Kolaborasi%20Rundingan%20Kreasi%20Media">Email <span>↗</span></a></div>
      </section>

      <footer className="metro-footer"><a className="metro-brand" href="#home"><span className="metro-brand-mark">R</span><span><strong>RUNDINGAN</strong><small>KREASI MEDIA</small></span></a><p>Ideas into meaningful experiences.</p><small>© 2026 RUNDINGAN KREASI MEDIA</small></footer>
    </main>
  );
}
