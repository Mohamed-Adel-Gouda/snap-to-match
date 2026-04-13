import { supabase } from "@/integrations/supabase/client";

export async function linkOrphanedUploads(personId: string, normalizedPhones: string[]): Promise<number> {
  if (normalizedPhones.length === 0) return 0;
  const { data, error } = await supabase
    .from("transfer_screenshots")
    .update({
      matched_person_id: personId,
      match_type: "retroactive",
      auto_matched: true,
    })
    .is("matched_person_id", null)
    .in("extracted_phone_normalized", normalizedPhones)
    .select("id");
  if (error) throw error;
  return data?.length || 0;
}
