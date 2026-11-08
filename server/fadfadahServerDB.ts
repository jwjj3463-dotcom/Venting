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
const CALL_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

export type UserRole = 'owner' | 'moderator' | 'user';
export type AccountStatus = 'active' | 'warned' | 'restricted' | 'suspended' | 'banned';
export const OWNER_MIN_POINTS = 1_000_000;

export type ChatRoomType = 'LINK_BASED' | 'RANDOM';
export type ChatRoomStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';
export type GroupRoomCategory = 'PUBLIC' | 'PRIVATE' | 'HOSTED';
export type MessageStatus = 'SENT' | 'READ';
export type MediaType = 'text' | 'image' | 'sticker' | 'audio' | 'video';
export type PremiumPlan = 'free' | 'weekly' | 'monthly' | 'quarterly';

export type ReportStatus = 'PENDING' | 'UNDER_REVIEW' | 'ACTION_TAKEN' | 'DISMISSED';
export type ReportTargetType = 'user' | 'message' | 'vent';
export type ModerationActionType =
  | 'WARN'
  | 'RESTRICT'
  | 'SUSPEND'
  | 'BAN'
  | 'UNBAN'
  | 'BAN_APPEAL_ACCEPT'
  | 'BAN_APPEAL_REJECT'
  | 'RESOLVE_REPORT'
  | 'DISMISS_REPORT';

export type PaymentTransactionType =
  | 'SUBSCRIPTION'
  | 'POINTS_PACK'
  | 'MANUAL_TOPUP'
  | 'ADMIN_CREDIT'
  | 'FRAME_PURCHASE'
  | 'QUOTA_UNLOCK';
export type PaymentStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type ManualTopupStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type ManualPaymentRequestType = 'TOPUP' | 'SUBSCRIPTION';

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
  request_type?: ManualPaymentRequestType;
  premium_plan?: Exclude<PremiumPlan, 'free'>;
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
  auth_username?: string;
  password_hash?: string;
  nickname: string;
  avatar_url: string;
  frame_id: number;
  interests: string[];
  languages: string[];
  country: string;
  embedding_vector: number[];
  is_premium: boolean;
  premium_plan: PremiumPlan;
  premium_expires_at?: number;
  points: number;
  unlocked_frames: number[];
  blocked_user_ids: string[];
  daily_random_count: number;
  last_random_date: string;
  bio: string;
  age?: number;
  gender?: 'female' | 'male' | 'other';
  role: UserRole;
  status: AccountStatus;
  accepted_message_count?: number;
  is_trusted_member?: boolean;
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
  premium_plan: PremiumPlan;
  premium_expires_at?: number;
  role: UserRole;
  status: AccountStatus;
  is_online: boolean;
  is_trusted_member: boolean;
  bio: string;
  age?: number;
  gender?: 'female' | 'male' | 'other';
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

export interface ServerGroupRoom {
  id: string;
  name_ar: string;
  name_en: string;
  description_ar: string;
  description_en: string;
  category: GroupRoomCategory;
  invite_code?: string;
  created_by: string;
  host_id: string;
  member_ids: string[];
  password_salt?: string;
  password_hash?: string;
  created_at: number;
  updated_at: number;
  is_active: boolean;
}

