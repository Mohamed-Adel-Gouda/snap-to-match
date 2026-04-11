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
  if (s.startsWith('200') && s.length === 13) s = s.slice(2);
  if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  if (/^1[0125]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

export function isValidEgyptianMobile(s: string): boolean {
  return /^01[0125]\d{8}$/.test(s);
}

const ARABIC_DIGIT_REGEX = /[٠-٩۰-۹]{10,15}/g;
const ARABIC_GLUED_REGEX = /(?:[٠-٩۰-۹][\s\-]){9,14}[٠-٩۰-۹]/g;

export function extractCandidateNumbers(ocrText: string) {
  if (!ocrText) return [];
  const sanitized = ocrText.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
  const latinText = arabicToEnglishDigits(sanitized);
  const seen = new Set<string>();
  const out: { raw: string; normalized: string; score: number; source: string }[] = [];

  const register = (raw: string, source: string) => {
    const norm = normalizePhone(raw);
    if (!isValidEgyptianMobile(norm) || seen.has(norm)) return;
    seen.add(norm);
    out.push({ raw, normalized: norm, score: 90, source });
  };

  // Pass 1: standard Latin digit run
  for (const m of latinText.matchAll(/\d{10,15}/g)) register(m[0], 'latin-run');

  // Pass 2: Latin digits with separators (RTL artifact)
  for (const m of latinText.matchAll(/(?:\d[\s\-]){9,14}\d/g)) register(m[0].replace(/[\s\-]/g, ''), 'latin-glued');

  // Pass 3: Arabic-Indic digit run on ORIGINAL text
  for (const m of ocrText.matchAll(ARABIC_DIGIT_REGEX)) register(arabicToEnglishDigits(m[0]), 'arabic-run');

  // Pass 4: Arabic-Indic glued
  for (const m of ocrText.matchAll(ARABIC_GLUED_REGEX)) register(arabicToEnglishDigits(m[0]).replace(/[\s\-]/g, ''), 'arabic-glued');

  // Pass 5: international format (+20...)
  for (const m of latinText.matchAll(/\+?20\s?1[0125]\d{8}/g)) register(m[0], 'international');

  return out.sort((a, b) => b.score - a.score);
}

export function extractTransferAmount(text: string): { value: number; raw: string } | null {
  if (!text) return null;
  const cleaned = arabicToEnglishDigits(text);
  const feeMarkers = ['مصاريف', 'رسوم', 'خدمة', 'fee', 'charge', 'عمولة', 'ضريبة'];
  const amountMarkers = ['تحويل', 'مبلغ', 'sent', 'transferred', 'amount', 'ارسلت', 'حول', 'دفع'];
  const currencyMarkers = ['جنيه', 'egp', 'le', 'ج.م', 'جنيها'];
  const balanceMarkers = ['رصيد', 'حسابك', 'المتاح', 'الحالي', 'الحالى'];
  const candidates: { value: number; raw: string; score: number }[] = [];

  // Pre-identify phone-number digit ranges (10+ consecutive digits) to exclude
  const phoneRanges: [number, number][] = [];
  for (const m of cleaned.matchAll(/\d{10,}/g)) {
    phoneRanges.push([m.index!, m.index! + m[0].length]);
  }
  const isInPhoneRange = (start: number, end: number) =>
    phoneRanges.some(([ps, pe]) => start >= ps && end <= pe);

  for (const m of cleaned.matchAll(/(\d{1,7}(?:[.,]\d{1,2})?)/g)) {
    const value = parseFloat(m[1].replace(',', '.'));
    if (isNaN(value) || value <= 0 || value > 10000000) continue;
    // Skip if this match falls within a phone number digit run
    if (isInPhoneRange(m.index!, m.index! + m[1].length)) continue;

    const ctxStart = Math.max(0, m.index! - 80);
    const ctxEnd = Math.min(cleaned.length, m.index! + m[1].length + 80);
    const context = cleaned.slice(ctxStart, ctxEnd).toLowerCase();
    let score = 0;
    if (currencyMarkers.some(c => context.includes(c))) score += 50;
    if (amountMarkers.some(a => context.includes(a))) score += 40;
    if (feeMarkers.some(f => context.includes(f))) score -= 60;
    if (balanceMarkers.some(b => context.includes(b))) score -= 80;
    if (value >= 100) score += 10;
    candidates.push({ value, raw: m[1], score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.score >= 0 ? { value: candidates[0].value, raw: candidates[0].raw } : null;
}

export function reinforceExtraction(visionResult: any) {
  if (!visionResult?.rawText) return visionResult;

  const regexCandidates = extractCandidateNumbers(visionResult.rawText);

  if (!Array.isArray(visionResult.normalizedPhoneNumbers)) {
    visionResult.normalizedPhoneNumbers = [];
  }
  if (!Array.isArray(visionResult.phoneNumbers)) {
    visionResult.phoneNumbers = [];
  }

  for (const c of regexCandidates) {
    if (!visionResult.normalizedPhoneNumbers.includes(c.normalized)) {
      visionResult.normalizedPhoneNumbers.push(c.normalized);
      visionResult.phoneNumbers.push(c.raw);
    }
  }

  if (visionResult.amountNumeric == null) {
    const amt = extractTransferAmount(visionResult.rawText);
    if (amt) {
      visionResult.amountNumeric = amt.value;
      visionResult.amount = String(amt.value);
    }
  }

  return visionResult;
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
