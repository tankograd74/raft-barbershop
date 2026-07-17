export type GalleryFilter = "all" | "work" | "interior" | "entrance" | "exterior" | "products";

export interface GalleryItem {
  id: number;
  url: string;
  source_url?: string;
  category: Exclude<GalleryFilter, "all">;
  alt: string;
  caption: string;
  tall?: boolean;
  tags?: string[];
}

export interface Review {
  id: string;
  name: string;
  rating: number;
  text: string;
  aspect: string;
  response?: string | null;
  updated_at?: string;
  avatar?: string;
}

export interface SiteData {
  org_id: string;
  title: string;
  category: string;
  yandex_maps_url: string;
  synced_at?: string;
  phone: {
    display: string;
    tel: string;
  };
  address: {
    short: string;
    street_line: string;
    city_line: string;
    full: string;
    locality: string;
  };
  coordinates: {
    lat: number;
    lon: number;
  };
  rating: {
    value: number;
    rating_count: number;
    review_count: number;
  };
  working_hours: {
    text: string;
    open_days_label: string;
    closed_days_label: string;
    hours_label: string;
    closed_weekdays: number[];
    open_from_minutes: number;
    open_to_minutes: number;
    schedule: Array<{
      day: string;
      closed: boolean;
      hours: Array<{ from: string; to: string }> | null;
    }>;
    timezone_offset_seconds: number;
  };
  prices: {
    man_haircut: string;
    rows: Array<{ name: string; price: string; muted: boolean }>;
  };
  amenities: Array<{ id: string; title: string; desc: string }>;
  aspects: string[];
  transport: {
    stops: Array<{ name: string; distance?: string }>;
    metro: Array<{ name: string; distance?: string }>;
  };
  gallery: GalleryItem[];
  hero_image: string;
  why_image: string;
  reviews: Review[];
}
