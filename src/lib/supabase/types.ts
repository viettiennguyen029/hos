import type { Role } from "@/lib/nav-items";

export type KycStatus = "unverified" | "pending" | "verified" | "rejected";

export interface SocialLink {
  platform: string;
  url: string;
}

export interface Achievement {
  title: string;
  subtitle: string;
}

/** A row from an admin-managed static lookup table (cities, genres, or categories/subcategories). */
export interface LookupOption {
  id: string;
  name: string;
}

/**
 * A talent's already-committed time window (confirmed package booking or
 * accepted event application) — from the get_talent_busy_slots() RPC, which
 * deliberately exposes only date/time across every organizer's bookings for
 * that talent, not who booked it or for how much, so other organizers can
 * avoid scheduling a collision without seeing another organizer's booking.
 */
export interface BusySlot {
  date: string;
  startTime: string;
  endTime: string;
}

/** A top-level category with its (possibly empty) subcategories — from the self-referencing categories table. */
export interface CategoryOption extends LookupOption {
  subcategories: LookupOption[];
}

export interface Profile {
  id: string;
  role: Role;
  slug: string;
  full_name: string;
  avatar_url: string | null;
  bio: string | null;
  city_id: string | null;
  keywords: string[];
  kyc_status: KycStatus;
  notifications_read_at: string | null;
  created_at: string;
  cover_url: string | null;
  gallery_urls: string[];
  social_links: SocialLink[];
  achievements: Achievement[];
  services: string[];
  date_of_birth: string | null;
  genre_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
}

/** Profile row plus the auth email, which lives on auth.users, not profiles. */
export interface CurrentUser extends Profile {
  email: string;
}

/** Profile plus resolved lookup display names — for read-only public display (e.g. the Talent detail page), as opposed to edit forms which need the raw *_id to preselect the right <option>. */
export interface ProfileWithLookupNames extends Profile {
  city_name: string | null;
  genre_name: string | null;
  category_name: string | null;
  subcategory_name: string | null;
}

export type EventStatus = "upcoming" | "completed" | "cancelled";

export interface EventRow {
  id: string;
  organizer_id: string;
  slug: string;
  name: string;
  venue: string;
  address: string;
  event_date: string;
  start_time: string;
  end_time: string;
  tagline: string | null;
  description: string | null;
  budget_min_vnd: number | null;
  budget_max_vnd: number | null;
  contact_phone: string | null;
  expected_guests: number | null;
  special_requirements: string | null;
  photo_urls: string[];
  status: EventStatus;
  created_at: string;
}

export interface EventSlotRow {
  id: string;
  event_id: string;
  category_id: string;
  price_usd: number;
  slot_type: string;
  quantity_total: number;
  created_at: string;
}

export type ApplicationStatus = "pending" | "accepted" | "rejected";

export interface EventApplicationRow {
  id: string;
  slot_id: string;
  applicant_profile_id: string;
  offer_amount_usd: number | null;
  status: ApplicationStatus;
  created_at: string;
  updated_at: string;
}

/** Row from the event_listing_summary view — for Discover/Home cards. */
export interface EventListingSummary {
  id: string;
  slug: string;
  name: string;
  venue: string;
  address: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: EventStatus;
  organizer_id: string;
  created_at: string;
  total_slots: number;
  filled_slots: number;
  budget_min_vnd: number | null;
  budget_max_vnd: number | null;
  categories: string[];
  photo_urls: string[];
}

export type EventDiscoverSort = "newest" | "price_asc" | "price_desc";

/** The agency/talent Events Discover grid's current filter/sort/search selection — mirrors search_event_listings()'s params. */
export interface EventDiscoverFilters {
  category: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  search: string | null;
  sort: EventDiscoverSort;
}

/** Keyset pagination cursor for search_event_listings() — the last-loaded row's sort key + id. */
export interface EventDiscoverCursor {
  createdAt: string;
  budgetMin: number;
  id: string;
}

