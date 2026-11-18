/**
 * Schéma de la base de données (Drizzle ORM, dialecte SQLite).
 *
 * Choix de conception pour faciliter une migration future vers PostgreSQL :
 * - identifiants en texte (UUID v4 générés côté application) ;
 * - dates stockées en millisecondes (timestamp_ms) et manipulées en `Date` ;
 * - énumérations stockées en texte, contrôlées par TypeScript et Zod ;
 * - aucune fonctionnalité spécifique à SQLite dans les requêtes.
 *
 * Séparation public / privé :
 * - Les colonnes marquées « PRIVÉ » ne doivent JAMAIS être sélectionnées par
 *   les requêtes servant l'espace public. Les requêtes publiques utiliseront
 *   une liste blanche explicite de colonnes (voir Phase 3).
 */
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

/* -------------------------------------------------------------------------- */
/* Énumérations                                                               */
/* -------------------------------------------------------------------------- */

export const USER_ROLES = ["admin", "employee"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const FAMILY_STATUSES = ["active", "inactive", "archived"] as const;
export type FamilyStatus = (typeof FAMILY_STATUSES)[number];

export const PROFILE_STATUSES = [
  "draft",
  "pending",
  "published",
  "archived",
  "deleted",
] as const;
export type ProfileStatus = (typeof PROFILE_STATUSES)[number];

export const MEDIA_TYPES = ["image", "video", "document"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const MEDIA_STATUSES = ["active", "deleted"] as const;
export type MediaStatus = (typeof MEDIA_STATUSES)[number];

export const MODERATION_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "hidden",
] as const;
export type ModerationStatus = (typeof MODERATION_STATUSES)[number];

/* -------------------------------------------------------------------------- */
/* Helpers de colonnes                                                        */
/* -------------------------------------------------------------------------- */

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID());

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

