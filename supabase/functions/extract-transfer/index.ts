import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chunkSize = 8192;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// ── Arabic digit conversion & validation ──

const ARABIC_TO_LATIN: Record<string, string> = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
  '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4',
  '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9',
};

function arabicToLatin(s: string): string {
  if (!s) return '';
  return s.replace(/[٠-٩۰-۹]/g, d => ARABIC_TO_LATIN[d] || d);
}

function stripRtlMarks(s: string): string {
  if (!s) return '';
  return s.replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, '');
}

function normalizeEgyptianPhone(raw: string): string {
  if (!raw) return '';
  let s = arabicToLatin(stripRtlMarks(String(raw)));
  s = s.replace(/[^\d+]/g, '').replace(/^\+/, '');
  if (s.startsWith('200') && s.length === 13) s = s.slice(2);
  if (s.startsWith('20') && s.length === 12) s = '0' + s.slice(2);
  if (/^1[0125]\d{8}$/.test(s)) s = '0' + s;
  return s;
}

function isValidEgyptianMobile(s: string): boolean {
  return /^01[0125]\d{8}$/.test(s);
}

function hardenExtraction(claudeOutput: any) {
  const out = { ...claudeOutput };

  // Force every phone number through the normalizer
  if (Array.isArray(out.phoneNumbers)) {
    out.phoneNumbers = out.phoneNumbers
      .filter((p: any) => typeof p === 'string')
      .map((p: string) => stripRtlMarks(p));
  } else {
    out.phoneNumbers = [];
  }

  // Always re-normalize from phoneNumbers
  const normalized = out.phoneNumbers
    .map(normalizeEgyptianPhone)
    .filter(isValidEgyptianMobile);

  if (Array.isArray(out.normalizedPhoneNumbers)) {
    for (const p of out.normalizedPhoneNumbers) {
      if (typeof p !== 'string') continue;
      const fixed = normalizeEgyptianPhone(p);
      if (isValidEgyptianMobile(fixed) && !normalized.includes(fixed)) {
        normalized.push(fixed);
      }
    }
  }
  out.normalizedPhoneNumbers = Array.from(new Set(normalized));

  // Force amount to Latin digits
  if (typeof out.amount === 'string') {
    out.amount = arabicToLatin(out.amount).replace(/[^\d.,]/g, '');
  }
  if (typeof out.amountNumeric === 'number' && !isNaN(out.amountNumeric)) {
    // OK
  } else if (typeof out.amount === 'string' && out.amount) {
    const parsed = parseFloat(out.amount.replace(/,/g, ''));
    out.amountNumeric = isNaN(parsed) ? null : parsed;
  } else {
    out.amountNumeric = null;
  }

  // Force serviceFee to Latin
  if (typeof out.serviceFee === 'string') {
    out.serviceFee = arabicToLatin(out.serviceFee).replace(/[^\d.,]/g, '');
  }

  // Force cleanedVisibleMessage to use Latin digits
  if (typeof out.cleanedVisibleMessage === 'string') {
    out.cleanedVisibleMessage = arabicToLatin(stripRtlMarks(out.cleanedVisibleMessage));
  }

  // Sanity: amount equals fee?
  if (out.amountNumeric != null && out.serviceFee && parseFloat(out.serviceFee) > 0 && out.amountNumeric === parseFloat(out.serviceFee)) {
    out.notes = [...(out.notes || []), 'WARNING: amount equals service fee — possible fee/amount confusion'];
    out.confidence = Math.min(out.confidence || 50, 50);
  }

  if (out.normalizedPhoneNumbers.length === 0 && out.phoneNumbers.length > 0) {
    out.notes = [...(out.notes || []), 'WARNING: phone numbers detected but none normalized to valid Egyptian format'];
  }

  return out;
}

// ── Tool definition ──

const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "record_transfer_extraction",
    description: "Record fields extracted from a transfer screenshot.",
    parameters: {
      type: "object",
      properties: {
        rawText: { type: "string", description: "Full visible text from the image" },
        phoneNumbers: { type: "array", items: { type: "string" }, description: "All phone numbers as they appear (original form)" },
        normalizedPhoneNumbers: { type: "array", items: { type: "string" }, description: "11-digit Egyptian format starting with 0, Latin digits only" },
        amount: { type: "string", description: "Primary transfer amount as string, Latin digits only" },
        amountNumeric: { type: "number", description: "Primary transfer amount as number" },
        currency: { type: "string", description: "Currency code" },
        serviceFee: { type: "string", description: "Service fee amount, Latin digits only" },
        cleanedVisibleMessage: { type: "string", description: "Readable cleaned message text with English digits" },
        transferSummaryText: { type: "string", description: "One-line English summary" },
        confidence: { type: "number", description: "0-100" },
      },
      required: ["rawText", "phoneNumbers", "normalizedPhoneNumbers", "amount", "amountNumeric", "currency", "serviceFee", "cleanedVisibleMessage", "transferSummaryText", "confidence"],
    },
  },
};

