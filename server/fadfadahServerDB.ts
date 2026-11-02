import crypto from 'crypto';
import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = process.env.FADFADAH_DATA_DIR?.trim()
  ? path.resolve(process.env.FADFADAH_DATA_DIR.trim())
  : path.resolve(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'fadfadah.db.json');

export type UserRole = 'owner' | 'moderator' | 'user';
export type AccountStatus = 'active' | 'warned' | 'restricted' | 'suspended' | 'banned';

export type ChatRoomType = 'LINK_BASED' | 'RANDOM';
export type ChatRoomStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';
export type MessageStatus = 'SENT' | 'READ';
export type MediaType = 'text' | 'image' | 'sticker';
export type PremiumPlan = 'free' | 'weekly' | 'monthly' | 'quarterly';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED';
export type ReportTargetType = 'user' | 'message' | 'vent';
export type ModerationActionType =
  | 'WARN'
  | 'RESTRICT'
  | 'SUSPEND'
  | 'BAN'
  | 'UNBAN'
  | 'RESOLVE_REPORT'
  | 'DISMISS_REPORT';

export type PaymentTransactionType =
  | 'SUBSCRIPTION'
  | 'POINTS_PACK'
  | 'MANUAL_TOPUP'
  | 'FRAME_PURCHASE'
  | 'QUOTA_UNLOCK';
export type PaymentStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ManualTopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ServerManualTopupPackage {
  id: string;
  title_ar: string;
  title_en: string;
  points: number;
  amount: number;
  currency: string;
  enabled: boolean;
}

export interface ServerManualPaymentMethod {
  id: string;
  title_ar: string;
  title_en: string;
  instructions_ar: string;
  instructions_en: string;
  enabled: boolean;
}

export interface ServerManualTopupRequest {
  id: string;
  user_id: string;
  user_nickname: string;
  package_id: string;
  package_title_ar: string;
  package_title_en: string;
  points: number;
  amount: number;
  currency: string;
  payment_method_id: string;
  payment_method_title_ar: string;
  payment_method_title_en: string;
  payment_instructions_ar: string;
  payment_instructions_en: string;
  transaction_reference: string;
  reference_key: string;
  proof_file: string;
  proof_mime_type: string;
  status: ManualTopupStatus;
  rejection_reason?: string;
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
  idempotency_key: string;
}

export interface ServerUserRecord {
  id: string;
  auth_token_hash: string;
  recovery_code_hash?: string;
  nickname: string;
  avatar_url: string;
  frame_id: number;
  interests: string[];
  languages: string[];
  country: string;
  embedding_vector: number[];
  is_premium: boolean;
  premium_plan: PremiumPlan;
  points: number;
  unlocked_frames: number[];
  blocked_user_ids: string[];
  daily_random_count: number;
  last_random_date: string;
  bio: string;
  role: UserRole;
  status: AccountStatus;
  warning_message?: string;
  restriction_reason?: string;
  suspension_until?: number;
  banned_at?: number;
  ban_reason?: string;
  created_at: number;
  last_seen_at: number;
}

export interface PublicUserDTO {
  id: string;
  nickname: string;
  avatar_url: string;
  frame_id: number;
  interests: string[];
  languages: string[];
  country: string;
  embedding_vector: number[];
  is_premium: boolean;
  role: UserRole;
  status: AccountStatus;
  is_online: boolean;
  bio: string;
}

export interface ServerPersonalLink {
  id: string;
  user_id: string;
  slug: string;
  is_active: boolean;
  visits_count: number;
  created_at: number;
}

export interface ServerChatRoom {
  id: string;
  type: ChatRoomType;
  participant_a: string;
  participant_b: string;
  status: ChatRoomStatus;
  unread_a: number;
  unread_b: number;
  last_message_preview: string;
  last_message_at: number;
  created_at: number;
}

export interface ServerMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  media_url: string;
  media_type: MediaType;
  ai_flag_score: number;
  ai_flag_reason: string;
  is_frozen: boolean;
  status: MessageStatus;
  created_at: number;
}