const updatedAt = () =>
  integer("updated_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date());

/* -------------------------------------------------------------------------- */
/* Utilisateurs et sessions                                                   */
/* -------------------------------------------------------------------------- */

export const users = sqliteTable(
  "users",
  {
    id: id(),
    name: text("name").notNull(),
    /** Toujours stocké en minuscules. */
    email: text("email").notNull(),
    /** PRIVÉ — hachage Argon2id, jamais le mot de passe en clair. */
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: USER_ROLES }).notNull().default("employee"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    lastLoginAt: integer("last_login_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(t.email)],
);

/**
 * Sessions du back-office. Le cookie contient un jeton aléatoire ; seule son
 * empreinte SHA-256 est stockée ici (une fuite de la base ne permet pas de
 * réutiliser les sessions).
 */
export const sessions = sqliteTable(
  "sessions",
  {
    /** Empreinte SHA-256 (hex) du jeton de session. */
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    ipHash: text("ip_hash"),
    userAgent: text("user_agent"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/** Tentatives de connexion, pour la protection contre la force brute. */
export const loginAttempts = sqliteTable(
  "login_attempts",
  {
    id: id(),
    /** E-mail saisi, normalisé en minuscules. */
    email: text("email").notNull(),
    ipHash: text("ip_hash"),
    success: integer("success", { mode: "boolean" }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("login_attempts_email_idx").on(t.email, t.createdAt),
    index("login_attempts_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Familles et fiches défunts                                                 */
/* -------------------------------------------------------------------------- */

/** Données entièrement PRIVÉES (jamais exposées publiquement). */
export const families = sqliteTable(
  "families",
  {
    id: id(),
    name: text("name").notNull(),
    contactName: text("contact_name"),
    contactPhone: text("contact_phone"),
    contactEmail: text("contact_email"),
    address: text("address"),
    internalNotes: text("internal_notes"),
    status: text("status", { enum: FAMILY_STATUSES })
      .notNull()
      .default("active"),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedById: text("updated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("families_name_idx").on(t.name),
    index("families_status_idx").on(t.status),
  ],
);

export const deceasedProfiles = sqliteTable(
  "deceased_profiles",
  {
    id: id(),
    /**
     * Identifiant PUBLIC long, aléatoire et non prédictible, utilisé dans
     * l'URL du QR code. Distinct de l'identifiant interne `id`. Immuable.
     */
    publicId: text("public_id").notNull(),
    familyId: text("family_id").references(() => families.id, {
      onDelete: "set null",
    }),

    // --- Champs publiables (affichés seulement si publiés et autorisés) ---
    fullName: text("full_name").notNull(),
    /** Dates au format ISO AAAA-MM-JJ (sans fuseau horaire). */
    birthDate: text("birth_date"),
    deathDate: text("death_date"),
    biography: text("biography"),
    mainPhotoMediaId: text("main_photo_media_id"),
    ceremonyDate: text("ceremony_date"),
    ceremonyTime: text("ceremony_time"),
    ceremonyLocation: text("ceremony_location"),
    ceremonyAddress: text("ceremony_address"),
    livestreamUrl: text("livestream_url"),
    /** Fleurs, dons, consignes particulières… (texte public). */
    practicalInfo: text("practical_info"),

    // --- Interrupteurs de visibilité publique (champ par champ) ---
    showDates: integer("show_dates", { mode: "boolean" }).notNull().default(true),
    showBiography: integer("show_biography", { mode: "boolean" })
      .notNull()
      .default(true),
    showCeremony: integer("show_ceremony", { mode: "boolean" })
      .notNull()
      .default(true),
    showPracticalInfo: integer("show_practical_info", { mode: "boolean" })
      .notNull()
      .default(true),
    showGallery: integer("show_gallery", { mode: "boolean" })
      .notNull()
      .default(true),
    allowCondolences: integer("allow_condolences", { mode: "boolean" })
      .notNull()
      .default(true),
    allowCandles: integer("allow_candles", { mode: "boolean" })
      .notNull()
      .default(true),

    // --- Champs PRIVÉS ---
    internalNotes: text("internal_notes"),
    status: text("status", { enum: PROFILE_STATUSES })
      .notNull()
      .default("draft"),
    publishedAt: integer("published_at", { mode: "timestamp_ms" }),
    createdById: text("created_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    updatedById: text("updated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("deceased_profiles_public_id_unique").on(t.publicId),
    index("deceased_profiles_family_idx").on(t.familyId),
    index("deceased_profiles_status_idx").on(t.status),
    index("deceased_profiles_name_idx").on(t.fullName),
  ],
);

/* -------------------------------------------------------------------------- */
/* Médias                                                                     */
/* -------------------------------------------------------------------------- */

export const media = sqliteTable(
  "media",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => deceasedProfiles.id, { onDelete: "cascade" }),
    type: text("type", { enum: MEDIA_TYPES }).notNull(),
    /**
     * Clé aléatoire utilisée dans les URL de diffusion (jamais l'identifiant
     * interne). Sert aussi de nom de fichier dans le stockage.
     */
    publicKey: text("public_key").notNull(),
    /** Chemin relatif dans le stockage protégé (jamais un chemin absolu). */
    storagePath: text("storage_path").notNull(),
    /** Miniature (images uniquement). */
    thumbPath: text("thumb_path"),
    mimeType: text("mime_type").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    width: integer("width"),
    height: integer("height"),
    caption: text("caption"),
    sortOrder: integer("sort_order").notNull().default(0),
    isPublic: integer("is_public", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: MEDIA_STATUSES }).notNull().default("active"),
    deletedAt: integer("deleted_at", { mode: "timestamp_ms" }),
    uploadedById: text("uploaded_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("media_profile_idx").on(t.profileId, t.status, t.sortOrder),
    uniqueIndex("media_public_key_unique").on(t.publicKey),
  ],
);

export type Media = typeof media.$inferSelect;

/* -------------------------------------------------------------------------- */
/* Condoléances et bougies                                                    */
/* -------------------------------------------------------------------------- */

export const condolenceMessages = sqliteTable(
  "condolence_messages",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => deceasedProfiles.id, { onDelete: "cascade" }),
    authorName: text("author_name").notNull(),
    message: text("message").notNull(),
    /** PRIVÉ — jamais affiché publiquement. */
    email: text("email"),
    /** PRIVÉ — jamais affiché publiquement. */
    phone: text("phone"),
    consentToPublish: integer("consent_to_publish", { mode: "boolean" })
      .notNull()
      .default(false),
    status: text("status", { enum: MODERATION_STATUSES })
      .notNull()
      .default("pending"),
    /** PRIVÉ — IP hachée, pour l'anti-spam uniquement. */
    ipHash: text("ip_hash"),
    moderatedById: text("moderated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: integer("moderated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("condolences_profile_status_idx").on(t.profileId, t.status),
    index("condolences_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

export const candles = sqliteTable(
  "candles",
  {
    id: id(),
    profileId: text("profile_id")
      .notNull()
      .references(() => deceasedProfiles.id, { onDelete: "cascade" }),
    firstName: text("first_name"),
    message: text("message"),
    status: text("status", { enum: MODERATION_STATUSES })
      .notNull()
      .default("pending"),
    /** PRIVÉ — IP hachée, pour l'anti-spam uniquement. */
    ipHash: text("ip_hash"),
    moderatedById: text("moderated_by_id").references(() => users.id, {
      onDelete: "set null",
    }),
    moderatedAt: integer("moderated_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (t) => [
    index("candles_profile_status_idx").on(t.profileId, t.status),
    index("candles_ip_idx").on(t.ipHash, t.createdAt),
  ],
);

/* -------------------------------------------------------------------------- */
/* Journal et paramètres                                                      */
/* -------------------------------------------------------------------------- */

export const activityLogs = sqliteTable(
  "activity_logs",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    /** Ex. : "auth.login", "family.create", "profile.publish". */
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    /** JSON sérialisé, sans donnée sensible. */
    details: text("details"),
    ipHash: text("ip_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("activity_logs_created_idx").on(t.createdAt),
    index("activity_logs_entity_idx").on(t.entityType, t.entityId),
  ],
);

/** Paramètres clé-valeur (valeur JSON sérialisée). */
export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedById: text("updated_by_id").references(() => users.id, {
    onDelete: "set null",
  }),
  updatedAt: updatedAt(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Family = typeof families.$inferSelect;
export type DeceasedProfile = typeof deceasedProfiles.$inferSelect;