// ── System prompt ──

const SYSTEM_PROMPT = `You are a specialized Arabic OCR and extraction system for Egyptian mobile wallet and bank transfer evidence. The images you process are:

1. Real photos of physical feature phones (Nokia 105, Nokia 130, etc.) held in someone's hand, often with:
   - low resolution and small bright screen text on dark background
   - glare, reflection, finger occlusion, perspective distortion, motion blur
   - tiny Arabic script that is hard to read
   - Arabic-Indic digits ٠١٢٣٤٥٦٧٨٩ — NOT Latin digits

2. Smartphone screenshots from Vodafone Cash, Etisalat Cash, Orange Cash, We Pay, Instapay, CIB, NBE, QNB, and bank SMS confirmations

3. Mixed Arabic + English screens

CRITICAL DIGIT CONVERSION RULES — APPLY TO EVERY NUMERIC FIELD:

The image will almost always contain Arabic-Indic digits, not Latin digits. You MUST convert them to English Latin digits in every numeric output field. This is non-negotiable.

Mapping table (memorize this):
٠ = 0, ١ = 1, ٢ = 2, ٣ = 3, ٤ = 4, ٥ = 5, ٦ = 6, ٧ = 7, ٨ = 8, ٩ = 9

Apply this conversion to: phoneNumbers entries (keep original Arabic form for audit in phoneNumbers, but normalizedPhoneNumbers MUST be pure Latin digits), amount, amountNumeric, serviceFee, cleanedVisibleMessage.

NEVER leave Arabic-Indic digits in normalizedPhoneNumbers, amount, amountNumeric, serviceFee, or cleanedVisibleMessage.

Worked example — if the image shows:
"تم تحويل ٥٠٠٠ جنيه لرقم ٠١٠١٣٨٨٨٣٦٨ مصاريف الخدمة ٠ جنيه رصيد حسابك فى فودافون كاش الحالى ٣١٦٠٣.٤٧"

Your tool call MUST be:
{
  "rawText": "تم تحويل ٥٠٠٠ جنيه لرقم ٠١٠١٣٨٨٨٣٦٨ مصاريف الخدمة ٠ جنيه رصيد حسابك فى فودافون كاش الحالى ٣١٦٠٣.٤٧",
  "phoneNumbers": ["٠١٠١٣٨٨٨٣٦٨"],
  "normalizedPhoneNumbers": ["01013888368"],
  "amount": "5000",
  "amountNumeric": 5000,
  "currency": "EGP",
  "serviceFee": "0",
  "cleanedVisibleMessage": "تم تحويل 5000 جنيه لرقم 01013888368 مصاريف الخدمة 0 جنيه رصيد حسابك فى فودافون كاش الحالى 31603.47",
  "transferSummaryText": "Transferred 5000 EGP to 01013888368 via Vodafone Cash, fee 0, balance 31603.47",
  "confidence": 95
}

CRITICAL AMOUNT RULES:
The primary transfer amount is near: تم تحويل, تحويل, مبلغ, ارسلت, حول, دفع — followed by جنيه / ج.م / EGP / LE.
The service fee is SEPARATE and near: مصاريف الخدمة, رسوم, عمولة, خدمة, ضريبة — DO NOT confuse it with the amount.
The balance is near: رصيد, حسابك, المتاح, الحالي — NEVER select it as the amount.

CRITICAL PHONE NUMBER RULES:
Egyptian mobile: 11 digits starting with 01 followed by 0, 1, 2, or 5.
In Arabic-Indic: ٠١٠xxxxxxxx, ٠١١xxxxxxxx, ٠١٢xxxxxxxx, ٠١٥xxxxxxxx.
Look near: لرقم, رقم, المحفظة, محفظة, للعميل, المستفيد, المستلم, VF-Cash, Vodafone Cash.

Normalization for normalizedPhoneNumbers:
1. Convert Arabic-Indic to Latin
2. Strip spaces, dashes, parentheses, plus signs
3. +20/20 prefix → strip to get 0-prefixed 11-digit number
4. 10 digits starting with 1 → prepend 0
5. Final: exactly 11 digits starting with 01

CLEANED VISIBLE MESSAGE: Merge all lines, convert ALL digits to Latin, keep Arabic words, remove OCR noise.

CONFIDENCE: 95-100 clear, 85-94 minor blur, 70-84 some ambiguity, 50-69 uncertain, <50 too unclear.

NEVER invent values. If unclear, return null and lower confidence.

Call the record_transfer_extraction tool exactly once.`;

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { storagePath, imageBase64, mediaType, screenshotId } = await req.json();

    if (!mediaType || (!storagePath && !imageBase64)) {
      return new Response(
        JSON.stringify({ error: "storagePath (or imageBase64) and mediaType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get base64 from storage or request
    let base64Data = imageBase64;
    if (!base64Data && storagePath) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("transfer-screenshots")
        .download(storagePath);

      if (downloadError || !fileData) {
        const errMsg = downloadError?.message || "Failed to download image from storage";
        if (screenshotId) {
          await supabase.from("transfer_screenshots").update({
            extraction_status: "error",
            extraction_error: errMsg,
          }).eq("id", screenshotId);
        }
        return new Response(
          JSON.stringify({ error: errMsg }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const bytes = new Uint8Array(await fileData.arrayBuffer());
      base64Data = uint8ArrayToBase64(bytes);
    }

    // Call Lovable AI Gateway
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mediaType};base64,${base64Data}` },
              },
              {
                type: "text",
                text: "Extract all transfer details from this image by calling the record_transfer_extraction tool.",
              },
            ],
          },
        ],
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: "function", function: { name: "record_transfer_extraction" } },
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", aiResponse.status, errText.slice(0, 500));
      if (screenshotId) {
        await supabase.from("transfer_screenshots").update({
          extraction_status: "error",
          extraction_error: `AI Gateway error: ${aiResponse.status}`,
        }).eq("id", screenshotId);
      }
      return new Response(
        JSON.stringify({ error: `AI Gateway error: ${aiResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await aiResponse.json();

    // Extract tool call result
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    let extraction: any;

    if (toolCall?.function?.arguments) {
      try {
        extraction = typeof toolCall.function.arguments === "string"
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch {
        extraction = null;
      }
    }

    // Fallback
    if (!extraction) {
      const textContent = data.choices?.[0]?.message?.content || "";
      extraction = {
        rawText: textContent,
        phoneNumbers: [],
        normalizedPhoneNumbers: [],
        amount: null,
        amountNumeric: null,
        currency: null,
        serviceFee: null,
        cleanedVisibleMessage: null,
        transferSummaryText: null,
        confidence: 10,
      };
    }

    // ── Post-process: harden extraction to fix Arabic digit leaks ──
    extraction = hardenExtraction(extraction);

    // Debug log
    console.log('[extract-transfer]', {
      phoneCount: extraction.normalizedPhoneNumbers.length,
      primaryPhone: extraction.normalizedPhoneNumbers[0],
      amount: extraction.amountNumeric,
      fee: extraction.serviceFee,
      confidence: extraction.confidence,
      hasArabicDigitsInOutput: /[٠-٩۰-۹]/.test(JSON.stringify(extraction)),
    });

    // Update the screenshot record in DB
    if (screenshotId) {
      const primaryPhone = extraction.normalizedPhoneNumbers?.[0] || null;

      const updateData: any = {
        extraction_status: "extracted",
        extraction_provider: "lovable-ai-gemini",
        raw_ocr_text: extraction.rawText,
        cleaned_visible_message: extraction.cleanedVisibleMessage,
        transfer_summary_text: extraction.transferSummaryText,
        raw_provider_response: data,
        extracted_phone_raw: extraction.phoneNumbers?.[0] || null,
        extracted_phone_normalized: primaryPhone,
        extracted_amount: extraction.amountNumeric,
        service_fee: extraction.serviceFee ? parseFloat(extraction.serviceFee) : null,
        currency: extraction.currency || "EGP",
      };

      // Auto-match
      if (primaryPhone) {
        const { data: matches } = await supabase
          .from("person_identifiers")
          .select("id, person_id, identifier_type")
          .eq("normalized_value", primaryPhone);

        if (matches && matches.length === 1) {
          updateData.matched_person_id = matches[0].person_id;
          updateData.matched_identifier_id = matches[0].id;
          updateData.matched_identifier_type = matches[0].identifier_type;
          updateData.match_confidence = matches[0].identifier_type === "primary_phone" ? 100 : matches[0].identifier_type === "alternate_phone" ? 95 : 90;
          updateData.match_type = "exact";
          updateData.auto_matched = true;
        }
      }

      // Duplicate check
      if (primaryPhone && extraction.amountNumeric) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: sameDayDupes } = await supabase
          .from("transfer_screenshots")
          .select("id, transaction_code")
          .eq("extracted_phone_normalized", primaryPhone)
          .eq("extracted_amount", extraction.amountNumeric)
          .gte("created_at", `${today}T00:00:00`)
          .neq("id", screenshotId);

        if (sameDayDupes && sameDayDupes.length > 0) {
          updateData.accounting_status = "duplicate_review";
          for (const dupe of sameDayDupes) {
            await supabase.from("screenshot_duplicates").insert({
              screenshot_id: screenshotId,
              duplicate_of_id: dupe.id,
              reason: "same_phone_amount_day",
            });
          }
        }
      }

      await supabase.from("transfer_screenshots").update(updateData).eq("id", screenshotId);
    }

    return new Response(
      JSON.stringify(extraction),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Edge function error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
