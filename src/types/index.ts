// ─── Trip ───────────────────────────────────────────
export type TripStatus = 'planning' | 'active' | 'completed' | 'cancelled';

export interface MealPreferences {
  breakfast: string;
  lunch: string;
  dinner: string;
  defaultMealCost: number;
  defaultHotelCost: number;
  defaultTransferCost: number;
}

export interface Trip {
  id: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  description: string;
  coverImage: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  status: TripStatus;
  budget?: number;
  budgetCurrency?: string;
  shareToken?: string;
  budgetCategories?: BudgetCategory[];
  travelerIds?: string[];
  dayLocations?: Record<string, string>; // { "2026-05-10": "Southampton, England", "2026-05-11": "Portland, England" }
  albumPhotos?: AlbumPhoto[];
  mealPreferences?: MealPreferences;
  quickNotes?: QuickNote[];
  customLinks?: CustomLink[];
  // ISO timestamp the user first saw the Closing Ceremony for this trip.
  // Once set, the recap page no longer auto-redirects them to /ceremony —
  // they can re-watch it via the explicit "Ver ceremonia" button.
  ceremonyShownAt?: string;
}

// ─── Custom Link ───────────────────────────────────
export type CustomLinkCategory =
  | 'vuelos'
  | 'hoteles'
  | 'autos'
  | 'restaurantes'
  | 'tours'
  | 'mapas'
  | 'seguros'
  | 'otros';

export interface CustomLink {
  id: string;
  name: string;
  url: string;
  category: CustomLinkCategory;
  createdAt: string;
}

// ─── Quick Note ───────────────────────────────────
export interface QuickNote {
  id: string;
  text: string;
  done: boolean;
  createdAt: string;
}

// ─── Album Photo ───────────────────────────────────
export interface AlbumPhoto {
  url: string;        // Thumbnail used in galleries (400px JPEG; legacy 600/1200px)
  fullUrl?: string;   // Full-quality version shown in lightbox/photobook. For new
                      // uploads this is the archived original (see originalUrl).
  optimized?: boolean; // True once the thumbnail has been re-compressed to 600px
  // ── original + derivatives (since the Resize Images extension, 2026-05) ──
  // The pristine original is archived for download / print / photobook; the
  // app shows small WebP derivatives the extension generates from it. The
  // derivative *paths* are deterministic (see photoUploader) so we store them
  // and resolve download URLs lazily, falling back to the original.
  originalUrl?: string;     // Full-res original (download / print / photobook)
  originalPath?: string;    // Storage path of the original
  viewPath?: string;        // Storage path of the 1280px WebP (lightbox view)
  thumbWebpPath?: string;   // Storage path of the 400px WebP (grid)
  // Download URLs for the derivatives above, resolved + persisted lazily by
  // useAlbum once the extension has produced them (they don't exist at upload
  // time). Display falls back to fullUrl/url until these are filled.
  viewUrl?: string;         // 1280px WebP download URL (lightbox)
  thumbWebpUrl?: string;    // 400px WebP download URL (grid)
  date: string;
  caption?: string;
  eventId?: string;
  uploadedAt: string;
  // SHA-256 of the original file bytes (hex). Set by photoUploader on new
  // uploads; used to detect duplicate uploads at pick-time.
  contentHash?: string;
  // Review mode (see /photos/review). Set when the user has triaged the
  // photo so the review flow can skip already-seen ones.
  reviewed?: boolean;
  reviewedAt?: string;
  // Star-favorite — surfaced first in slideshow/recap; independent of review.
  favorite?: boolean;
  // Soft delete with undo. Photos with deletedAt set are excluded from
  // every album view but still live in Storage; a cleanup pass purges them
  // after the retention window.
  deletedAt?: string | null;
}

