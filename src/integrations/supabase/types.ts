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
      app_users: {
        Row: {
          available: boolean
          created_at: string
          name: string
          phone: string
          profile: Json
          role: string
          truck_tons: string | null
          truck_type: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          available?: boolean
          created_at?: string
          name?: string
          phone: string
          profile?: Json
          role?: string
          truck_tons?: string | null
          truck_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          available?: boolean
          created_at?: string
          name?: string
          phone?: string
          profile?: Json
          role?: string
          truck_tons?: string | null
          truck_type?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      bids: {
        Row: {
          created_at: string
          driver: string
          driver_id: string
          driver_phone: string | null
          eta_min: number
          id: string
          kind: string
          load_id: string
          plate: string
          price: number
          rating: number
          shipper_reply: Json | null
          status: string
          trips: number
          truck: string
          updated_at: string
          user_id: string | null
          voice_note: Json | null
        }
        Insert: {
          created_at?: string
          driver?: string
          driver_id: string
          driver_phone?: string | null
          eta_min?: number
          id: string
          kind?: string
          load_id: string
          plate?: string
          price?: number
          rating?: number
          shipper_reply?: Json | null
          status?: string
          trips?: number
          truck?: string
          updated_at?: string
          user_id?: string | null
          voice_note?: Json | null
        }
        Update: {
          created_at?: string
          driver?: string
          driver_id?: string
          driver_phone?: string | null
          eta_min?: number
          id?: string
          kind?: string
          load_id?: string
          plate?: string
          price?: number
          rating?: number
          shipper_reply?: Json | null
          status?: string
          trips?: number
          truck?: string
          updated_at?: string
          user_id?: string | null
          voice_note?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "bids_load_id_fkey"
            columns: ["load_id"]
            isOneToOne: false
            referencedRelation: "loads"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          driver_phone: string
          id: string
          load_id: string
          sender_name: string
          sender_phone: string
          sender_role: string
          shipper_phone: string
          user_id: string | null
          voice: Json | null
        }
        Insert: {
          body?: string
          created_at?: string
          driver_phone?: string
          id?: string
          load_id: string
          sender_name?: string
          sender_phone: string
          sender_role?: string
          shipper_phone?: string
          user_id?: string | null
          voice?: Json | null
        }
        Update: {
          body?: string
          created_at?: string
          driver_phone?: string
          id?: string
          load_id?: string
          sender_name?: string
          sender_phone?: string
          sender_role?: string
          shipper_phone?: string
          user_id?: string | null
          voice?: Json | null
        }
        Relationships: []
      }
      drafts: {
        Row: {
          data: Json
          phone: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          data?: Json
          phone: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          data?: Json
          phone?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      loads: {
        Row: {
          accepted_offer: Json | null
          capacity: string | null
          cargo: string
          created_at: string
          destination: string
          destination_point: Json
          id: string
          pickup: string
          pickup_point: Json
          price: number
          shipper: string
          shipper_phone: string | null
          status: string
          trip_status: string
          truck: string
          updated_at: string
          user_id: string | null
          voice_note: Json | null
        }
        Insert: {
          accepted_offer?: Json | null
          capacity?: string | null
          cargo?: string
          created_at?: string
          destination?: string
          destination_point?: Json
          id: string
          pickup?: string
          pickup_point?: Json
          price?: number
          shipper?: string
          shipper_phone?: string | null
          status?: string
          trip_status?: string
          truck?: string
          updated_at?: string
          user_id?: string | null
          voice_note?: Json | null
        }
        Update: {
          accepted_offer?: Json | null
          capacity?: string | null
          cargo?: string
          created_at?: string
          destination?: string
          destination_point?: Json
          id?: string
          pickup?: string
          pickup_point?: Json
          price?: number
          shipper?: string
          shipper_phone?: string | null
          status?: string
          trip_status?: string
          truck?: string
          updated_at?: string
          user_id?: string | null
          voice_note?: Json | null
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
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_access_chat_load: { Args: { _load_id: string }; Returns: boolean }
      has_bid_on_load: { Args: { _load_id: string }; Returns: boolean }
      owns_load: { Args: { _load_id: string }; Returns: boolean }
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