/** Full event detail: the event row, its slots (with resolved category name), and the organizer's profile. */
export interface EventWithSlots extends EventRow {
  slots: (EventSlotRow & { category_name: string })[];
  organizer: Pick<Profile, "full_name" | "bio" | "gallery_urls" | "social_links"> & {
    city_name: string | null;
  };
}

/** An application joined with its slot/event/applicant info — for the organizer's review UI. */
export interface EventApplicationWithDetails extends EventApplicationRow {
  slot_category: string;
  slot_price_usd: number;
  event_id: string;
  event_name: string;
  event_date: string;
  applicant_name: string;
}

export type PaymentMethod = "Prepaid" | "Postpaid";
export type PackageStatus = "active" | "closed";

export interface PackageRow {
  id: string;
  talent_id: string;
  category_id: string;
  subcategory_id: string | null;
  title: string;
  residency: string | null;
  city_id: string;
  working_method: string | null;
  skill_tags: string[];
  repeat_on: boolean;
  repeat_days: string[] | null;
  start_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  description: string | null;
  price_min_vnd: number;
  price_max_vnd: number;
  payment_method: PaymentMethod;
  status: PackageStatus;
  /** Manually curated by an admin directly in the database — no admin portal exists yet. */
  is_most_popular: boolean;
  is_editor_choice: boolean;
  created_at: string;
}

/** A package with its city/category/subcategory ids resolved to display names — for the public Talent detail page's own package list. */
export interface PackageWithLookupNames extends PackageRow {
  category_name: string;
  subcategory_name: string | null;
  city_name: string;
}

/** An active package joined with its talent's name/slug and resolved lookup names — for the organizer Discover grid. */
export interface PackageWithTalent extends PackageRow {
  talent_name: string;
  talent_slug: string;
  talent_keywords: string[];
  talent_avatar_url: string | null;
  talent_genre_name: string | null;
  category_name: string;
  subcategory_name: string | null;
  city_name: string;
}

export type DiscoverSort = "newest" | "price_asc" | "price_desc";

/** The organizer Discover grid's current filter/sort/search selection — mirrors search_discover_packages()'s params. */
export interface DiscoverFilters {
  categoryId: string | null;
  subcategoryId: string | null;
  cityId: string | null;
  priceMin: number;
  priceMax: number;
  hashtags: string[];
  dateStart: string | null;
  dateEnd: string | null;
  search: string | null;
  sort: DiscoverSort;
}

/** Keyset pagination cursor for search_discover_packages() — the last-loaded row's sort key + id. */
export interface DiscoverCursor {
  createdAt: string;
  priceMin: number;
  id: string;
}

export interface CartItemRow {
  id: string;
  organizer_id: string;
  package_id: string;
  price_vnd: number;
  booked_date: string | null;
  /** Start of the actual performance slot the organizer wants — a specific
   * time within the package's (wider) availability window. */
  booked_time: string | null;
  /** Organizer-chosen end of that slot — the package's own end_time is just
   * when the talent's availability window closes, not how long any one
   * booking runs. */
  booked_end_time: string | null;
  /** Where the performance actually happens — distinct from the package's own (base) city. */
  city_id: string | null;
  address: string | null;
  created_at: string;
}

/** A cart item joined with its package + the talent who owns it — for the cart popover/checkout page. */
export interface CartItemWithPackage extends CartItemRow {
  package: Pick<PackageRow, "id" | "title"> & { city_name: string };
  talent: Pick<Profile, "id" | "full_name">;
}

export type BookingStatus = "pending" | "dealing" | "confirmed" | "completed" | "cancelled";

/** Whose turn it is to Confirm/Counter/Cancel — null once the booking is confirmed/completed/cancelled. */
export type BookingParty = "talent" | "organizer";

/**
 * Only meaningful once status is 'confirmed'/'completed'. Postpaid bookings
 * are set 'complete' at confirm time (payment happens after the event);
 * Prepaid bookings start 'pending' until the organizer confirms payment.
 */
export type BookingPaymentStatus = "pending" | "complete";

