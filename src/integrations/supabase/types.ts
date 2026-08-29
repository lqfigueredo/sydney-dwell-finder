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
      applications: {
        Row: {
          applicant_id: string
          created_at: string
          id: string
          listing_id: string | null
          message: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          wanted_ad_id: string
        }
        Insert: {
          applicant_id: string
          created_at?: string
          id?: string
          listing_id?: string | null
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          wanted_ad_id: string
        }
        Update: {
          applicant_id?: string
          created_at?: string
          id?: string
          listing_id?: string | null
          message?: string
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          wanted_ad_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "applications_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "applications_wanted_ad_id_fkey"
            columns: ["wanted_ad_id"]
            isOneToOne: false
            referencedRelation: "wanted_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: string
          listing_id: string | null
          wanted_ad_id: string | null
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: string
          listing_id?: string | null
          wanted_ad_id?: string | null
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: string
          listing_id?: string | null
          wanted_ad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "comments_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_wanted_ad_id_fkey"
            columns: ["wanted_ad_id"]
            isOneToOne: false
            referencedRelation: "wanted_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          sort_order: number
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          sort_order?: number
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          sort_order?: number
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          address: string
          area_sqm: number | null
          bathrooms: number
          bedrooms: number
          cover_url: string | null
          created_at: string
          deal: Database["public"]["Enums"]["deal_kind"]
          description: string
          features: string[]
          id: string
          lat: number | null
          lng: number | null
          owner_id: string | null
          parking: number
          postcode: string | null
          price_cents: number
          published: boolean
          suburb: string
          title: string
          updated_at: string
        }
        Insert: {
          address: string
          area_sqm?: number | null
          bathrooms?: number
          bedrooms?: number
          cover_url?: string | null
          created_at?: string
          deal?: Database["public"]["Enums"]["deal_kind"]
          description?: string
          features?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          owner_id?: string | null
          parking?: number
          postcode?: string | null
          price_cents?: number
          published?: boolean
          suburb: string
          title: string
          updated_at?: string
        }
        Update: {
          address?: string
          area_sqm?: number | null
          bathrooms?: number
          bedrooms?: number
          cover_url?: string | null
          created_at?: string
          deal?: Database["public"]["Enums"]["deal_kind"]
          description?: string
          features?: string[]
          id?: string
          lat?: number | null
          lng?: number | null
          owner_id?: string | null
          parking?: number
          postcode?: string | null
          price_cents?: number
          published?: boolean
          suburb?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          suburb: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id: string
          phone?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          suburb?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      saved_items: {
        Row: {
          created_at: string
          id: string
          listing_id: string | null
          user_id: string
          wanted_ad_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id?: string | null
          user_id: string
          wanted_ad_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string | null
          user_id?: string
          wanted_ad_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "saved_items_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "saved_items_wanted_ad_id_fkey"
            columns: ["wanted_ad_id"]
            isOneToOne: false
            referencedRelation: "wanted_ads"
            referencedColumns: ["id"]
          },
        ]
      }
      wanted_ads: {
        Row: {
          bedrooms_min: number
          budget_cents: number
          created_at: string
          deal: Database["public"]["Enums"]["deal_kind"]
          id: string
          lat: number | null
          lng: number | null
          move_in_date: string | null
          must_haves: string[]
          notes: string
          open: boolean
          seeker_id: string | null
          suburbs: string[]
          title: string
          updated_at: string
        }
        Insert: {
          bedrooms_min?: number
          budget_cents?: number
          created_at?: string
          deal?: Database["public"]["Enums"]["deal_kind"]
          id?: string
          lat?: number | null
          lng?: number | null
          move_in_date?: string | null
          must_haves?: string[]
          notes?: string
          open?: boolean
          seeker_id?: string | null
          suburbs?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          bedrooms_min?: number
          budget_cents?: number
          created_at?: string
          deal?: Database["public"]["Enums"]["deal_kind"]
          id?: string
          lat?: number | null
          lng?: number | null
          move_in_date?: string | null
          must_haves?: string[]
          notes?: string
          open?: boolean
          seeker_id?: string | null
          suburbs?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      application_status: "pending" | "accepted" | "declined"
      deal_kind: "rent" | "buy"
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
      application_status: ["pending", "accepted", "declined"],
      deal_kind: ["rent", "buy"],
    },
  },
} as const
