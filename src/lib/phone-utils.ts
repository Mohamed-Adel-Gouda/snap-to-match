const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function arabicToEnglishDigits(str: string): string {
  if (!str) return '';
  return str.split('').map(ch => {
    const ai = ARABIC_DIGITS.indexOf(ch);
    if (ai !== -1) return String(ai);
    const pi = PERSIAN_DIGITS.indexOf(ch);
    if (pi !== -1) return String(pi);
    return ch;
  }).join('');
}

export function normalizePhone(raw: string): string {
  if (!raw) return '';
  let s = arabicToEnglishDigits(String(raw)).replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  if (s.startsWith('200') && s.length === 13) s = s.slice(2);
  if (/^1[0125]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

export function extractCandidateNumbers(ocrText: string) {
  if (!ocrText) return [];
  const cleaned = ocrText
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '')
    .replace(/[\u00A0\u2000-\u200A]/g, ' ');
  const text = arabicToEnglishDigits(cleaned);
  const seen = new Set<string>();
  const candidates: { raw: string; normalized: string; score: number }[] = [];

  const register = (raw: string) => {
    const norm = normalizePhone(raw);
    if (norm.length < 10 || norm.length > 15 || seen.has(norm)) return;
    seen.add(norm);
    const isEgyptianMobile = /^01[0125]\d{8}$/.test(norm);
    candidates.push({ raw, normalized: norm, score: isEgyptianMobile ? 90 : 50 });
  };

  for (const m of text.matchAll(/\d{10,15}/g)) register(m[0]);
  for (const m of text.matchAll(/(?:\d[\s\-]){9,14}\d/g)) register(m[0].replace(/[\s\-]/g, ''));
  for (const m of ocrText.matchAll(/[٠-٩۰-۹]{10,15}/g)) register(arabicToEnglishDigits(m[0]));

  return candidates.sort((a, b) => b.score - a.score);
}

export function extractTransferAmount(text: string): { value: number; raw: string } | null {
  if (!text) return null;
  const cleaned = arabicToEnglishDigits(text);
  const feeMarkers = ['مصاريف', 'رسوم', 'خدمة', 'fee', 'charge'];
  const amountMarkers = ['تحويل', 'مبلغ', 'sent', 'transferred', 'amount'];
  const currencyMarkers = ['جنيه', 'egp', 'le'];
  const candidates: { value: number; raw: string; score: number }[] = [];

  for (const m of cleaned.matchAll(/(\d{1,7}(?:[.,]\d{1,2})?)/g)) {
    const value = parseFloat(m[1].replace(',', '.'));
    if (isNaN(value) || value <= 0 || value > 10000000) continue;
    const ctxStart = Math.max(0, m.index! - 40);
    const ctxEnd = Math.min(cleaned.length, m.index! + m[1].length + 40);
    const context = cleaned.slice(ctxStart, ctxEnd).toLowerCase();
    let score = 0;
    if (currencyMarkers.some(c => context.includes(c))) score += 50;
    if (amountMarkers.some(a => context.includes(a))) score += 40;
    if (feeMarkers.some(f => context.includes(f))) score -= 60;
    if (value >= 100) score += 10;
    candidates.push({ value, raw: m[1], score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 0 ? { value: candidates[0].value, raw: candidates[0].raw } : null;
}

export function generateImageFingerprint(base64: string): string {
  const len = base64.length;
  const first100 = base64.slice(0, 100);
  const last100 = base64.slice(-100);
  return `${len}:${first100}:${last100}`;
}

export function generateTransactionCode(existingCount: number): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const seq = String(existingCount + 1).padStart(4, '0');
  return `TX-${dateStr}-${seq}`;
}