/** How a Prepaid booking's payment moves -- null for pre-existing/Postpaid bookings, which never had a channel. */
export type PaymentChannel = "fiat" | "crypto";

/** On-chain escrow lifecycle for a crypto-channel booking -- advanced by the indexer as EscrowManager events land. */
export type EscrowState = "none" | "registered" | "funded" | "released" | "refunded";

export interface PackageBookingRow {
  id: string;
  package_id: string;
  organizer_id: string;
  price_vnd: number;
  talent_offer_vnd: number;
  organizer_offer_vnd: number;
  awaiting_response_from: BookingParty | null;
  booked_date: string | null;
  booked_time: string | null;
  booked_end_time: string | null;
  /** Where the performance actually happens — distinct from the package's own (base) city. */
  city_id: string | null;
  address: string | null;
  payment_method: PaymentMethod;
  status: BookingStatus;
  payment_status: BookingPaymentStatus;
  /** Set when the talent flags the event as done -- proof + a reminder to the organizer, not a status change. */
  talent_marked_complete_at: string | null;
  /**
   * Optional (rather than always-required) so pre-crypto-feature call sites
   * building a row/fixture without these columns still typecheck -- every
   * row actually fetched from the DB (select *) has them, defaulting to
   * fiat/'none' semantics when absent.
   */
  payment_channel?: PaymentChannel | null;
  /** The EscrowManager bytes32 booking id, once registered on-chain -- null until then. */
  escrow_booking_id?: string | null;
  escrow_state?: EscrowState;
  created_at: string;
  updated_at: string;
}

/** A booking joined with the counterpart's name — for each role's Orders page. */
export interface BookingWithNames extends PackageBookingRow {
  package_title: string;
  organizer_name: string;
  talent_name: string;
}

/** A booking joined with full package + counterpart info — for the Order Detail page. */
export interface BookingDetail extends PackageBookingRow {
  organizer_name: string;
  talent_name: string;
  package_title: string;
  package_description: string | null;
  package_working_method: string | null;
  package_skill_tags: string[];
  /** The perform location entered by the organizer for this specific booking — not the package's own city. */
  venue_city_name: string | null;
  venue_address: string | null;
}

export type QuotationStatus = "pending" | "quoted" | "accepted" | "rejected" | "declined";

export interface QuotationRow {
  id: string;
  organizer_id: string;
  talent_id: string;
  event_name: string;
  event_date: string | null;
  /** The requested performance slot — a specific time, not an availability
   * window (a quotation isn't tied to any one package). */
  event_start_time: string | null;
  event_end_time: string | null;
  venue: string | null;
  city_id: string | null;
  address: string | null;
  description: string | null;
  budget_min_vnd: number | null;
  budget_max_vnd: number | null;
  status: QuotationStatus;
  quoted_price_vnd: number | null;
  talent_note: string | null;
  created_at: string;
  updated_at: string;
}

/** A quotation joined with both parties' names and the resolved perform-city name — for each side's Quotations tab. */
export interface QuotationWithNames extends QuotationRow {
  organizer_name: string;
  talent_name: string;
  city_name: string | null;
}

export interface ReviewRow {
  id: string;
  reviewer_id: string;
  talent_id: string;
  booking_id: string | null;
  application_id: string | null;
  rating: number;
  comment: string | null;
  created_at: string;
}

/** A review joined with the reviewer's display name — for the talent-detail Reviews tab. */
export interface ReviewWithReviewer extends ReviewRow {
  reviewer_name: string;
}

export type NotificationKind =
  | "application_received"
  | "application_status"
  | "booking_marked_complete_by_talent"
  | "booking_received"
  | "booking_status"
  | "counter_offer_received"
  | "kyc_status"
  | "quotation_received"
  | "quotation_responded";

/** Derived at query time from event_applications/package_bookings/kyc_submissions — not a stored table. */
export interface NotificationItem {
  id: string;
  kind: NotificationKind;
  message: string;
  time: string;
  unread: boolean;
}