export interface ServerPublicVent {
  id: string;
  author_id: string;
  topic: string;
  content: string;
  liked_user_ids: string[];
  ai_flag_score: number;
  created_at: number;
}

export interface ServerReportModeration {
  id: string;
  reporter_id: string;
  reporter_nickname: string;
  reported_user_id: string;
  reported_user_nickname: string;
  room_id?: string;
  target_type: ReportTargetType;
  target_id?: string;
  reason: string;
  details: string;
  evidence_snapshot: string;
  ai_summary: string;
  status: ReportStatus;
  created_at: number;
  updated_at: number;
  resolved_by?: string;
  resolved_by_name?: string;
  resolution_note?: string;
  action_taken?: 'none' | 'warning' | 'restriction' | 'suspension' | 'ban';
}

export interface ServerModerationAction {
  id: string;
  moderator_id: string;
  moderator_name: string;
  moderator_role: UserRole;
  target_user_id: string;
  target_user_nickname: string;
  report_id?: string;
  action_type: ModerationActionType;
  reason: string;
  duration_hours?: number;
  created_at: number;
}

export interface ServerPaymentTransaction {
  id: string;
  user_id: string;
  user_nickname: string;
  type: PaymentTransactionType;
  item_id: string;
  item_title: string;
  amount_usd: number;
  points_delta: number;
  status: PaymentStatus;
  order_id: string;
  idempotency_key: string;
  created_at: number;
  amount_currency?: string;
}

export interface ServerAdSettings {
  enabled: boolean;
  banner_enabled: boolean;
  chat_card_enabled: boolean;
  interstitial_enabled: boolean;
  rewarded_enabled: boolean;
  test_mode: boolean;
  ad_provider: 'adsense' | 'monetag' | 'custom' | 'admob';
  adsense_publisher_id: string; // e.g. ca-pub-XXXXXXXXXXXXXXXX
  adsense_banner_slot_id: string; // e.g. 1234567890
  monetag_zone_id: string; // e.g. zone ID or link
  chat_sponsor_url: string;
  custom_banner_code: string; // HTML / iframe snippet from any ad network
  rewarded_sponsor_url: string; // Direct link or sponsored offer for rewarded ad
  admob_app_id: string;
  admob_banner_id: string;
  admob_interstitial_id: string;
  admob_rewarded_id: string;
  reward_points_amount: number;
  interstitial_cooldown_seconds: number;
}

export const DEFAULT_AD_SETTINGS: ServerAdSettings = {
  enabled: true,
  banner_enabled: true,
  chat_card_enabled: true,
  interstitial_enabled: true,
  rewarded_enabled: false,
  test_mode: true,
  ad_provider: 'admob',
  adsense_publisher_id: '',
  adsense_banner_slot_id: '',
  monetag_zone_id: '',
  chat_sponsor_url: 'https://uplcm.com/4/12175682',
  custom_banner_code: '',
  rewarded_sponsor_url: 'https://adsense.google.com',
  admob_app_id: 'ca-app-pub-3940256099942544~3347511713',
  admob_banner_id: 'ca-app-pub-3940256099942544/6300978111',
  admob_interstitial_id: 'ca-app-pub-3940256099942544/1033173712',
  admob_rewarded_id: 'ca-app-pub-3940256099942544/5224354917',
  reward_points_amount: 25,
  interstitial_cooldown_seconds: 90,
};

interface PersistedDatabaseShape {
  schemaVersion: number;
  owner_bootstrap_completed?: boolean;
  owner_recovery_completed?: boolean;
  chat_card_setting_migrated?: boolean;
  users: ServerUserRecord[];
  personal_links: ServerPersonalLink[];
  chat_rooms: ServerChatRoom[];
  messages: ServerMessage[];
  public_vents: ServerPublicVent[];
  reports_moderation: ServerReportModeration[];
  moderation_actions?: ServerModerationAction[];
  payment_transactions?: ServerPaymentTransaction[];
  manual_topup_requests?: ServerManualTopupRequest[];
  manual_topup_packages?: ServerManualTopupPackage[];
  manual_payment_methods?: ServerManualPaymentMethod[];
  ad_settings?: ServerAdSettings;
}

