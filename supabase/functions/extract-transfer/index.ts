import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(
        JSON.stringify({ error: "ANTHROPIC_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { imageBase64, mediaType, screenshotId } = await req.json();

    if (!imageBase64 || !mediaType) {
      return new Response(
        JSON.stringify({ error: "imageBase64 and mediaType are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Call Anthropic Claude Vision
    const anthropicBody = {
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: `You are an extraction system for Egyptian mobile wallet and bank transfer screenshots AND photos of feature phone screens (Nokia, etc.) showing Vodafone Cash, Etisalat Cash, Orange Cash, or bank SMS confirmations.

Images may be:
- Clean screenshots from a smartphone app
- Real photos of a physical phone screen (with glare, blur, fingers holding the phone, dark backgrounds with bright text)
- Arabic text with Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) that MUST be converted to English (0123456789)

Critical rules for digits:
- Arabic-Indic ٠١٢٣٤٥٦٧٨٩ MUST be converted to English 0123456789 in ALL numeric fields.
- ٥٠٠٠ = 5000, ٠١٠١٣٨٨٨٣٦٨ = 01013888368

Critical rules for the amount:
- The primary transfer amount is near "تم تحويل", "تحويل", "مبلغ", "sent", "transferred", followed by "جنيه" / "EGP".
- DO NOT select a service fee as the amount. Service fees are near "مصاريف الخدمة", "رسوم", "fee". Put these in serviceFee.
- DO NOT select the balance (near "رصيد") as the amount.
- Example: "تم تحويل ٥٠٠٠ جنيه لرقم ٠١٠١٣٨٨٨٣٦٨ مصاريف الخدمة ٠" → amount is "5000", serviceFee is "0".

Critical rules for phone numbers:
- Extract every phone-looking number visible. Look near "لرقم", "رقم", "VF-Cash", "محفظة".
- Normalize to 11 digits starting with 0: ٠١٠١٣٨٨٨٣٦٨ → 01013888368, +201013888368 → 01013888368.

Call the record_transfer_extraction tool exactly once with all extracted fields. Use null for what you cannot determine. Never invent values.`,
      tools: [{
        name: "record_transfer_extraction",
        description: "Record fields extracted from a transfer screenshot.",
        input_schema: {
          type: "object",
          properties: {
            rawText: { type: "string", description: "Full visible text from the image" },
            phoneNumbers: { type: "array", items: { type: "string" }, description: "All phone numbers as they appear (may include Arabic digits)" },
            normalizedPhoneNumbers: { type: "array", items: { type: "string" }, description: "11-digit Egyptian format starting with 0" },
            amount: { type: ["string", "null"], description: "Primary transfer amount as string" },
            amountNumeric: { type: ["number", "null"], description: "Primary transfer amount as number" },
            currency: { type: ["string", "null"] },
            serviceFee: { type: ["string", "null"] },
            cleanedVisibleMessage: { type: ["string", "null"], description: "Readable cleaned message text with English digits" },
            transferSummaryText: { type: ["string", "null"], description: "One-line English summary" },
            confidence: { type: "number", description: "0-100" },
          },
          required: ["rawText", "phoneNumbers", "normalizedPhoneNumbers", "amount", "amountNumeric", "currency", "serviceFee", "cleanedVisibleMessage", "transferSummaryText", "confidence"],
        },
      }],
      tool_choice: { type: "tool", name: "record_transfer_extraction" },
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: "Extract all transfer details from this image by calling the record_transfer_extraction tool." },
        ],
      }],
    };

    const anthropicResponse = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify(anthropicBody),
    });

    const rawBody = await anthropicResponse.text();

    if (!anthropicResponse.ok) {
      console.error("Anthropic API error:", rawBody.slice(0, 500));
      // Update screenshot with error if we have an ID
      if (screenshotId) {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const supabase = createClient(supabaseUrl, supabaseKey);
        await supabase.from("transfer_screenshots").update({
          extraction_status: "error",
          extraction_error: `Anthropic API error: ${anthropicResponse.status}`,
        }).eq("id", screenshotId);
      }
      return new Response(
        JSON.stringify({ error: `Anthropic API error: ${anthropicResponse.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let data;
    try {
      data = JSON.parse(rawBody.trim().replace(/^```json\s*/i, "").replace(/```$/i, ""));
    } catch {
      return new Response(
        JSON.stringify({ error: `Non-JSON response: ${rawBody.slice(0, 200)}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extract tool_use block
    const toolUse = data.content?.find((b: any) => b.type === "tool_use");
    let extraction = toolUse?.input;

    // Fallback: try to extract from text
    if (!extraction) {
      const textContent = data.content?.filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n") || "";
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

    // Update the screenshot record in DB if screenshotId provided
    if (screenshotId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const primaryPhone = extraction.normalizedPhoneNumbers?.[0] || null;

      const updateData: any = {
        extraction_status: "extracted",
        extraction_provider: "claude-vision",
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

      // Try to auto-match
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

      // Check for same-phone-amount-day duplicates
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
