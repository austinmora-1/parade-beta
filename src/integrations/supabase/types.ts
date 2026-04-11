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
          vibe: string | null
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
          vibe?: string | null
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
          vibe?: string | null
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
          edited_at: string | null
          id: string
          image_url: string | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          image_url?: string | null
          reply_to_id?: string | null
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
          {
            foreignKeyName: "chat_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
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
      feedback: {
        Row: {
          created_at: string
          feedback_type: string
          id: string
          message: string
          synced_to_sheets: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback_type: string
          id?: string
          message: string
          synced_to_sheets?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          feedback_type?: string
          id?: string
          message?: string
          synced_to_sheets?: boolean
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
          is_pod_member: boolean
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
          is_pod_member?: boolean
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
          is_pod_member?: boolean
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
      live_locations: {
        Row: {
          accuracy: number | null
          created_at: string
          expires_at: string
          id: string
          label: string | null
          latitude: number
          longitude: number
          shared_with: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          latitude: number
          longitude: number
          shared_with?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy?: number | null
          created_at?: string
          expires_at?: string
          id?: string
          label?: string | null
          latitude?: number
          longitude?: number
          shared_with?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "chat_messages"
            referencedColumns: ["id"]
          },
        ]
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
      plan_comments: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          plan_id: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          plan_id: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_comments_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_invites: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string | null
          id: string
          invite_token: string
          invited_by: string
          plan_id: string
          status: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invite_token?: string
          invited_by: string
          plan_id: string
          status?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string | null
          id?: string
          invite_token?: string
          invited_by?: string
          plan_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_invites_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_participant_requests: {
        Row: {
          created_at: string
          friend_name: string
          friend_user_id: string
          id: string
          plan_id: string
          requested_by: string
          resolved_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          friend_name: string
          friend_user_id: string
          id?: string
          plan_id: string
          requested_by: string
          resolved_at?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          friend_name?: string
          friend_user_id?: string
          id?: string
          plan_id?: string
          requested_by?: string
          resolved_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_participant_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
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
          responded_at: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          plan_id: string
          responded_at?: string | null
          role?: string
          status?: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          plan_id?: string
          responded_at?: string | null
          role?: string
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
      plan_photos: {
        Row: {
          caption: string | null
          created_at: string
          file_path: string
          id: string
          plan_id: string
          uploaded_by: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_path: string
          id?: string
          plan_id: string
          uploaded_by: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_path?: string
          id?: string
          plan_id?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_photos_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_reminders_sent: {
        Row: {
          created_at: string
          id: string
          plan_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_reminders_sent_plan_id_fkey"
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
          end_date: string | null
          end_time: string | null
          feed_visibility: string
          id: string
          location: string | null
          notes: string | null
          proposed_by: string | null
          recurring_plan_id: string | null
          source: string | null
          source_event_id: string | null
          source_timezone: string | null
          start_time: string | null
          status: string
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
          end_date?: string | null
          end_time?: string | null
          feed_visibility?: string
          id?: string
          location?: string | null
          notes?: string | null
          proposed_by?: string | null
          recurring_plan_id?: string | null
          source?: string | null
          source_event_id?: string | null
          source_timezone?: string | null
          start_time?: string | null
          status?: string
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
          end_date?: string | null
          end_time?: string | null
          feed_visibility?: string
          id?: string
          location?: string | null
          notes?: string | null
          proposed_by?: string | null
          recurring_plan_id?: string | null
          source?: string | null
          source_event_id?: string | null
          source_timezone?: string | null
          start_time?: string | null
          status?: string
          time_slot?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plans_recurring_plan_id_fkey"
            columns: ["recurring_plan_id"]
            isOneToOne: false
            referencedRelation: "recurring_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      pod_members: {
        Row: {
          created_at: string
          friend_user_id: string
          id: string
          pod_id: string
        }
        Insert: {
          created_at?: string
          friend_user_id: string
          id?: string
          pod_id: string
        }
        Update: {
          created_at?: string
          friend_user_id?: string
          id?: string
          pod_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pod_members_pod_id_fkey"
            columns: ["pod_id"]
            isOneToOne: false
            referencedRelation: "pods"
            referencedColumns: ["id"]
          },
        ]
      }
      pods: {
        Row: {
          conversation_id: string | null
          created_at: string
          emoji: string | null
          id: string
          name: string
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          emoji?: string | null
          id?: string
          name?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pods_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_all_hang_requests: boolean | null
          allow_elly_hangouts: boolean | null
          allowed_hang_request_friend_ids: string[] | null
          avatar_url: string | null
          bio: string | null
          cover_photo_url: string | null
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
          first_name: string | null
          friend_requests_notifications: boolean | null
          home_address: string | null
          id: string
          interests: string[] | null
          last_name: string | null
          location_status: string | null
          neighborhood: string | null
          onboarding_completed: boolean
          phone_number: string | null
          plan_invitations_notifications: boolean | null
          plan_reminders: boolean | null
          preferred_social_days: string[] | null
          preferred_social_times: string[] | null
          share_code: string
          show_availability: boolean | null
          show_location: boolean | null
          show_vibe_status: boolean | null
          social_cap: number | null
          social_goals: string[] | null
          timezone: string | null
          updated_at: string
          user_id: string
          vibe_gif_url: string | null
          walkthrough_completed: boolean
        }
        Insert: {
          allow_all_hang_requests?: boolean | null
          allow_elly_hangouts?: boolean | null
          allowed_hang_request_friend_ids?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          cover_photo_url?: string | null
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
          first_name?: string | null
          friend_requests_notifications?: boolean | null
          home_address?: string | null
          id?: string
          interests?: string[] | null
          last_name?: string | null
          location_status?: string | null
          neighborhood?: string | null
          onboarding_completed?: boolean
          phone_number?: string | null
          plan_invitations_notifications?: boolean | null
          plan_reminders?: boolean | null
          preferred_social_days?: string[] | null
          preferred_social_times?: string[] | null
          share_code?: string
          show_availability?: boolean | null
          show_location?: boolean | null
          show_vibe_status?: boolean | null
          social_cap?: number | null
          social_goals?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          vibe_gif_url?: string | null
          walkthrough_completed?: boolean
        }
        Update: {
          allow_all_hang_requests?: boolean | null
          allow_elly_hangouts?: boolean | null
          allowed_hang_request_friend_ids?: string[] | null
          avatar_url?: string | null
          bio?: string | null
          cover_photo_url?: string | null
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
          first_name?: string | null
          friend_requests_notifications?: boolean | null
          home_address?: string | null
          id?: string
          interests?: string[] | null
          last_name?: string | null
          location_status?: string | null
          neighborhood?: string | null
          onboarding_completed?: boolean
          phone_number?: string | null
          plan_invitations_notifications?: boolean | null
          plan_reminders?: boolean | null
          preferred_social_days?: string[] | null
          preferred_social_times?: string[] | null
          share_code?: string
          show_availability?: boolean | null
          show_location?: boolean | null
          show_vibe_status?: boolean | null
          social_cap?: number | null
          social_goals?: string[] | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          vibe_gif_url?: string | null
          walkthrough_completed?: boolean
        }
        Relationships: []
      }
      push_config: {
        Row: {
          created_at: string
          id: string
          vapid_private_key: string
          vapid_public_key: string
        }
        Insert: {
          created_at?: string
          id?: string
          vapid_private_key: string
          vapid_public_key: string
        }
        Update: {
          created_at?: string
          id?: string
          vapid_private_key?: string
          vapid_public_key?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_plans: {
        Row: {
          activity: string
          created_at: string
          day_of_week: number | null
          duration: number
          end_time: string | null
          ends_on: string | null
          feed_visibility: string
          frequency: string
          id: string
          is_active: boolean
          last_generated_date: string | null
          location: string | null
          max_occurrences: number | null
          notes: string | null
          source_timezone: string | null
          start_time: string | null
          starts_on: string
          status: string
          time_slot: string
          title: string
          updated_at: string
          user_id: string
          week_of_month: number | null
        }
        Insert: {
          activity: string
          created_at?: string
          day_of_week?: number | null
          duration?: number
          end_time?: string | null
          ends_on?: string | null
          feed_visibility?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          location?: string | null
          max_occurrences?: number | null
          notes?: string | null
          source_timezone?: string | null
          start_time?: string | null
          starts_on?: string
          status?: string
          time_slot: string
          title: string
          updated_at?: string
          user_id: string
          week_of_month?: number | null
        }
        Update: {
          activity?: string
          created_at?: string
          day_of_week?: number | null
          duration?: number
          end_time?: string | null
          ends_on?: string | null
          feed_visibility?: string
          frequency?: string
          id?: string
          is_active?: boolean
          last_generated_date?: string | null
          location?: string | null
          max_occurrences?: number | null
          notes?: string | null
          source_timezone?: string | null
          start_time?: string | null
          starts_on?: string
          status?: string
          time_slot?: string
          title?: string
          updated_at?: string
          user_id?: string
          week_of_month?: number | null
        }
        Relationships: []
      }
      smart_nudges: {
        Row: {
          acted_on_at: string | null
          created_at: string
          dismissed_at: string | null
          expires_at: string | null
          friend_user_id: string | null
          id: string
          message: string
          metadata: Json | null
          nudge_type: string
          title: string
          user_id: string
        }
        Insert: {
          acted_on_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          friend_user_id?: string | null
          id?: string
          message: string
          metadata?: Json | null
          nudge_type: string
          title: string
          user_id: string
        }
        Update: {
          acted_on_at?: string | null
          created_at?: string
          dismissed_at?: string | null
          expires_at?: string | null
          friend_user_id?: string | null
          id?: string
          message?: string
          metadata?: Json | null
          nudge_type?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      trips: {
        Row: {
          available_slots: string[]
          created_at: string
          end_date: string
          id: string
          location: string | null
          priority_friend_ids: string[]
          start_date: string
          updated_at: string
          user_id: string
        }
        Insert: {
          available_slots?: string[]
          created_at?: string
          end_date: string
          id?: string
          location?: string | null
          priority_friend_ids?: string[]
          start_date: string
          updated_at?: string
          user_id: string
        }
        Update: {
          available_slots?: string[]
          created_at?: string
          end_date?: string
          id?: string
          location?: string | null
          priority_friend_ids?: string[]
          start_date?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vibe_comments: {
        Row: {
          content: string | null
          created_at: string
          id: string
          media_type: string | null
          media_url: string | null
          user_id: string
          vibe_send_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id: string
          vibe_send_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          media_type?: string | null
          media_url?: string | null
          user_id?: string
          vibe_send_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_comments_vibe_send_id_fkey"
            columns: ["vibe_send_id"]
            isOneToOne: false
            referencedRelation: "vibe_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_reactions: {
        Row: {
          created_at: string
          emoji: string
          id: string
          user_id: string
          vibe_send_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          id?: string
          user_id: string
          vibe_send_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          id?: string
          user_id?: string
          vibe_send_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_reactions_vibe_send_id_fkey"
            columns: ["vibe_send_id"]
            isOneToOne: false
            referencedRelation: "vibe_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_send_recipients: {
        Row: {
          created_at: string
          dismissed_at: string | null
          id: string
          read_at: string | null
          recipient_id: string
          vibe_send_id: string
        }
        Insert: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id: string
          vibe_send_id: string
        }
        Update: {
          created_at?: string
          dismissed_at?: string | null
          id?: string
          read_at?: string | null
          recipient_id?: string
          vibe_send_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vibe_send_recipients_vibe_send_id_fkey"
            columns: ["vibe_send_id"]
            isOneToOne: false
            referencedRelation: "vibe_sends"
            referencedColumns: ["id"]
          },
        ]
      }
      vibe_sends: {
        Row: {
          created_at: string
          custom_tags: string[] | null
          id: string
          location_lat: number | null
          location_lng: number | null
          location_name: string | null
          media_type: string | null
          media_url: string | null
          message: string | null
          sender_id: string
          target_type: string
          vibe_type: string
        }
        Insert: {
          created_at?: string
          custom_tags?: string[] | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          media_type?: string | null
          media_url?: string | null
          message?: string | null
          sender_id: string
          target_type?: string
          vibe_type: string
        }
        Update: {
          created_at?: string
          custom_tags?: string[] | null
          id?: string
          location_lat?: number | null
          location_lng?: number | null
          location_name?: string | null
          media_type?: string | null
          media_url?: string | null
          message?: string | null
          sender_id?: string
          target_type?: string
          vibe_type?: string
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
      accept_friend_request: {
        Args: { p_friendship_id: string; p_requester_user_id: string }
        Returns: undefined
      }
      accept_plan_invite: { Args: { p_token: string }; Returns: string }
      approve_participant_request: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      check_username_available: {
        Args: { p_username: string }
        Returns: boolean
      }
      check_vibe_recipient: {
        Args: { p_vibe_send_id: string }
        Returns: boolean
      }
      check_vibe_sender: { Args: { p_vibe_send_id: string }; Returns: boolean }
      decrypt_calendar_token: {
        Args: { encrypted_token: string; p_key_id: string }
        Returns: string
      }
      encrypt_calendar_token: {
        Args: { p_key_id: string; token: string }
        Returns: string
      }
      generate_share_code: { Args: { length?: number }; Returns: string }
      get_availability_by_share_code: {
        Args: { p_end_date: string; p_share_code: string; p_start_date: string }
        Returns: {
          date: string
          early_afternoon: boolean
          early_morning: boolean
          evening: boolean
          late_afternoon: boolean
          late_morning: boolean
          late_night: boolean
          location_status: string
          trip_location: string
        }[]
      }
      get_calendar_tokens: {
        Args: { p_provider: string; p_user_id: string }
        Returns: {
          access_token: string
          expires_at: string
          grant_id: string
          refresh_token: string
        }[]
      }
      get_dashboard_data: { Args: { p_user_id: string }; Returns: Json }
      get_display_names_for_users: {
        Args: { p_user_ids: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          user_id: string
        }[]
      }
      get_plan_invite_details: {
        Args: { p_token: string }
        Returns: {
          invite_email: string
          invite_id: string
          invite_status: string
          invited_by_avatar: string
          invited_by_name: string
          plan_activity: string
          plan_date: string
          plan_duration: number
          plan_end_time: string
          plan_id: string
          plan_location: string
          plan_notes: string
          plan_start_time: string
          plan_time_slot: string
          plan_title: string
        }[]
      }
      get_plans_by_share_code: {
        Args: { p_end_date: string; p_share_code: string; p_start_date: string }
        Returns: {
          activity: string
          date: string
          duration: number
          id: string
          location: string
          time_slot: string
          title: string
        }[]
      }
      get_profile_by_share_code: {
        Args: { p_share_code: string }
        Returns: {
          allow_all_hang_requests: boolean
          allowed_hang_request_friend_ids: string[]
          avatar_url: string
          current_vibe: string
          custom_vibe_tags: string[]
          default_availability_status: string
          default_work_days: string[]
          default_work_end_hour: number
          default_work_start_hour: number
          display_name: string
          location_status: string
          show_availability: boolean
          show_location: boolean
          show_vibe_status: boolean
          user_id: string
        }[]
      }
      get_vibe_recipient_names: {
        Args: { p_vibe_send_id: string }
        Returns: {
          display_name: string
          user_id: string
        }[]
      }
      owns_share_code: { Args: { p_share_code: string }; Returns: boolean }
      remove_friendship: {
        Args: { p_friendship_id: string }
        Returns: undefined
      }
      search_users_by_email_prefix: {
        Args: { p_query: string }
        Returns: {
          avatar_url: string
          bio: string
          display_name: string
          user_id: string
        }[]
      }
      search_users_by_phone_prefix: {
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
