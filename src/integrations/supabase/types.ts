export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          entity_id: string
          entity_type: string
          id: string
          new_value: Json | null
          old_value: Json | null
          performed_at: string | null
          performed_by: string | null
        }
        Insert: {
          action: string
          entity_id: string
          entity_type: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string | null
          performed_by?: string | null
        }
        Update: {
          action?: string
          entity_id?: string
          entity_type?: string
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          performed_at?: string | null
          performed_by?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          created_at: string | null
          full_name: string
          id: string
          notes: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          full_name: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string
          id?: string
          notes?: string | null
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      person_identifiers: {
        Row: {
          created_at: string | null
          id: string
          identifier_type: string
          is_primary: boolean | null
          normalized_value: string
          person_id: string
          raw_value: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          identifier_type: string
          is_primary?: boolean | null
          normalized_value: string
          person_id: string
          raw_value: string
        }
        Update: {
          created_at?: string | null
          id?: string
          identifier_type?: string
          is_primary?: boolean | null
          normalized_value?: string
          person_id?: string
          raw_value?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_identifiers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          display_name: string | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          display_name?: string | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      screenshot_duplicates: {
        Row: {
          created_at: string | null
          duplicate_of_id: string
          id: string
          reason: string
          screenshot_id: string
        }
        Insert: {
          created_at?: string | null
          duplicate_of_id: string
          id?: string
          reason: string
          screenshot_id: string
        }
        Update: {
          created_at?: string | null
          duplicate_of_id?: string
          id?: string
          reason?: string
          screenshot_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screenshot_duplicates_duplicate_of_id_fkey"
            columns: ["duplicate_of_id"]
            isOneToOne: false
            referencedRelation: "transfer_screenshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "screenshot_duplicates_screenshot_id_fkey"
            columns: ["screenshot_id"]
            isOneToOne: false
            referencedRelation: "transfer_screenshots"
            referencedColumns: ["id"]
          },
        ]
      }
      transfer_screenshots: {
        Row: {
          accounting_status: string | null
          approved_amount: number | null
          auto_matched: boolean | null
          cleaned_visible_message: string | null
          created_at: string | null
          currency: string | null
          extracted_amount: number | null
          extracted_phone_normalized: string | null
          extracted_phone_raw: string | null
          extraction_error: string | null
          extraction_provider: string | null
          extraction_status: string | null
          filename: string
          id: string
          image_fingerprint: string | null
          match_confidence: number | null
          match_type: string | null
          matched_identifier_id: string | null
          matched_identifier_type: string | null
          matched_person_id: string | null
          raw_ocr_text: string | null
          raw_provider_response: Json | null
          reject_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          reviewer_notes: string | null
          service_fee: number | null
          storage_path: string
          transaction_code: string
          transfer_summary_text: string | null
          updated_at: string | null
          uploaded_by: string | null
        }
        Insert: {
          accounting_status?: string | null
          approved_amount?: number | null
          auto_matched?: boolean | null
          cleaned_visible_message?: string | null
          created_at?: string | null
          currency?: string | null
          extracted_amount?: number | null
          extracted_phone_normalized?: string | null
          extracted_phone_raw?: string | null
          extraction_error?: string | null
          extraction_provider?: string | null
          extraction_status?: string | null
          filename: string
          id?: string
          image_fingerprint?: string | null
          match_confidence?: number | null
          match_type?: string | null
          matched_identifier_id?: string | null
          matched_identifier_type?: string | null
          matched_person_id?: string | null
          raw_ocr_text?: string | null
          raw_provider_response?: Json | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          service_fee?: number | null
          storage_path: string
          transaction_code: string
          transfer_summary_text?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Update: {
          accounting_status?: string | null
          approved_amount?: number | null
          auto_matched?: boolean | null
          cleaned_visible_message?: string | null
          created_at?: string | null
          currency?: string | null
          extracted_amount?: number | null
          extracted_phone_normalized?: string | null
          extracted_phone_raw?: string | null
          extraction_error?: string | null
          extraction_provider?: string | null
          extraction_status?: string | null
          filename?: string
          id?: string
          image_fingerprint?: string | null
          match_confidence?: number | null
          match_type?: string | null
          matched_identifier_id?: string | null
          matched_identifier_type?: string | null
          matched_person_id?: string | null
          raw_ocr_text?: string | null
          raw_provider_response?: Json | null
          reject_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          reviewer_notes?: string | null
          service_fee?: number | null
          storage_path?: string
          transaction_code?: string
          transfer_summary_text?: string | null
          updated_at?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transfer_screenshots_matched_identifier_id_fkey"
            columns: ["matched_identifier_id"]
            isOneToOne: false
            referencedRelation: "person_identifiers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transfer_screenshots_matched_person_id_fkey"
            columns: ["matched_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