const INTEREST_VOCAB = [
  'قراءة',
  'موسيقى',
  'سفر',
  'ألعاب',
  'فضفضة',
  'تقنية',
  'فن',
  'رياضة',
  'سينما',
  'شعر',
  'علم نفس',
  'قهوة',
  'العربية',
  'English',
  'Français',
  'هدوء',
];

export function computeServerEmbedding(interests: string[], languages: string[]): number[] {
  const set = new Set([...interests, ...languages]);
  const raw = INTEREST_VOCAB.map((token) => (set.has(token) ? 1.0 : 0.08));
  const norm = Math.sqrt(raw.reduce((s, v) => s + v * v, 0)) || 1;
  return raw.map((v) => Number((v / norm).toFixed(4)));
}

export function cosineSimilarityServer(a: number[], b: number[]): number {
  if (!a.length || !b.length) return 0.5;
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  if (!denom) return 0.5;
  return Math.max(0, Math.min(1, dot / denom));
}

export function hashAuthToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export class FadfadahServerDB {
  public users = new Map<string, ServerUserRecord>();
  public tokenIndex = new Map<string, string>(); // tokenHash -> userId
  public personalLinks = new Map<string, ServerPersonalLink>(); // linkId -> link
  public slugIndex = new Map<string, string>(); // slug -> linkId
  public chatRooms = new Map<string, ServerChatRoom>();
  public messages = new Map<string, ServerMessage>();
  public publicVents = new Map<string, ServerPublicVent>();
  public reports = new Map<string, ServerReportModeration>();
  public moderationActions = new Map<string, ServerModerationAction>();
  public paymentTransactions = new Map<string, ServerPaymentTransaction>();
  public manualTopupRequests = new Map<string, ServerManualTopupRequest>();
  public manualTopupPackages: ServerManualTopupPackage[] = [];
  public manualPaymentMethods: ServerManualPaymentMethod[] = [];
  public idempotencyKeys = new Set<string>();
  public adSettings: ServerAdSettings = { ...DEFAULT_AD_SETTINGS };
  public ownerBootstrapCompleted = false;
  public ownerRecoveryCompleted = false;
  private chatCardSettingMigrated = false;

  private flushPromise: Promise<void> = Promise.resolve();
  private flushScheduled = false;

  async init(): Promise<void> {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      try {
        const raw = await fsp.readFile(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedDatabaseShape>;
        for (const u of parsed.users ?? []) {
          // Backward compatibility defaults
          if (!u.role) u.role = 'user';
          if (!u.status) u.status = 'active';
          this.users.set(u.id, u);
          this.tokenIndex.set(u.auth_token_hash, u.id);
        }
        for (const l of parsed.personal_links ?? []) {
          this.personalLinks.set(l.id, l);
          this.slugIndex.set(l.slug.toLowerCase(), l.id);
        }
        for (const r of parsed.chat_rooms ?? []) {
          this.chatRooms.set(r.id, r);
        }
        for (const m of parsed.messages ?? []) {
          this.messages.set(m.id, m);
        }
        for (const v of parsed.public_vents ?? []) {
          this.publicVents.set(v.id, v);
        }
        for (const rep of parsed.reports_moderation ?? []) {
          if (!rep.status) rep.status = 'PENDING';
          if (!rep.target_type) rep.target_type = 'user';
          if (!rep.updated_at) rep.updated_at = rep.created_at;
          this.reports.set(rep.id, rep);
        }
        for (const act of parsed.moderation_actions ?? []) {
          this.moderationActions.set(act.id, act);
        }
        for (const tx of parsed.payment_transactions ?? []) {
          this.paymentTransactions.set(tx.id, tx);
          if (tx.idempotency_key) {
            this.idempotencyKeys.add(tx.idempotency_key);
          }
        }
        for (const request of parsed.manual_topup_requests ?? []) {
          this.manualTopupRequests.set(request.id, request);
        }
        this.manualTopupPackages = parsed.manual_topup_packages ?? [];
        this.manualPaymentMethods = parsed.manual_payment_methods ?? [];
        this.ownerBootstrapCompleted =
          parsed.owner_bootstrap_completed === true ||
          Array.from(this.users.values()).some((user) => user.role === 'owner');
        this.ownerRecoveryCompleted = parsed.owner_recovery_completed === true;
        this.chatCardSettingMigrated = parsed.chat_card_setting_migrated === true;
        if (parsed.ad_settings) {
          this.adSettings = { ...DEFAULT_AD_SETTINGS, ...parsed.ad_settings };
        }
        if (!this.chatCardSettingMigrated) {
          this.adSettings.chat_card_enabled = true;
          this.chatCardSettingMigrated = true;
          this.scheduleSave();
        }

      } catch (err) {
        console.error('Failed to read existing fadfadah.db.json, starting fresh:', err);
      }
    } else {
      this.chatCardSettingMigrated = true;
      await this.flushNow();
    }
  }

  scheduleSave(): void {
    if (this.flushScheduled) return;
    this.flushScheduled = true;
    setTimeout(() => {
      this.flushScheduled = false;
      this.flushPromise = this.flushPromise.then(() => this.flushNow()).catch((err) => {
        console.error('Disk flush error:', err);
      });
    }, 60);
  }

  async flushNow(): Promise<void> {
    const snapshot: PersistedDatabaseShape = {
      schemaVersion: 391,
      users: Array.from(this.users.values()),
      personal_links: Array.from(this.personalLinks.values()),
      chat_rooms: Array.from(this.chatRooms.values()),
      messages: Array.from(this.messages.values()),
      public_vents: Array.from(this.publicVents.values()),
      reports_moderation: Array.from(this.reports.values()),
      moderation_actions: Array.from(this.moderationActions.values()),
      payment_transactions: Array.from(this.paymentTransactions.values()),
      manual_topup_requests: Array.from(this.manualTopupRequests.values()),
      manual_topup_packages: this.manualTopupPackages,
      manual_payment_methods: this.manualPaymentMethods,
      owner_bootstrap_completed: this.ownerBootstrapCompleted,
      owner_recovery_completed: this.ownerRecoveryCompleted,
      chat_card_setting_migrated: this.chatCardSettingMigrated,
      ad_settings: this.adSettings,
    };
    const tmpFile = `${DB_FILE}.tmp`;
    await fsp.writeFile(tmpFile, JSON.stringify(snapshot, null, 2), 'utf-8');
    await fsp.rename(tmpFile, DB_FILE);
  }

  async saveManualTopupProof(fileName: string, mimeType: string, bytes: Buffer): Promise<void> {
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(fileName)) {
      throw new Error('Invalid manual top-up proof file name.');
    }
    const extension = path.extname(fileName);
    const expectedMimeType =
      extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    if (mimeType !== expectedMimeType) {
      throw new Error('Manual top-up proof extension does not match its MIME type.');
    }
    const proofDirectory = path.join(DATA_DIR, 'manual-topup-proofs');
    await fsp.mkdir(proofDirectory, { recursive: true });
    await fsp.writeFile(path.join(proofDirectory, fileName), bytes, { flag: 'wx', mode: 0o600 });
  }

  async readManualTopupProof(fileName: string): Promise<{ mimeType: string; bytes: Buffer }> {
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(fileName)) {
      throw new Error('Invalid manual top-up proof file name.');
    }
    const extension = path.extname(fileName);
    const mimeType = extension === '.png' ? 'image/png' : extension === '.webp' ? 'image/webp' : 'image/jpeg';
    const bytes = await fsp.readFile(path.join(DATA_DIR, 'manual-topup-proofs', fileName));
    return { mimeType, bytes };
  }

  async deleteManualTopupProof(fileName: string): Promise<void> {
    if (!/^[a-f0-9-]{36}\.(png|jpg|webp)$/.test(fileName)) {
      throw new Error('Invalid manual top-up proof file name.');
    }
    await fsp.rm(path.join(DATA_DIR, 'manual-topup-proofs', fileName), { force: true });
  }

  authenticateToken(rawToken: string | undefined): ServerUserRecord | null {
    if (!rawToken) return null;
    const hash = hashAuthToken(rawToken);
    const userId = this.tokenIndex.get(hash);
    if (!userId) return null;
    const user = this.users.get(userId) ?? null;
    if (user && user.status === 'suspended' && user.suspension_until && user.suspension_until <= Date.now()) {
      // Auto-lift expired suspension
      user.status = 'active';
      user.suspension_until = undefined;
      this.scheduleSave();
    }
    return user;
  }

  reserveUniqueSlug(desired: string, currentUserId?: string): string {
    const base =
      desired
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .slice(0, 22) || `user_${Math.floor(1000 + Math.random() * 8999)}`;

    let candidate = base;
    let suffix = 1;
    while (this.slugIndex.has(candidate)) {
      const existingLinkId = this.slugIndex.get(candidate)!;
      const existingLink = this.personalLinks.get(existingLinkId);
      if (existingLink && existingLink.user_id === currentUserId) {
        return candidate;
      }
      candidate = `${base}_${Math.floor(10 + Math.random() * 89 + suffix)}`;
      suffix++;
    }
    return candidate;
  }

  registerNewUser(params?: {
    nickname?: string;
    avatar_url?: string;
    country?: string;
    languages?: string[];
    interests?: string[];
  }): {
    user: ServerUserRecord;
    link: ServerPersonalLink;
    rawToken: string;
    recoveryCode: string;
  } {
    const id = crypto.randomUUID();
    const rawToken = generateRawToken();
    const recoveryCode = generateRawToken();
    const tokenHash = hashAuthToken(rawToken);
    const randNum = Math.floor(1000 + Math.random() * 8999);
    const nickname = params?.nickname?.trim().slice(0, 24) || `User_${randNum}`;
    const slug = this.reserveUniqueSlug(nickname, id);
    const interests = params?.interests?.length
      ? params.interests
      : ['فضفضة', 'قراءة', 'موسيقى'];
    const languages = params?.languages?.length ? params.languages : ['العربية'];
    const now = Date.now();
    const todayStr = new Date().toISOString().slice(0, 10);

    const user: ServerUserRecord = {
      id,
      auth_token_hash: tokenHash,
      recovery_code_hash: hashAuthToken(recoveryCode),
      nickname,
      avatar_url: params?.avatar_url || 'aurora',
      frame_id: 0,
      interests,
      languages,
      country: params?.country || 'عالمي',
      embedding_vector: computeServerEmbedding(interests, languages),
      is_premium: false,
      premium_plan: 'free',
      points: 150,
      unlocked_frames: [0, 1],
      blocked_user_ids: [],
      daily_random_count: 0,
      last_random_date: todayStr,
      bio: 'مساحة آمنة للفضفضة والدردشة المجهولة.',
      role: 'user',
      status: 'active',
      created_at: now,
      last_seen_at: now,
    };

    const link: ServerPersonalLink = {
      id: crypto.randomUUID(),
      user_id: id,
      slug,
      is_active: true,
      visits_count: 0,
      created_at: now,
    };

    this.users.set(user.id, user);
    this.tokenIndex.set(tokenHash, user.id);
    this.personalLinks.set(link.id, link);
    this.slugIndex.set(slug, link.id);
    this.scheduleSave();

    return { user, link, rawToken, recoveryCode };
  }

  recoverAccount(recoveryCode: string): {
    user: ServerUserRecord;
    link: ServerPersonalLink;
    rawToken: string;
    recoveryCode: string;
  } | null {
    const codeHash = hashAuthToken(recoveryCode);
    const user = Array.from(this.users.values()).find(
      (candidate) =>
        candidate.recovery_code_hash &&
        /^[a-f0-9]{64}$/.test(candidate.recovery_code_hash) &&
        crypto.timingSafeEqual(
          Buffer.from(candidate.recovery_code_hash, 'hex'),
          Buffer.from(codeHash, 'hex')
        )
    );
    if (!user) return null;

    const link = this.getLinkForUser(user.id);
    if (!link) return null;

    const rawToken = generateRawToken();
    const nextRecoveryCode = generateRawToken();
    this.tokenIndex.delete(user.auth_token_hash);
    user.auth_token_hash = hashAuthToken(rawToken);
    user.recovery_code_hash = hashAuthToken(nextRecoveryCode);
    this.tokenIndex.set(user.auth_token_hash, user.id);
    user.last_seen_at = Date.now();
    this.scheduleSave();
    return { user, link, rawToken, recoveryCode: nextRecoveryCode };
  }

  claimInitialOwner(userId: string): boolean {
    if (this.ownerBootstrapCompleted) return false;
    if (Array.from(this.users.values()).some((user) => user.role === 'owner')) {
      this.ownerBootstrapCompleted = true;
      this.scheduleSave();
      return false;
    }

    const user = this.users.get(userId);
    if (!user) return false;

    user.role = 'owner';
    this.ownerBootstrapCompleted = true;
    this.scheduleSave();
    return true;
  }

  async claimReplacementOwner(userId: string): Promise<boolean> {
    if (this.ownerRecoveryCompleted) return false;
    if (!Array.from(this.users.values()).some((user) => user.role === 'owner')) {
      return false;
    }

    const user = this.users.get(userId);
    if (!user || user.role !== 'user') return false;

    user.role = 'owner';
    this.ownerRecoveryCompleted = true;
    try {
      await this.flushNow();
    } catch (error) {
      user.role = 'user';
      this.ownerRecoveryCompleted = false;
      throw error;
    }
    return true;
  }

  getLinkForUser(userId: string): ServerPersonalLink | undefined {
    for (const l of this.personalLinks.values()) {
      if (l.user_id === userId) return l;
    }
    return undefined;
  }

  getLinkBySlug(slug: string): ServerPersonalLink | undefined {
    const linkId = this.slugIndex.get(slug.trim().toLowerCase());
    if (!linkId) return undefined;
    return this.personalLinks.get(linkId);
  }

  toPublicUser(u: ServerUserRecord, isOnline: boolean): PublicUserDTO {
    return {
      id: u.id,
      nickname: u.nickname,
      avatar_url: u.avatar_url,
      frame_id: u.frame_id,
      interests: u.interests,
      languages: u.languages,
      country: u.country,
      embedding_vector: u.embedding_vector,
      is_premium: u.is_premium,
      role: u.role,
      status: u.status,
      is_online: isOnline,
      bio: u.bio,
    };
  }

  deleteAccountCompletely(userId: string): string[] {
    const user = this.users.get(userId);
    const affectedPeerIds = new Set<string>();
    if (!user) return [];

    this.tokenIndex.delete(user.auth_token_hash);
    this.users.delete(userId);

    for (const [linkId, l] of this.personalLinks.entries()) {
      if (l.user_id === userId) {
        this.slugIndex.delete(l.slug.toLowerCase());
        this.personalLinks.delete(linkId);
      }
    }

    const deletedRoomIds = new Set<string>();
    for (const [roomId, r] of this.chatRooms.entries()) {
      if (r.participant_a === userId || r.participant_b === userId) {
        const other = r.participant_a === userId ? r.participant_b : r.participant_a;
        affectedPeerIds.add(other);
        deletedRoomIds.add(roomId);
        this.chatRooms.delete(roomId);
      }
    }

    for (const [msgId, m] of this.messages.entries()) {
      if (deletedRoomIds.has(m.room_id) || m.sender_id === userId) {
        this.messages.delete(msgId);
      }
    }

    for (const [ventId, v] of this.publicVents.entries()) {
      if (v.author_id === userId) {
        this.publicVents.delete(ventId);
      }
    }

    this.scheduleSave();
    return Array.from(affectedPeerIds);
  }

  getAdSettings(): ServerAdSettings {
    return { ...this.adSettings };
  }

  updateAdSettings(partial: Partial<ServerAdSettings>): ServerAdSettings {
    this.adSettings = { ...this.adSettings, ...partial, rewarded_enabled: false };
    this.scheduleSave();
    return { ...this.adSettings };
  }
}

export const serverDB = new FadfadahServerDB();
