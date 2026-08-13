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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      billing_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          meta: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          meta?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          meta?: Json
          user_id?: string
        }
        Relationships: []
      }
      change_items: {
        Row: {
          action: string
          created_at: string
          csi_division: string | null
          grade: string | null
          id: string
          label: string
          material: string | null
          qty: number | null
          qty_source: string | null
          uom: string | null
          version_id: string
        }
        Insert: {
          action: string
          created_at?: string
          csi_division?: string | null
          grade?: string | null
          id?: string
          label: string
          material?: string | null
          qty?: number | null
          qty_source?: string | null
          uom?: string | null
          version_id: string
        }
        Update: {
          action?: string
          created_at?: string
          csi_division?: string | null
          grade?: string | null
          id?: string
          label?: string
          material?: string | null
          qty?: number | null
          qty_source?: string | null
          uom?: string | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "change_items_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_mappings: {
        Row: {
          grade: string
          id: string
          label: string
          material: string | null
          qty_formula: string
          unit_cost_id: string
        }
        Insert: {
          grade: string
          id?: string
          label: string
          material?: string | null
          qty_formula: string
          unit_cost_id: string
        }
        Update: {
          grade?: string
          id?: string
          label?: string
          material?: string | null
          qty_formula?: string
          unit_cost_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_mappings_unit_cost_id_fkey"
            columns: ["unit_cost_id"]
            isOneToOne: false
            referencedRelation: "unit_costs"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_accounts: {
        Row: {
          balance: number
          created_at: string
          free_day: string
          free_used_today: number
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          free_day?: string
          free_used_today?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          free_day?: string
          free_used_today?: number
          plan?: Database["public"]["Enums"]["plan_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_ledger: {
        Row: {
          action: Database["public"]["Enums"]["credit_action"]
          balance_after: number
          created_at: string
          delta: number
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          action: Database["public"]["Enums"]["credit_action"]
          balance_after: number
          created_at?: string
          delta: number
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          action?: Database["public"]["Enums"]["credit_action"]
          balance_after?: number
          created_at?: string
          delta?: number
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      feedback: {
        Row: {
          attachment_path: string | null
          body: string
          category: string
          created_at: string
          id: string
          status: string
          user_id: string
          view_context: string | null
        }
        Insert: {
          attachment_path?: string | null
          body: string
          category?: string
          created_at?: string
          id?: string
          status?: string
          user_id: string
          view_context?: string | null
        }
        Update: {
          attachment_path?: string | null
          body?: string
          category?: string
          created_at?: string
          id?: string
          status?: string
          user_id?: string
          view_context?: string | null
        }
        Relationships: []
      }
      founding_members: {
        Row: {
          claimed_at: string
          id: string
          plan: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: string
          plan?: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: string
          plan?: string
          user_id?: string
        }
        Relationships: []
      }
      markets: {
        Row: {
          cbsa_code: string | null
          id: string
          labor_factor: number
          material_factor: number
          name: string
          source: string | null
          updated_at: string
        }
        Insert: {
          cbsa_code?: string | null
          id?: string
          labor_factor?: number
          material_factor?: number
          name: string
          source?: string | null
          updated_at?: string
        }
        Update: {
          cbsa_code?: string | null
          id?: string
          labor_factor?: number
          material_factor?: number
          name?: string
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      plan_requests: {
        Row: {
          created_at: string
          current_plan: Database["public"]["Enums"]["plan_tier"]
          decided_at: string | null
          id: string
          note: string | null
          requested_plan: Database["public"]["Enums"]["plan_tier"]
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          current_plan: Database["public"]["Enums"]["plan_tier"]
          decided_at?: string | null
          id?: string
          note?: string | null
          requested_plan: Database["public"]["Enums"]["plan_tier"]
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          current_plan?: Database["public"]["Enums"]["plan_tier"]
          decided_at?: string | null
          id?: string
          note?: string | null
          requested_plan?: Database["public"]["Enums"]["plan_tier"]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      presentation_events: {
        Row: {
          created_at: string
          detail: string | null
          id: string
          kind: string
          meta: Json
          presentation_id: string
        }
        Insert: {
          created_at?: string
          detail?: string | null
          id?: string
          kind: string
          meta?: Json
          presentation_id: string
        }
        Update: {
          created_at?: string
          detail?: string | null
          id?: string
          kind?: string
          meta?: Json
          presentation_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_events_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentations: {
        Row: {
          brand_accent: string | null
          brand_name: string | null
          client_email: string | null
          client_name: string | null
          created_at: string
          decided_at: string | null
          decision_note: string | null
          excluded_lines: Json
          id: string
          last_viewed_at: string | null
          line_notes: Json
          reminded_at: string | null
          reminder_count: number
          status: string
          title: string
          token: string
          version_id: string
          view_count: number
        }
        Insert: {
          brand_accent?: string | null
          brand_name?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          excluded_lines?: Json
          id?: string
          last_viewed_at?: string | null
          line_notes?: Json
          reminded_at?: string | null
          reminder_count?: number
          status?: string
          title: string
          token?: string
          version_id: string
          view_count?: number
        }
        Update: {
          brand_accent?: string | null
          brand_name?: string | null
          client_email?: string | null
          client_name?: string | null
          created_at?: string
          decided_at?: string | null
          decision_note?: string | null
          excluded_lines?: Json
          id?: string
          last_viewed_at?: string | null
          line_notes?: Json
          reminded_at?: string | null
          reminder_count?: number
          status?: string
          title?: string
          token?: string
          version_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "presentations_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget_band: string
          budget_target: number | null
          created_at: string
          finish_grade: string
          id: string
          name: string
          property_id: string
        }
        Insert: {
          budget_band?: string
          budget_target?: number | null
          created_at?: string
          finish_grade?: string
          id?: string
          name: string
          property_id: string
        }
        Update: {
          budget_band?: string
          budget_target?: number | null
          created_at?: string
          finish_grade?: string
          id?: string
          name?: string
          property_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      properties: {
        Row: {
          address: string
          city: string | null
          created_at: string
          design_dna: Json
          id: string
          market_id: string | null
          owner_id: string
          postal_code: string | null
          state: string | null
        }
        Insert: {
          address: string
          city?: string | null
          created_at?: string
          design_dna?: Json
          id?: string
          market_id?: string | null
          owner_id?: string
          postal_code?: string | null
          state?: string | null
        }
        Update: {
          address?: string
          city?: string | null
          created_at?: string
          design_dna?: Json
          id?: string
          market_id?: string | null
          owner_id?: string
          postal_code?: string | null
          state?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "properties_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          ceiling_ht_in: number | null
          created_at: string
          dims_confirmed_at: string | null
          dims_source: string | null
          floor_area_sf: number | null
          id: string
          name: string
          perimeter_lf: number | null
          project_id: string
          room_type: string
          wall_area_sf: number | null
        }
        Insert: {
          ceiling_ht_in?: number | null
          created_at?: string
          dims_confirmed_at?: string | null
          dims_source?: string | null
          floor_area_sf?: number | null
          id?: string
          name: string
          perimeter_lf?: number | null
          project_id: string
          room_type: string
          wall_area_sf?: number | null
        }
        Update: {
          ceiling_ht_in?: number | null
          created_at?: string
          dims_confirmed_at?: string | null
          dims_source?: string | null
          floor_area_sf?: number | null
          id?: string
          name?: string
          perimeter_lf?: number | null
          project_id?: string
          room_type?: string
          wall_area_sf?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "rooms_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_lines: {
        Row: {
          change_item_id: string | null
          csi_division: string | null
          description: string
          id: string
          is_fallback: boolean
          labor_high: number | null
          labor_low: number | null
          line_high: number
          line_low: number
          material_high: number | null
          material_low: number | null
          price_source: string
          qty: number
          scope_id: string
          trade: string | null
          uom: string
        }
        Insert: {
          change_item_id?: string | null
          csi_division?: string | null
          description: string
          id?: string
          is_fallback?: boolean
          labor_high?: number | null
          labor_low?: number | null
          line_high: number
          line_low: number
          material_high?: number | null
          material_low?: number | null
          price_source: string
          qty: number
          scope_id: string
          trade?: string | null
          uom: string
        }
        Update: {
          change_item_id?: string | null
          csi_division?: string | null
          description?: string
          id?: string
          is_fallback?: boolean
          labor_high?: number | null
          labor_low?: number | null
          line_high?: number
          line_low?: number
          material_high?: number | null
          material_low?: number | null
          price_source?: string
          qty?: number
          scope_id?: string
          trade?: string | null
          uom?: string
        }
        Relationships: [
          {
            foreignKeyName: "scope_lines_change_item_id_fkey"
            columns: ["change_item_id"]
            isOneToOne: false
            referencedRelation: "change_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scope_lines_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scopes"
            referencedColumns: ["id"]
          },
        ]
      }
      scopes: {
        Row: {
          budget_fit: string | null
          computed_at: string
          contingency_pct: number
          id: string
          layout_conf: string
          market_id: string
          matched_pct: number | null
          pricing_conf: string
          total_high: number
          total_low: number
          version_id: string
        }
        Insert: {
          budget_fit?: string | null
          computed_at?: string
          contingency_pct?: number
          id?: string
          layout_conf: string
          market_id: string
          matched_pct?: number | null
          pricing_conf: string
          total_high: number
          total_low: number
          version_id: string
        }
        Update: {
          budget_fit?: string | null
          computed_at?: string
          contingency_pct?: number
          id?: string
          layout_conf?: string
          market_id?: string
          matched_pct?: number | null
          pricing_conf?: string
          total_high?: number
          total_low?: number
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "scopes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scopes_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "versions"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          created_at: string
          last_refill_on: string | null
          next_refill_on: string | null
          period_end: string | null
          period_start: string | null
          plan: Database["public"]["Enums"]["plan_tier"]
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          created_at?: string
          last_refill_on?: string | null
          next_refill_on?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          source?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          created_at?: string
          last_refill_on?: string | null
          next_refill_on?: string | null
          period_end?: string | null
          period_start?: string | null
          plan?: Database["public"]["Enums"]["plan_tier"]
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_invites: {
        Row: {
          accepted_at: string | null
          accepted_user_id: string | null
          created_at: string
          email: string
          id: string
          owner_id: string
          role: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email: string
          id?: string
          owner_id: string
          role?: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_user_id?: string | null
          created_at?: string
          email?: string
          id?: string
          owner_id?: string
          role?: string
          status?: string
        }
        Relationships: []
      }
      unit_costs: {
        Row: {
          csi_division: string
          description: string
          effective_on: string
          grade: string
          id: string
          item_code: string
          labor_high: number | null
          labor_low: number | null
          material_high: number | null
          material_low: number | null
          n_samples: number | null
          source: string
          source_ref: string | null
          uom: string
        }
        Insert: {
          csi_division: string
          description: string
          effective_on?: string
          grade?: string
          id?: string
          item_code: string
          labor_high?: number | null
          labor_low?: number | null
          material_high?: number | null
          material_low?: number | null
          n_samples?: number | null
          source: string
          source_ref?: string | null
          uom: string
        }
        Update: {
          csi_division?: string
          description?: string
          effective_on?: string
          grade?: string
          id?: string
          item_code?: string
          labor_high?: number | null
          labor_low?: number | null
          material_high?: number | null
          material_low?: number | null
          n_samples?: number | null
          source?: string
          source_ref?: string | null
          uom?: string
        }
        Relationships: []
      }
      versions: {
        Row: {
          after_path: string | null
          before_path: string
          created_at: string
          created_by: string | null
          gen_model: string | null
          gen_params: Json | null
          id: string
          room_id: string
          status: string
          style: string | null
          version_no: number
        }
        Insert: {
          after_path?: string | null
          before_path: string
          created_at?: string
          created_by?: string | null
          gen_model?: string | null
          gen_params?: Json | null
          id?: string
          room_id: string
          status?: string
          style?: string | null
          version_no: number
        }
        Update: {
          after_path?: string | null
          before_path?: string
          created_at?: string
          created_by?: string | null
          gen_model?: string | null
          gen_params?: Json | null
          id?: string
          room_id?: string
          status?: string
          style?: string | null
          version_no?: number
        }
        Relationships: [
          {
            foreignKeyName: "versions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_plan_request: {
        Args: {
          _plan: Database["public"]["Enums"]["plan_tier"]
          _user_id: string
        }
        Returns: Json
      }
      cancel_plan_request: { Args: never; Returns: Json }
      credit_cost: {
        Args: { _action: Database["public"]["Enums"]["credit_action"] }
        Returns: number
      }
      ensure_credit_account: {
        Args: { _user_id: string }
        Returns: {
          balance: number
          created_at: string
          free_day: string
          free_used_today: number
          plan: Database["public"]["Enums"]["plan_tier"]
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "credit_accounts"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      founding_members_claimed: { Args: never; Returns: number }
      get_shared_presentation: { Args: { _token: string }; Returns: Json }
      grant_credits: {
        Args: {
          _action?: Database["public"]["Enums"]["credit_action"]
          _amount: number
          _note?: string
          _user_id: string
        }
        Returns: Json
      }
      has_workspace_access: { Args: { _owner: string }; Returns: boolean }
      plan_monthly_credits: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"] }
        Returns: number
      }
      plan_rank: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"] }
        Returns: number
      }
      record_presentation_reminder: {
        Args: { _id: string }
        Returns: undefined
      }
      record_presentation_view: { Args: { _token: string }; Returns: undefined }
      request_plan_change: {
        Args: { _plan: Database["public"]["Enums"]["plan_tier"] }
        Returns: Json
      }
      respond_to_presentation: {
        Args: {
          _decision: string
          _excluded?: Json
          _line_notes?: Json
          _note?: string
          _token: string
        }
        Returns: Json
      }
      set_subscription_cancel: { Args: { _cancel: boolean }; Returns: Json }
      spend_credits: {
        Args: {
          _action: Database["public"]["Enums"]["credit_action"]
          _note?: string
          _user_id: string
        }
        Returns: Json
      }
      sync_subscription: { Args: never; Returns: Json }
    }
    Enums: {
      credit_action:
        | "design"
        | "scope"
        | "plan_3d"
        | "video"
        | "topup"
        | "grant"
        | "refund"
      plan_tier: "free" | "starter" | "pro" | "studio"
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
      credit_action: [
        "design",
        "scope",
        "plan_3d",
        "video",
        "topup",
        "grant",
        "refund",
      ],
      plan_tier: ["free", "starter", "pro", "studio"],
    },
  },
} as const
