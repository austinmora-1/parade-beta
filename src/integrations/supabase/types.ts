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
          grant_id: string | null
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
          grant_id?: string | null
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
          grant_id?: string | null
          id?: string
          key_id?: string | null
          provider?: string
          refresh_token?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_participants: {
        Row: {
          conversation_id: string
          id: string
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          created_by: string
          id: string
          title: string | null
          type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          title?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          title?: string | null
          type?: string
          updated_at?: string
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
      hang_request_emails: {
        Row: {
          created_at: string
          hang_request_id: string
          id: string
          requester_email: string | null
        }
        Insert: {
          created_at?: string
          hang_request_id: string
          id?: string
          requester_email?: string | null
        }
        Update: {
          created_at?: string
          hang_request_id?: string
          id?: string
          requester_email?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "hang_request_emails_hang_request_id_fkey"
            columns: ["hang_request_id"]
            isOneToOne: true
            referencedRelation: "hang_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      hang_requests: {
        Row: {
          created_at: string
          id: string
          message: string | null
          requester_name: string
          selected_day: string
          selected_slot: string
          sender_id: string | null
          share_code: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          requester_name: string
          selected_day: string
          selected_slot: string
          sender_id?: string | null
          share_code: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          requester_name?: string
          selected_day?: string
          selected_slot?: string
          sender_id?: string | null
          share_code?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_change_requests: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          proposed_by: string
          proposed_date: string | null
          proposed_duration: number | null
          proposed_time_slot: string | null
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          proposed_by: string
          proposed_date?: string | null
          proposed_duration?: number | null
          proposed_time_slot?: string | null
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          proposed_by?: string
          proposed_date?: string | null
          proposed_duration?: number | null
          proposed_time_slot?: string | null
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_change_responses: {
        Row: {
          change_request_id: string
          created_at: string
          id: string
          participant_id: string
          responded_at: string | null
          response: string
        }
        Insert: {
          change_request_id: string
          created_at?: string
          id?: string
          participant_id: string
          responded_at?: string | null
          response?: string
        }
        Update: {
          change_request_id?: string
          created_at?: string
          id?: string
          participant_id?: string
          responded_at?: string | null
          response?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_change_responses_change_request_id_fkey"
            columns: ["change_request_id"]
            isOneToOne: false
            referencedRelation: "plan_change_requests"
            referencedColumns: ["id"]
          },
        ]
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
          source: string | null
          source_event_id: string | null
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
          source?: string | null
          source_event_id?: string | null
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
          source?: string | null
          source_event_id?: string | null
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
          default_availability_status: string | null
          default_vibes: string[] | null
          default_work_days: string[] | null
          default_work_end_hour: number | null
          default_work_start_hour: number | null
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
          default_availability_status?: string | null
          default_vibes?: string[] | null
          default_work_days?: string[] | null
          default_work_end_hour?: number | null
          default_work_start_hour?: number | null
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
          default_availability_status?: string | null
          default_vibes?: string[] | null
          default_work_days?: string[] | null
          default_work_end_hour?: number | null
          default_work_start_hour?: number | null
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
      friendships_incoming: {
        Row: {
          created_at: string | null
          friend_name: string | null
          friend_user_id: string | null
          id: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          friend_name?: string | null
          friend_user_id?: string | null
          id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          friend_name?: string | null
          friend_user_id?: string | null
          id?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
          grant_id: string
          refresh_token: string
        }[]
      }
      owns_share_code: { Args: { p_share_code: string }; Returns: boolean }
      search_users_by_email_prefix: {
        Args: { p_query: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          user_id: string
        }[]
      }
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
          p_grant_id?: string
          p_provider: string
          p_refresh_token: string
          p_user_id: string
        }
        Returns: undefined
      }
      user_conversation_ids: { Args: { p_user_id: string }; Returns: string[] }
      user_participated_plan_ids: {
        Args: { p_user_id: string }
        Returns: string[]
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