export interface ServerGroupMessage {
  id: string;
  room_id: string;
  sender_id: string;
  content: string;
  mentioned_user_ids?: string[];
  created_at: number;
  is_frozen: boolean;
  ai_flag_score: number;
  ai_flag_reason: string;
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

export interface ServerBanAppeal {
  id: string;
  user_id: string;
  user_nickname: string;
  ban_reason: string;
  message: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
  reviewed_by_name?: string;
  review_note?: string;
}

export interface ServerCallLog {
  id: string;
  room_id: string;
  caller_id: string;
  callee_id: string;
  call_type: 'audio' | 'video';
  started_at: number;
  ended_at?: number;
  duration_seconds?: number;
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
  interstitial_enabled: boolean;
  rewarded_enabled: boolean;
  test_mode: boolean;
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
  interstitial_enabled: true,
  rewarded_enabled: false,
  test_mode: true,
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
  users: ServerUserRecord[];
  personal_links: ServerPersonalLink[];
  chat_rooms: ServerChatRoom[];
  group_rooms?: ServerGroupRoom[];
  group_messages?: ServerGroupMessage[];
  messages: ServerMessage[];
  public_vents: ServerPublicVent[];
  reports_moderation: ServerReportModeration[];
  moderation_actions?: ServerModerationAction[];
  ban_appeals?: ServerBanAppeal[];
  call_logs?: ServerCallLog[];
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

export function normalizeAuthUsername(username: string): string {
  return username.normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

function verifyPassword(password: string, storedHash: string): boolean {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!/^[a-f0-9]{32}$/.test(saltHex || '') || !/^[a-f0-9]{128}$/.test(hashHex || '')) {
    return false;
  }
  const salt = Buffer.from(saltHex, 'hex');
  const expectedHash = Buffer.from(hashHex, 'hex');
  const suppliedHash = crypto.scryptSync(password, salt, expectedHash.length);
  return crypto.timingSafeEqual(expectedHash, suppliedHash);
}

export class FadfadahServerDB {
  public users = new Map<string, ServerUserRecord>();
  public tokenIndex = new Map<string, string>(); // tokenHash -> userId
  public usernameIndex = new Map<string, string>(); // normalized username -> userId
  public personalLinks = new Map<string, ServerPersonalLink>(); // linkId -> link
  public slugIndex = new Map<string, string>(); // slug -> linkId
  public chatRooms = new Map<string, ServerChatRoom>();
  public groupRooms = new Map<string, ServerGroupRoom>();
  public groupMessages = new Map<string, ServerGroupMessage>();
  public messages = new Map<string, ServerMessage>();
  public publicVents = new Map<string, ServerPublicVent>();
  public reports = new Map<string, ServerReportModeration>();
  public moderationActions = new Map<string, ServerModerationAction>();
  public banAppeals = new Map<string, ServerBanAppeal>();
  public callLogs = new Map<string, ServerCallLog>();
  public paymentTransactions = new Map<string, ServerPaymentTransaction>();
  public manualTopupRequests = new Map<string, ServerManualTopupRequest>();
  public manualTopupPackages: ServerManualTopupPackage[] = [];
  public manualPaymentMethods: ServerManualPaymentMethod[] = [];
  public idempotencyKeys = new Set<string>();
  public adSettings: ServerAdSettings = { ...DEFAULT_AD_SETTINGS };
  public ownerBootstrapCompleted = false;
  public ownerRecoveryCompleted = false;

  private flushPromise: Promise<void> = Promise.resolve();
  private flushScheduled = false;