// ─── Global Traveler ───────────────────────────────
export interface GlobalTraveler {
  id: string;
  fullName: string;
  relationship?: string;
  avatarColor?: string;
  dateOfBirth?: string;
  nationality?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  passportNumber?: string;
  passportCountry?: string;
  passportExpiry?: string;
  visaType?: string;
  visaCountry?: string;
  visaExpiry?: string;
  seatPreference?: 'window' | 'aisle' | 'middle' | '';
  dietaryRestrictions?: string;
  specialNeeds?: string;
  passportPhotoUrl?: string;
  visaPhotoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Member ─────────────────────────────────────────
/**
 * Formal roles for trip multi-tenancy. The 4 levels map to a coarse
 * permission ladder:
 *
 *   owner  → full control (delete trip, manage members, change settings)
 *   editor → can edit events/expenses/photos/documents
 *   viewer → read-only
 *   kid    → read-only with simplified UI hints (bigger fonts, fewer options)
 *
 * `kid` is functionally identical to `viewer` for write permissions —
 * the difference is purely cosmetic UI (forgiving experience for younger
 * travelers).
 *
 * `MemberRole` is kept as an alias of `TripRole` for backwards
 * compatibility with existing call sites; new code should prefer
 * `TripRole`.
 */
export type TripRole = 'owner' | 'editor' | 'viewer' | 'kid';
export type MemberRole = TripRole;

export interface TravelerInfo {
  // Personal
  fullName: string;
  dateOfBirth?: string;
  nationality?: string;
  phone?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  // Passport
  passportNumber?: string;
  passportCountry?: string;
  passportExpiry?: string;
  // Visa
  visaType?: string;
  visaCountry?: string;
  visaExpiry?: string;
  // Preferences
  seatPreference?: 'window' | 'aisle' | 'middle' | '';
  dietaryRestrictions?: string;
  specialNeeds?: string;
  // Documents
  passportPhotoUrl?: string;
  visaPhotoUrl?: string;
}

export interface TripMember {
  uid: string;
  email: string;
  displayName: string;
  role: TripRole;
  joinedAt: string;
  invitedBy: string;
  travelerInfo?: TravelerInfo;
}

// ─── Invite ─────────────────────────────────────────
export type InviteStatus = 'pending' | 'accepted' | 'declined';

export interface TripInvite {
  id: string;
  email: string;
  role: MemberRole;
  status: InviteStatus;
  invitedBy: string;
  createdAt: string;
}

// ─── Event ──────────────────────────────────────────
export type EventType = 'flight' | 'hotel' | 'activity' | 'restaurant' | 'transport' | 'car_rental' | 'cruise' | 'souvenirs' | 'snacks' | 'clothing' | 'fuel' | 'misc';
export type ExpenseCategory = EventType;
export type PaymentMethod = 'cash' | 'debit' | 'credit' | 'transfer' | 'points' | 'other';

export interface TripEvent {
  id: string;
  title: string;
  type: EventType;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  city?: string; // City name for photos context
  country?: string; // Country name for photos context
  notes: string;
  cost: number;
  currency: string;
  attachments: string[];
  details?: Record<string, string>;
  latitude?: number;
  longitude?: number;
  timezone?: string; // IANA timezone, ej. "America/Mazatlan"
  photos?: string[]; // URLs of event photos (trip memories)
  autoGenerated?: boolean;
  createdBy: string;
  createdAt: string;
}

// ─── Budget ─────────────────────────────────────────
export interface BudgetCategory {
  type: EventType;
  allocated: number;
}

export interface SharedExpense {
  id: string;
  eventId?: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string; // uid
  splitBetween: string[]; // uids
  date: string;
  createdAt: string;
}

export interface TripExpense {
  id: string;
  tripId: string;
  eventId?: string;
  description: string;
  amount: number;
  currency: string;
  category: ExpenseCategory;
  paidBy: string;
  splitBetween: string[];
  receiptUrl?: string;
  date: string;
  notes?: string;
  paymentMethod?: PaymentMethod;
  pointsUsed?: number;
  equivalentValue?: number;
  realValueCurrency?: string;
  settled?: boolean;
  /**
   * True when the expense was created in a hurry via the Fast Expense
   * FAB (camera OCR or manual quick-entry). Defaults to false for
   * expenses created in the full editor. Used by /expenses to surface
   * a "pendientes de revisar" banner so the user can confirm split,
   * pagador and descripción at the end of the day.
   * Becomes false the first time the user opens + saves the full edit
   * modal for this expense.
   */
  needsReview?: boolean;
  createdAt: string;
  createdBy: string;
}

// ─── Attachment ─────────────────────────────────────
export type DocumentCategory =
  | 'flight'
  | 'hotel'
  | 'car_rental'
  | 'restaurant'
  | 'activity'
  | 'transport'
  | 'cruise'
  | 'insurance'
  | 'passport'
  | 'visa'
  | 'other';

export interface TripAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedBy: string;
  createdAt: string;
  eventId?: string;
  category?: DocumentCategory;
}

// ─── Checklist ──────────────────────────────────────
export type ChecklistPhase = 'pre-7d' | 'pre-1d' | 'airport' | 'hotel' | 'return';

export interface ChecklistItem {
  id: string;
  text: string;
  checked: boolean;
  phase: ChecklistPhase;
  createdBy: string;
  createdAt: string;
}

// ─── Activity Log ──────────────────────────────────
export interface ActivityLogEntry {
  id: string;
  action: 'created' | 'updated' | 'deleted';
  entityType: 'event' | 'checklist' | 'document' | 'member' | 'trip';
  entityName: string;
  userId: string;
  userName: string;
  createdAt: string;
}

// ─── User (minimal for auth) ────────────────────────
export interface AppUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string | null;
}
