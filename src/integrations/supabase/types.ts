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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      known_bad: {
        Row: {
          address: string
          address_type: string
          generated_at: string
          generated_from: string
        }
        Insert: {
          address: string
          address_type: string
          generated_at: string
          generated_from: string
        }
        Update: {
          address?: string
          address_type?: string
          generated_at?: string
          generated_from?: string
        }
        Relationships: []
      }
      labels: {
        Row: {
          label: number | null
          label_rules_version: string
          labelled_at: string
          mint: string
          peak_liquidity_usd: number | null
          reason_code: string | null
          status: string
          value_at_30d: number | null
        }
        Insert: {
          label?: number | null
          label_rules_version: string
          labelled_at?: string
          mint: string
          peak_liquidity_usd?: number | null
          reason_code?: string | null
          status: string
          value_at_30d?: number | null
        }
        Update: {
          label?: number | null
          label_rules_version?: string
          labelled_at?: string
          mint?: string
          peak_liquidity_usd?: number | null
          reason_code?: string | null
          status?: string
          value_at_30d?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "labels_mint_fkey"
            columns: ["mint"]
            isOneToOne: true
            referencedRelation: "tokens"
            referencedColumns: ["mint"]
          },
        ]
      }
      rug_creator_funders: {
        Row: {
          first_seen_at: string
          funder_address: string
          rugged_creator_count: number
          updated_at: string
        }
        Insert: {
          first_seen_at?: string
          funder_address: string
          rugged_creator_count?: number
          updated_at?: string
        }
        Update: {
          first_seen_at?: string
          funder_address?: string
          rugged_creator_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      snapshots: {
        Row: {
          created_at: string
          decision_time: string
          features: Json
          mint: string
          provider_observed_at: string
          raw_provider_refs: Json
        }
        Insert: {
          created_at?: string
          decision_time: string
          features: Json
          mint: string
          provider_observed_at: string
          raw_provider_refs?: Json
        }
        Update: {
          created_at?: string
          decision_time?: string
          features?: Json
          mint?: string
          provider_observed_at?: string
          raw_provider_refs?: Json
        }
        Relationships: [
          {
            foreignKeyName: "snapshots_mint_fkey"
            columns: ["mint"]
            isOneToOne: true
            referencedRelation: "tokens"
            referencedColumns: ["mint"]
          },
        ]
      }
      tokens: {
        Row: {
          creator: string | null
          discovered_at: string
          last_snapshot_at: string | null
          launch_time: string
          launch_time_source: string
          mint: string
          outcome_checked_at: string | null
          pair_address: string | null
          snapshot_due_at: string
        }
        Insert: {
          creator?: string | null
          discovered_at?: string
          last_snapshot_at?: string | null
          launch_time: string
          launch_time_source: string
          mint: string
          outcome_checked_at?: string | null
          pair_address?: string | null
          snapshot_due_at: string
        }
        Update: {
          creator?: string | null
          discovered_at?: string
          last_snapshot_at?: string | null
          launch_time?: string
          launch_time_source?: string
          mint?: string
          outcome_checked_at?: string | null
          pair_address?: string | null
          snapshot_due_at?: string
        }
        Relationships: []
      }
      watchlist: {
        Row: {
          baseline_trust: number
          created_at: string
          liquidity_drop_pct: number
          mint: string
          trust: number
          updated_at: string
        }
        Insert: {
          baseline_trust: number
          created_at?: string
          liquidity_drop_pct?: number
          mint: string
          trust: number
          updated_at?: string
        }
        Update: {
          baseline_trust?: number
          created_at?: string
          liquidity_drop_pct?: number
          mint?: string
          trust?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      pipeline_known_bad_candidates: {
        Args: { _before?: string; _min_funder_count?: number }
        Returns: {
          address: string
          address_type: string
        }[]
      }
      pipeline_replace_known_bad: {
        Args: {
          _creators: string[]
          _funders: string[]
          _generated_at: string
          _generated_from: string
        }
        Returns: number
      }
      pipeline_training_rows: {
        Args: never
        Returns: {
          features: Json
          label: number
          label_rules_version: string
          launch_time: string
          mint: string
          status: string
        }[]
      }
      pipeline_watchlist_alerts: {
        Args: { _liquidity_drop?: number; _trust_drop?: number }
        Returns: {
          baseline_trust: number
          liquidity_drop_pct: number
          mint: string
          trust: number
        }[]
      }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
