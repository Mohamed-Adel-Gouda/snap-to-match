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

const EXTRACTION_TOOL = {
  type: "function" as const,
  function: {
    name: "record_transfer_extraction",
    description: "Record fields extracted from a transfer screenshot.",
    parameters: {
      type: "object",
      properties: {
        rawText: { type: "string", description: "Full visible text from the image" },
        phoneNumbers: { type: "array", items: { type: "string" }, description: "All phone numbers as they appear" },
        normalizedPhoneNumbers: { type: "array", items: { type: "string" }, description: "11-digit Egyptian format starting with 0" },
        amount: { type: "string", description: "Primary transfer amount as string" },
        amountNumeric: { type: "number", description: "Primary transfer amount as number" },
        currency: { type: "string", description: "Currency code" },
        serviceFee: { type: "string", description: "Service fee amount" },
        cleanedVisibleMessage: { type: "string", description: "Readable cleaned message text with English digits" },
        transferSummaryText: { type: "string", description: "One-line English summary" },
        confidence: { type: "number", description: "0-100" },
      },
      required: ["rawText", "phoneNumbers", "normalizedPhoneNumbers", "amount", "amountNumeric", "currency", "serviceFee", "cleanedVisibleMessage", "transferSummaryText", "confidence"],
    },
  },
};

const SYSTEM_PROMPT = `You are an extraction system for Egyptian mobile wallet and bank transfer screenshots AND photos of feature phone screens (Nokia, etc.) showing Vodafone Cash, Etisalat Cash, Orange Cash, or bank SMS confirmations.

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

Critical rules for phone numbers:
- Extract every phone-looking number visible. Look near "لرقم", "رقم", "VF-Cash", "محفظة".
- Normalize to 11 digits starting with 0: ٠١٠١٣٨٨٨٣٦٨ → 01013888368, +201013888368 → 01013888368.

Call the record_transfer_extraction tool exactly once with all extracted fields. Use null for what you cannot determine. Never invent values.`;

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

    // Get base64 either from request or by downloading from storage
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

    // Call Lovable AI Gateway (Gemini with vision support)
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