  async init(): Promise<void> {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      let ownerPointsChanged = false;
      let expiredCallLogsRemoved = false;
      let acceptedMessageCountsChanged = false;
      try {
        const raw = await fsp.readFile(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw) as Partial<PersistedDatabaseShape>;
        for (const u of parsed.users ?? []) {
          // Backward compatibility defaults
          if (!u.role) u.role = 'user';
          if (!u.status) u.status = 'active';
          if (
            u.role === 'owner' &&
            (!Number.isFinite(u.points) || u.points < OWNER_MIN_POINTS)
          ) {
            u.points = OWNER_MIN_POINTS;
            ownerPointsChanged = true;
          }
          this.users.set(u.id, u);
          this.tokenIndex.set(u.auth_token_hash, u.id);
          if (u.auth_username) {
            this.usernameIndex.set(normalizeAuthUsername(u.auth_username), u.id);
          }
        }
        for (const l of parsed.personal_links ?? []) {
          this.personalLinks.set(l.id, l);
          this.slugIndex.set(l.slug.toLowerCase(), l.id);
        }
        for (const r of parsed.chat_rooms ?? []) {
          this.chatRooms.set(r.id, r);
        }
        for (const r of parsed.group_rooms ?? []) {
          this.groupRooms.set(r.id, r);
        }
        for (const m of parsed.group_messages ?? []) {
          this.groupMessages.set(m.id, m);
        }
        for (const m of parsed.messages ?? []) {
          this.messages.set(m.id, m);
        }
        const acceptedMessageCounts = new Map<string, number>();
        for (const message of this.messages.values()) {
          if (!message.is_frozen) {
            acceptedMessageCounts.set(
              message.sender_id,
              (acceptedMessageCounts.get(message.sender_id) ?? 0) + 1
            );
          }
        }
        for (const message of this.groupMessages.values()) {
          if (!message.is_frozen) {
            acceptedMessageCounts.set(
              message.sender_id,
              (acceptedMessageCounts.get(message.sender_id) ?? 0) + 1
            );
          }
        }
        for (const user of this.users.values()) {
          if (!Number.isSafeInteger(user.accepted_message_count) || user.accepted_message_count! < 0) {
            user.accepted_message_count = acceptedMessageCounts.get(user.id) ?? 0;
            acceptedMessageCountsChanged = true;
          }
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
        for (const appeal of parsed.ban_appeals ?? []) {
          this.banAppeals.set(appeal.id, appeal);
        }
        for (const call of parsed.call_logs ?? []) {
          if (call.started_at >= Date.now() - CALL_LOG_RETENTION_MS) {
            this.callLogs.set(call.id, call);
          } else {
            expiredCallLogsRemoved = true;
          }
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
        if (parsed.ad_settings) {
          this.adSettings = { ...DEFAULT_AD_SETTINGS, ...parsed.ad_settings };
        }
      } catch (err) {
        console.error('Failed to read existing fadfadah.db.json, starting fresh:', err);
      }
      if (ownerPointsChanged || expiredCallLogsRemoved || acceptedMessageCountsChanged) {
        await this.flushNow();
      }
    } else {
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

  pruneExpiredCallLogs(now = Date.now()): boolean {
    let removed = false;
    for (const [id, call] of this.callLogs) {
      if (call.started_at < now - CALL_LOG_RETENTION_MS) {
        this.callLogs.delete(id);
        removed = true;
      }
    }
    return removed;
  }

  async flushNow(): Promise<void> {
    const snapshot: PersistedDatabaseShape = {
      schemaVersion: 396,
      users: Array.from(this.users.values()),
      personal_links: Array.from(this.personalLinks.values()),
      chat_rooms: Array.from(this.chatRooms.values()),
      group_rooms: Array.from(this.groupRooms.values()),
      group_messages: Array.from(this.groupMessages.values()),
      messages: Array.from(this.messages.values()),
      public_vents: Array.from(this.publicVents.values()),
      reports_moderation: Array.from(this.reports.values()),
      moderation_actions: Array.from(this.moderationActions.values()),
      ban_appeals: Array.from(this.banAppeals.values()),
      call_logs: Array.from(this.callLogs.values()).filter(
        (call) => call.started_at >= Date.now() - CALL_LOG_RETENTION_MS
      ),
      payment_transactions: Array.from(this.paymentTransactions.values()),
      manual_topup_requests: Array.from(this.manualTopupRequests.values()),
      manual_topup_packages: this.manualTopupPackages,
      manual_payment_methods: this.manualPaymentMethods,
      owner_bootstrap_completed: this.ownerBootstrapCompleted,
      owner_recovery_completed: this.ownerRecoveryCompleted,
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
    if (user) this.isPremiumActive(user);
    if (user && user.status === 'suspended' && user.suspension_until && user.suspension_until <= Date.now()) {
      // Auto-lift expired suspension
      user.status = 'active';
      user.suspension_until = undefined;
      this.scheduleSave();
    }

    return user;
  }

  isPremiumActive(user: ServerUserRecord): boolean {
    if (!user.is_premium) return false;
    if (user.premium_expires_at === undefined || user.premium_expires_at > Date.now()) {
      return true;
    }
    user.is_premium = false;
    user.premium_plan = 'free';
    user.premium_expires_at = undefined;
    this.scheduleSave();
    return false;
  }

  isTrustedMember(user: ServerUserRecord, now = Date.now()): boolean {
    const trusted =
      user.status === 'active' &&
      now - user.created_at >= 24 * 60 * 60 * 1000 &&
      (user.accepted_message_count ?? 0) >= 10;
    user.is_trusted_member = trusted;
    return trusted;
  }

  recordAcceptedMessage(userId: string): void {
    const user = this.users.get(userId);
    if (!user) return;
    user.accepted_message_count = (user.accepted_message_count ?? 0) + 1;
    this.isTrustedMember(user);
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
    password?: string;
    country?: string;
    languages?: string[];
    interests?: string[];
    age?: number;
    gender?: 'female' | 'male' | 'other';
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
      ...(params?.password
        ? {
            auth_username: normalizeAuthUsername(nickname),
            password_hash: hashPassword(params.password),
          }
        : {}),
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
      age: params?.age,
      gender: params?.gender,
      role: 'user',
      status: 'active',
      accepted_message_count: 0,
      is_trusted_member: false,
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
    if (user.auth_username) this.usernameIndex.set(user.auth_username, user.id);
    this.personalLinks.set(link.id, link);
    this.slugIndex.set(slug, link.id);
    this.scheduleSave();

    return { user, link, rawToken, recoveryCode };
  }

  isUsernameTaken(username: string, exceptUserId?: string): boolean {
    const normalized = normalizeAuthUsername(username);
    return Array.from(this.users.values()).some(
      (user) =>
        user.id !== exceptUserId && normalizeAuthUsername(user.nickname) === normalized
    );
  }

  loginWithPassword(username: string, password: string): {
    user: ServerUserRecord;
    link: ServerPersonalLink;
    rawToken: string;
  } | null {
    const userId = this.usernameIndex.get(normalizeAuthUsername(username));
    const user = userId ? this.users.get(userId) : undefined;
    if (!user?.password_hash || !verifyPassword(password, user.password_hash)) return null;

    const link = this.getLinkForUser(user.id);
    if (!link) return null;

    const rawToken = generateRawToken();
    this.tokenIndex.delete(user.auth_token_hash);
    user.auth_token_hash = hashAuthToken(rawToken);
    this.tokenIndex.set(user.auth_token_hash, user.id);
    user.last_seen_at = Date.now();
    this.scheduleSave();
    return { user, link, rawToken };
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
    if (!Number.isFinite(user.points) || user.points < OWNER_MIN_POINTS) {
      user.points = OWNER_MIN_POINTS;
    }
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
    const previousPoints = user.points;
    if (!Number.isFinite(user.points) || user.points < OWNER_MIN_POINTS) {
      user.points = OWNER_MIN_POINTS;
    }
    this.ownerRecoveryCompleted = true;
    try {
      await this.flushNow();
    } catch (error) {
      user.role = 'user';
      user.points = previousPoints;
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
      is_premium: this.isPremiumActive(u),
      premium_plan: u.premium_plan,
      premium_expires_at: u.premium_expires_at,
      role: u.role,
      status: u.status,
      is_online: isOnline,
      is_trusted_member: this.isTrustedMember(u),
      bio: u.bio,
      age: u.age,
      gender: u.gender,
    };
  }

  deleteAccountCompletely(userId: string): string[] {
    const user = this.users.get(userId);
    const affectedPeerIds = new Set<string>();
    if (!user) return [];

    this.tokenIndex.delete(user.auth_token_hash);
    if (user.auth_username) this.usernameIndex.delete(normalizeAuthUsername(user.auth_username));
    this.users.delete(userId);
    for (const [appealId, appeal] of this.banAppeals.entries()) {
      if (appeal.user_id === userId) this.banAppeals.delete(appealId);
    }

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

    for (const room of this.groupRooms.values()) {
      if (!room.member_ids.includes(userId)) continue;
      room.member_ids = room.member_ids.filter((memberId) => memberId !== userId);
      if (room.host_id === userId) room.host_id = room.member_ids[0] || room.created_by;
      if (room.member_ids.length === 0) room.is_active = false;
      room.updated_at = Date.now();
    }
    for (const [messageId, message] of this.groupMessages.entries()) {
      if (message.sender_id === userId) this.groupMessages.delete(messageId);
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
