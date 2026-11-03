export type SeoInput = {
  title: string;
  slug: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  focusKeyword: string;
};

export type SeoFinding = {
  agent: string;
  score: number;
  status: 'good' | 'warning' | 'needs_work';
  summary: string;
  recommendations: string[];
};

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function words(text: string) {
  return text.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
}

function agentTitle(input: SeoInput): SeoFinding {
  const title = input.seoTitle || input.title;
  const length = title.length;
  const hasKeyword = !!input.focusKeyword && title.toLowerCase().includes(input.focusKeyword.toLowerCase());
  const score = clamp((length >= 30 && length <= 60 ? 65 : 35) + (hasKeyword ? 35 : 0));
  const recommendations = [];
  if (length < 30 || length > 60) recommendations.push('Usahakan SEO title sekitar 30–60 karakter agar tidak mudah terpotong di hasil pencarian.');
  if (input.focusKeyword && !hasKeyword) recommendations.push('Masukkan focus keyword secara alami ke dalam SEO title.');
  return { agent: 'Title & Keyword Agent', score, status: score >= 80 ? 'good' : score >= 50 ? 'warning' : 'needs_work', summary: `SEO title ${length} karakter; pemeriksaan keyword utama ${hasKeyword ? 'lulus' : 'belum lulus'}.`, recommendations };
}

function agentDescription(input: SeoInput): SeoFinding {
  const description = input.seoDescription;
  const length = description.length;
  const score = clamp((length >= 120 && length <= 160 ? 75 : 35) + (!!input.focusKeyword && description.toLowerCase().includes(input.focusKeyword.toLowerCase()) ? 25 : 0));
  const recommendations = [];
  if (length < 120 || length > 160) recommendations.push('Tulis meta description yang ringkas, informatif, dan idealnya sekitar 120–160 karakter.');
  if (input.focusKeyword && !description.toLowerCase().includes(input.focusKeyword.toLowerCase())) recommendations.push('Sertakan focus keyword secara wajar di meta description.');
  if (!description) recommendations.push('Meta description belum diisi.');
  return { agent: 'Meta Description Agent', score, status: score >= 80 ? 'good' : score >= 50 ? 'warning' : 'needs_work', summary: `Meta description ${length} karakter.`, recommendations };
}

function agentStructure(input: SeoInput): SeoFinding {
  const headings = (input.content.match(/^#{1,3}\s+.+$/gm) ?? []).length
    + (input.content.match(/<h[1-3][^>]*>/gi) ?? []).length;
  const paragraphs = input.content.split(/\n\s*\n/).filter(part => part.trim()).length;
  const score = clamp((headings >= 2 ? 55 : 25) + (paragraphs >= 3 ? 45 : 20));
  const recommendations = [];
  if (headings < 2) recommendations.push('Bagi artikel menjadi beberapa bagian dengan subjudul yang deskriptif (H2/H3).');
  if (paragraphs < 3) recommendations.push('Pecah isi menjadi paragraf yang lebih mudah dipindai pembaca.');
  return { agent: 'Content Structure Agent', score, status: score >= 80 ? 'good' : 'warning', summary: `${headings} heading dan ${paragraphs} blok paragraf terdeteksi.`, recommendations };
}

function agentKeyword(input: SeoInput): SeoFinding {
  const bodyWords = words(input.content);
  const keywordWords = words(input.focusKeyword);
  const body = bodyWords.join(' ');
  const phrase = keywordWords.join(' ');
  const occurrences = phrase ? body.split(phrase).length - 1 : 0;
  const density = bodyWords.length ? (occurrences * keywordWords.length / bodyWords.length) * 100 : 0;
  const inOpening = phrase ? body.slice(0, 240).includes(phrase) : false;
  const score = clamp((occurrences > 0 ? 50 : 15) + (inOpening ? 25 : 0) + (density >= 0.5 && density <= 2.5 ? 25 : 10));
  const recommendations = [];
  if (!input.focusKeyword) recommendations.push('Tentukan satu focus keyword utama sebelum optimasi.');
  else if (!occurrences) recommendations.push('Focus keyword belum ditemukan di isi artikel.');
  if (input.focusKeyword && !inOpening) recommendations.push('Pertimbangkan menyebut keyword secara alami pada bagian pembuka.');
  if (density > 2.5) recommendations.push('Frekuensi keyword mungkin terlalu tinggi; hindari keyword stuffing.');
  return { agent: 'Keyword Placement Agent', score, status: score >= 80 ? 'good' : score >= 50 ? 'warning' : 'needs_work', summary: `${bodyWords.length} kata terdeteksi; ${occurrences} kemunculan frasa keyword; estimasi kepadatan ${density.toFixed(1)}%.`, recommendations };
}

function agentReadability(input: SeoInput): SeoFinding {
  const paragraphs = input.content.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const avgWords = paragraphs.length ? paragraphs.reduce((sum, p) => sum + words(p).length, 0) / paragraphs.length : 0;
  const longParagraphs = paragraphs.filter(p => words(p).length > 120).length;
  const score = clamp((avgWords <= 90 && avgWords > 0 ? 65 : 35) + (longParagraphs === 0 ? 35 : 10));
  const recommendations = [];
  if (longParagraphs) recommendations.push(`${longParagraphs} paragraf melebihi 120 kata; pecah agar lebih nyaman dibaca.`);
  if (avgWords > 90) recommendations.push('Rata-rata paragraf cukup panjang. Gunakan kalimat yang lebih ringkas.');
  return { agent: 'Readability Agent', score, status: score >= 80 ? 'good' : 'warning', summary: `Rata-rata sekitar ${Math.round(avgWords)} kata per blok paragraf.`, recommendations };
}

function agentTechnical(input: SeoInput): SeoFinding {
  const slugValid = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug);
  const hasLinks = /\[[^\]]+\]\(https?:\/\/[^)]+\)|https?:\/\/\S+/i.test(input.content);
  const score = clamp((slugValid ? 65 : 20) + (hasLinks ? 35 : 15));
  const recommendations = [];
  if (!slugValid) recommendations.push('Gunakan URL slug yang pendek, deskriptif, huruf kecil, dan dipisahkan tanda hubung.');
  if (!hasLinks) recommendations.push('Tambahkan tautan internal ke halaman atau artikel relevan dan sumber eksternal tepercaya bila diperlukan.');
  return { agent: 'Technical On-page Agent', score, status: score >= 80 ? 'good' : 'warning', summary: `Format slug ${slugValid ? 'valid' : 'perlu diperbaiki'}; ${hasLinks ? 'tautan terdeteksi' : 'belum ada tautan'}.`, recommendations };
}

export function runSeoAgents(input: SeoInput) {
  const findings = [
    agentTitle(input),
    agentDescription(input),
    agentStructure(input),
    agentKeyword(input),
    agentReadability(input),
    agentTechnical(input),
  ];
  const score = clamp(findings.reduce((sum, finding) => sum + finding.score, 0) / findings.length);
  return {
    score,
    status: score >= 85 ? 'strong' : score >= 65 ? 'needs_improvement' : 'weak',
    generatedAt: new Date().toISOString(),
    agents: findings,
    disclaimer: 'Audit otomatis berbasis aturan dan heuristik. Ini bukan data ranking Google, bukan jaminan posisi pencarian, dan tetap perlu tinjauan editor.',
  };
}
