import { describe, it, expect } from "vitest";
import {
  arabicToEnglishDigits,
  normalizePhone,
  extractCandidateNumbers,
  extractTransferAmount,
  isValidEgyptianMobile,
} from "@/lib/phone-utils";

describe("arabicToEnglishDigits", () => {
  it("converts Arabic-Indic digits to Latin", () => {
    expect(arabicToEnglishDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
  });
  it("converts Persian digits to Latin", () => {
    expect(arabicToEnglishDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
  });
  it("preserves Latin digits and Arabic text", () => {
    expect(arabicToEnglishDigits("تحويل 5000")).toBe("تحويل 5000");
  });
});

describe("normalizePhone", () => {
  it("normalizes Arabic-Indic phone", () => {
    expect(normalizePhone("٠١٠١٣٨٨٨٣٦٨")).toBe("01013888368");
  });
  it("strips +20 prefix", () => {
    expect(normalizePhone("+201013888368")).toBe("01013888368");
  });
  it("strips 20 prefix (12 digits)", () => {
    expect(normalizePhone("201013888368")).toBe("01013888368");
  });
  it("strips 200 prefix (13 digits)", () => {
    expect(normalizePhone("2001013888368")).toBe("01013888368");
  });
  it("prepends 0 for 10 digit number", () => {
    expect(normalizePhone("1013888368")).toBe("01013888368");
  });
});

const testCases = [
  {
    name: "Arabic-Indic Vodafone Cash",
    input: "تم تحويل ٥٠٠٠ جنيه لرقم ٠١٠١٣٨٨٨٣٦٨ مصاريف الخدمة ٠ جنيه",
    expectedPhone: "01013888368",
    expectedAmount: 5000,
    expectedFee: "0",
  },
  {
    name: "Latin digits transfer",
    input: "تم تحويل 5000 جنيه لرقم 01013888368 مصاريف الخدمة 0",
    expectedPhone: "01013888368",
    expectedAmount: 5000,
    expectedFee: "0",
  },
  {
    name: "Transfer with fee",
    input: "حول 250 جنيه إلى 01112345678 رسوم 2.5",
    expectedPhone: "01112345678",
    expectedAmount: 250,
    expectedFee: null, // extractTransferAmount only returns the main amount
  },
  {
    name: "English text transfer",
    input: "Transfer EGP 1000 to 01287654321",
    expectedPhone: "01287654321",
    expectedAmount: 1000,
    expectedFee: null,
  },
  {
    name: "International format with +20",
    input: "تم تحويل ٧٥٠٠ جنيه إلى ٢٠١٠١٣٨٨٨٣٦٨ رصيدك الحالى ٤٥٠٠٠.٠٠",
    expectedPhone: "01013888368",
    expectedAmount: 7500,
    expectedFee: null,
  },
  {
    name: "Vodafone Cash wallet",
    input: "محفظة فودافون كاش رقم ٠١٥١١٢٢٣٣٤٤ المبلغ ٣٠٠ جنيه",
    expectedPhone: "01511223344",
    expectedAmount: 300,
    expectedFee: null,
  },
];

describe("extractCandidateNumbers", () => {
  testCases.forEach(tc => {
    it(`extracts phone from: ${tc.name}`, () => {
      const candidates = extractCandidateNumbers(tc.input);
      expect(candidates.length).toBeGreaterThan(0);
      expect(candidates[0].normalized).toBe(tc.expectedPhone);
      // Ensure no Arabic-Indic digits leak into normalized
      expect(/[٠-٩۰-۹]/.test(candidates[0].normalized)).toBe(false);
    });
  });
});

describe("extractTransferAmount", () => {
  it("extracts 5000 from Arabic-Indic text", () => {
    const result = extractTransferAmount("تم تحويل ٥٠٠٠ جنيه لرقم ٠١٠١٣٨٨٨٣٦٨ مصاريف الخدمة ٠ جنيه");
    expect(result).not.toBeNull();
    expect(result!.value).toBe(5000);
  });

  it("extracts 7500 and ignores balance", () => {
    const result = extractTransferAmount("تم تحويل ٧٥٠٠ جنيه إلى ٢٠١٠١٣٨٨٨٣٦٨ رصيدك الحالى ٤٥٠٠٠.٠٠");
    expect(result).not.toBeNull();
    expect(result!.value).toBe(7500);
  });

  it("extracts 300 from wallet text", () => {
    const result = extractTransferAmount("محفظة فودافون كاش رقم ٠١٥١١٢٢٣٣٤٤ المبلغ ٣٠٠ جنيه");
    expect(result).not.toBeNull();
    expect(result!.value).toBe(300);
  });

  it("does not pick fee as amount", () => {
    const result = extractTransferAmount("تم تحويل ٥٠٠٠ جنيه لرقم ٠١٠١٣٨٨٨٣٦٨ مصاريف الخدمة ٠ جنيه رصيد حسابك فى فودافون كاش الحالى ٣١٦٠٣.٤٧");
    expect(result).not.toBeNull();
    expect(result!.value).toBe(5000);
  });
});

describe("isValidEgyptianMobile", () => {
  it("validates correct numbers", () => {
    expect(isValidEgyptianMobile("01013888368")).toBe(true);
    expect(isValidEgyptianMobile("01112345678")).toBe(true);
    expect(isValidEgyptianMobile("01287654321")).toBe(true);
    expect(isValidEgyptianMobile("01511223344")).toBe(true);
  });
  it("rejects invalid", () => {
    expect(isValidEgyptianMobile("0131234567")).toBe(false);
    expect(isValidEgyptianMobile("1013888368")).toBe(false);
    expect(isValidEgyptianMobile("01013888")).toBe(false);
  });
});
