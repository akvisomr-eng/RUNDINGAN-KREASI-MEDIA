export type SeoInput = {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
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


export type SeoMetadataDraft = {
  focusKeyword: string;
  seoTitle: string;
  seoDescription: string;
  runtime: 'embedded_rules';
  agents: Array<{ agent: string; status: 'ready' | 'warning'; note: string }>;
  disclaimer: string;
};

const SEO_STOP_WORDS = new Set([
  'yang','dan','di','ke','dari','untuk','dengan','pada','dalam','atau','ini','itu','sebagai','oleh','karena',
  'adalah','akan','dapat','bisa','lebih','juga','agar','cara','tentang','hingga','antara','saat','para','bagi',
  'the','and','for','with','from','this','that','into','your','how','what','why','when','are','is','of','to','in'
]);

function cleanSeoText(value: string) {
  return value
    .replace(/\x60{3}[\s\S]*?\x60{3}/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]*>/g, ' ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_~>#]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function chooseFocusKeyword(input: SeoInput, plainText: string) {
  if (input.focusKeyword.trim()) return input.focusKeyword.trim().slice(0, 80);
  const titleTokens = words(cleanSeoText(input.title)).filter(token => token.length > 2 && !SEO_STOP_WORDS.has(token));
  if (titleTokens.length >= 2) return titleTokens.slice(0, 3).join(' ');
  const counts = new Map<string, number>();
  const tokens = words(plainText).filter(token => token.length > 3 && !SEO_STOP_WORDS.has(token));
  for (let i = 0; i < tokens.length - 1; i++) {
    const phrase = tokens[i] + ' ' + tokens[i + 1];
    counts.set(phrase, (counts.get(phrase) || 0) + 1);
  }
  const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  return best || titleTokens[0] || '';
}

function fitSeoTitle(title: string) {
  const normalized = cleanSeoText(title);
  const candidate = normalized.length <= 60 ? normalized : normalized.slice(0, 57).replace(/\s+\S*$/, '').trim() + '…';
  return candidate.slice(0, 60);
}

function fitMetaDescription(source: string, keyword: string) {
  let text = cleanSeoText(source);
  if (!text) text = 'Informasi dan panduan ' + keyword + ' dari Rundingan Kreasi Media.';
  if (keyword && !text.toLocaleLowerCase('id-ID').includes(keyword.toLocaleLowerCase('id-ID'))) {
    text = keyword + ': ' + text;
  }
  if (text.length > 160) {
    const shortened = text.slice(0, 157).replace(/\s+\S*$/, '').trim();
    text = shortened + '…';
  }
  return text.slice(0, 160);
}

/**
 * Generates an editor-reviewable metadata draft using deterministic local heuristics.
 * This function does not call an LLM, search engine, or external API.
 */
export function generateSeoMetadata(input: SeoInput): SeoMetadataDraft {
  const plainText = cleanSeoText(input.content);
  const keyword = chooseFocusKeyword(input, cleanSeoText(input.title) + ' ' + plainText);
  const seoTitle = fitSeoTitle(input.seoTitle || input.title);
  const descriptionSource = input.seoDescription || input.excerpt || plainText.slice(0, 220);
  const seoDescription = fitMetaDescription(descriptionSource, keyword);
  const agents = [
    { agent: 'Keyword Discovery Agent', status: keyword ? 'ready' as const : 'warning' as const, note: keyword ? 'Memilih frasa dari keyword yang diberikan atau istilah dominan pada judul.' : 'Tidak cukup konteks untuk memilih keyword; editor perlu mengisinya.' },
    { agent: 'Search Title Agent', status: seoTitle ? 'ready' as const : 'warning' as const, note: 'Menyusun judul pencarian dengan batas maksimal 60 karakter.' },
    { agent: 'Meta Description Agent', status: seoDescription ? 'ready' as const : 'warning' as const, note: 'Menyusun ringkasan pencarian dengan batas maksimal 160 karakter.' },
  ];
  return {
    focusKeyword: keyword,
    seoTitle,
    seoDescription,
    runtime: 'embedded_rules',
    agents,
    disclaimer: 'Draf ini dibuat oleh generator heuristik lokal, bukan LLM atau data SERP/Google. Periksa akurasi, maksud pencarian, dan gaya editorial sebelum menyimpan atau menerbitkan.',
  };
}
