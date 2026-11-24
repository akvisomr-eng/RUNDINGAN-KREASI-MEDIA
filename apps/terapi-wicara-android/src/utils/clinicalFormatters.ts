export function calculateAgeLabel(birthDateStr: string): string {
  const birth = new Date(birthDateStr);
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  let months = now.getMonth() - birth.getMonth();
  if (months < 0) {
    years -= 1;
    months += 12;
  }
  if (years < 6) {
    return `${years} thn ${months} bln`;
  }
  return `${years} tahun`;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  };
  return `${fmt(startIso)} - ${fmt(endIso)} WIB`;
}

export function getSipDaysRemaining(validUntilStr: string): number {
  const target = new Date(validUntilStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

export function formatDomainLabel(domain: string): string {
  switch (domain) {
    case 'BAHASA':
      return 'Gangguan Bahasa';
    case 'BICARA':
      return 'Artikulasi & Fonologi';
    case 'SUARA':
      return 'Gangguan Suara';
    case 'IRAMA_KELANCARAN':
      return 'Irama / Kelancaran (Gagap)';
    case 'MENELAN_DISFAGIA':
      return 'Menelan & Makan (Disfagia)';
    default:
      return domain;
  }
}
