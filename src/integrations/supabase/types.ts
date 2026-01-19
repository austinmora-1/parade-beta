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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          created_at: string
          date: string
          early_afternoon: boolean | null
          early_morning: boolean | null
          evening: boolean | null
          id: string
          late_afternoon: boolean | null
          late_morning: boolean | null
          late_night: boolean | null
          location_status: string | null
          trip_location: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          date: string
          early_afternoon?: boolean | null
          early_morning?: boolean | null
          evening?: boolean | null
          id?: string
          late_afternoon?: boolean | null
          late_morning?: boolean | null
          late_night?: boolean | null
          location_status?: string | null
          trip_location?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          date?: string
          early_afternoon?: boolean | null
          early_morning?: boolean | null
          evening?: boolean | null
          id?: string
          late_afternoon?: boolean | null
          late_morning?: boolean | null
          late_night?: boolean | null
          location_status?: string | null
          trip_location?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_connections: {
        Row: {
          access_token: string | null
          created_at: string
          expires_at: string
          id: string
          key_id: string | null
          provider: string
          refresh_token: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token?: string | null
          created_at?: string
          expires_at: string
          id?: string
          key_id?: string | null
          provider: string
          refresh_token?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          key_id?: string | null
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_email: string | null
          friend_name: string
          friend_user_id: string | null
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_email?: string | null
          friend_name: string
          friend_user_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_email?: string | null
          friend_name?: string
          friend_user_id?: string | null
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      hang_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          requester_email: string | null
          requester_name: string
          selected_day: string
          selected_slot: string
          share_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          requester_email?: string | null
          requester_name: string
          selected_day: string
          selected_slot: string
          share_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          requester_email?: string | null
          requester_name?: string
          selected_day?: string
          selected_slot?: string
          share_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_participants: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          plan_id: string
          status: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          plan_id: string
          status?: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          plan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_participants_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          activity: string
          created_at: string
          date: string
          duration: number
          id: string
          location: string | null
          notes: string | null
          time_slot: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          activity: string
          created_at?: string
          date: string
          duration?: number
          id?: string
          location?: string | null
          notes?: string | null
          time_slot: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          activity?: string
          created_at?: string
          date?: string
          duration?: number
          id?: string
          location?: string | null
          notes?: string | null
          time_slot?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          allow_all_hang_requests: boolean | null
          allowed_hang_request_friend_ids: string[] | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          current_vibe: string | null
          custom_activities: Json | null
          custom_vibe_tags: string[] | null
          discoverable: boolean | null
          display_name: string | null
          friend_requests_notifications: boolean | null
          home_address: string | null
          id: string
          location_status: string | null
          plan_invitations_notifications: boolean | null
          plan_reminders: boolean | null
          share_code: string
          show_availability: boolean | null
          show_location: boolean | null
          show_vibe_status: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_all_hang_requests?: boolean | null
          allowed_hang_request_friend_ids?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_vibe?: string | null
          custom_activities?: Json | null
          custom_vibe_tags?: string[] | null
          discoverable?: boolean | null
          display_name?: string | null
          friend_requests_notifications?: boolean | null
          home_address?: string | null
          id?: string
          location_status?: string | null
          plan_invitations_notifications?: boolean | null
          plan_reminders?: boolean | null
          share_code?: string
          show_availability?: boolean | null
          show_location?: boolean | null
          show_vibe_status?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_all_hang_requests?: boolean | null
          allowed_hang_request_friend_ids?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          current_vibe?: string | null
          custom_activities?: Json | null
          custom_vibe_tags?: string[] | null
          discoverable?: boolean | null
          display_name?: string | null
          friend_requests_notifications?: boolean | null
          home_address?: string | null
          id?: string
          location_status?: string | null
          plan_invitations_notifications?: boolean | null
          plan_reminders?: boolean | null
          share_code?: string
          show_availability?: boolean | null
          show_location?: boolean | null
          show_vibe_status?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          discoverable: boolean | null
          display_name: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          discoverable?: boolean | null
          display_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          discoverable?: boolean | null
          display_name?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      decrypt_calendar_token: {
        Args: { encrypted_token: string; p_key_id: string }
        Returns: string
      }
      encrypt_calendar_token: {
        Args: { p_key_id: string; token: string }
        Returns: string
      }
      generate_share_code: { Args: { length?: number }; Returns: string }
      get_calendar_tokens: {
        Args: { p_provider: string; p_user_id: string }
        Returns: {
          access_token: string
          expires_at: string
          refresh_token: string
        }[]
      }
      owns_share_code: { Args: { p_share_code: string }; Returns: boolean }
      update_calendar_access_token: {
        Args: {
          p_access_token: string
          p_expires_at: string
          p_provider: string
          p_user_id: string
        }
        Returns: undefined
      }
      upsert_calendar_connection: {
        Args: {
          p_access_token: string
          p_expires_at: string
          p_provider: string
          p_refresh_token: string
          p_user_id: string
        }
        Returns: undefined
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
    Enums: {},
  },
} as const
