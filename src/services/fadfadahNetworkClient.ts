import {
  generateUUID,
  PremiumPlan,
  realmDB,
  RealmChatRoom,
  RealmMessage,
  RealmPersonalLink,
  RealmPublicVent,
  RealmUser,
  RealmReportModeration,
  RealmPaymentTransaction,
  MediaType,
  ReportTargetType,
} from '../db/realmLocalDB';
import { isRunningInsideNativeAndroid, triggerLightHaptic } from './androidNative';
import type { AppLang } from '../i18n/translations';

export interface LiveMatchCandidate {
  peer: RealmUser;
  inQueue: boolean;
  similarityScore: number;
}

export interface AdminStatsDTO {
  totalUsers: number;
  onlineUsers: number;
  activeChatRooms: number;
  totalMessages: number;
  totalVents: number;
  pendingReports: number;
  resolvedReports: number;
  totalReports: number;
  bannedUsers: number;
  suspendedUsers: number;
  restrictedUsers: number;
  premiumUsers: number;
  totalRevenueUsd: number;
  totalTransactions: number;
}

export interface ManualTopupPackageDTO {
  id: string;
  title_ar: string;
  title_en: string;
  points: number;
  amount: number;
  currency: string;
  enabled: boolean;
}

export interface ManualPaymentMethodDTO {
  id: string;
  title_ar: string;
  title_en: string;
  instructions_ar: string;
  instructions_en: string;
  enabled: boolean;
}

export interface ManualVipPlanDTO {
  id: string;
  title_ar: string;
  title_en: string;
  points: number;
  amount: number;
  currency: string;
  duration_days: number;
  enabled: boolean;
}

export interface ManualTopupRequestDTO {
  id: string;
  request_type: 'TOPUP' | 'SUBSCRIPTION';
  premium_plan?: Exclude<PremiumPlan, 'free'>;
  premium_duration_days?: number;
  user_id: string;
  user_nickname: string;
  package_title_ar: string;
  package_title_en: string;
  points: number;
  amount: number;
  currency: string;
  payment_method_title_ar: string;
  payment_method_title_en: string;
  transaction_reference: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  rejection_reason?: string;
  created_at: number;
  reviewed_at?: number;
  reviewed_by?: string;
  has_proof: boolean;
}

export interface ManualTopupConfigDTO {
  packages: ManualTopupPackageDTO[];
  vip_plans: ManualVipPlanDTO[];
  payment_methods: ManualPaymentMethodDTO[];
  updated_at?: number;
}

export interface InterestRequestDTO {
  id: string;
  direction: 'INCOMING' | 'OUTGOING';
  sender_id?: string;
  sender_nickname: string;
  sender_avatar_url: string;
  sender_frame_id: number;
  sender_age?: number;
  sender_bio: string;
  sender_interests: string[];
  intro_text: string;
  is_anonymous: boolean;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'IGNORED' | 'CANCELLED';
  created_at: number;
  updated_at: number;
  accepted_room_id?: string;
}

export interface DiscoveryCandidateDTO {
  peer: Pick<
    RealmUser,
    | 'id'
    | 'nickname'
    | 'avatar_url'
    | 'frame_id'
    | 'bio'
    | 'interests'
    | 'languages'
    | 'country'
    | 'is_online'
    | 'is_premium'
    | 'role'
  > & { age: number };
  commonInterests: string[];
  score: number;
}

export interface CompanionBotDTO {
  id: string;
  name_ar: string;
  name_en: string;
  style_ar: string;
  style_en: string;
  is_ai: true;
}

export interface CompanionBotTurnDTO {
  id: string;
  role: 'USER' | 'BOT';
  content: string;
  created_at: number;
}

export interface CompanionBotConversationDTO {
  id: string;
  user_id: string;
  bot_id: string;
  turns: CompanionBotTurnDTO[];
  updated_at: number;
}

export interface CompanionBotsResponseDTO {
  bots: CompanionBotDTO[];
  conversations: CompanionBotConversationDTO[];
  disclosure: string;
}

type ConnectionState = 'connecting' | 'connected' | 'offline';
type WalletNotice = {
  status: 'APPROVED' | 'REJECTED';
  requestType: 'TOPUP' | 'SUBSCRIPTION';
  points: number;
  premiumPlan?: Exclude<PremiumPlan, 'free'>;
  reason: string;
};
export interface InterestNotice {
  kind: 'REQUEST' | 'ACCEPTED' | 'DECISION';
  nickname?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

class FadfadahNetworkClient {
  private ws: WebSocket | null = null;
  private reconnectTimer: number | null = null;
  private connectionState: ConnectionState = 'connecting';
  private onlineCount = 1;
  private queueSize = 0;
  private matchCandidates: LiveMatchCandidate[] = [];
  private matchError: string | null = null;
  private matchQueuePreferences: { countryFilter: string; langFilter: string } | null = null;
  private typingUsersByRoom = new Map<string, boolean>();
  private stateListeners = new Set<() => void>();
  private manualClose = false;
  private latestWalletNotice: WalletNotice | null = null;
  private latestInterestNotice: InterestNotice | null = null;
  private latestSafeChatScreenshot: { roomId: string; nickname: string; createdAt: number } | null = null;
  private walletConfigListeners = new Set<() => void>();
  private manualTopupListeners = new Set<() => void>();
  private interestRequestListeners = new Set<() => void>();

  getServerBaseUrl(): string {
    const customUrl = realmDB.getSettings().custom_server_url?.trim();
    if (customUrl) {
      return customUrl.replace(/\/+$/, '');
    }
    const envUrl = (import.meta.env.VITE_API_SERVER_URL as string | undefined)?.trim();
    if (envUrl) {
      return envUrl.replace(/\/+$/, '');
    }
    if (isRunningInsideNativeAndroid()) {
      return 'http://10.0.2.2:3000';
    }
    return window.location.origin;
  }

  getShareBaseUrl(): string {
    return this.getServerBaseUrl();
  }

  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  takeWalletNotice(): WalletNotice | null {
    const notice = this.latestWalletNotice;
    this.latestWalletNotice = null;
    return notice;
  }

  takeInterestNotice(): InterestNotice | null {
    const notice = this.latestInterestNotice;
    this.latestInterestNotice = null;
    return notice;
  }

  getSafeChatScreenshotNotice(roomId: string): { nickname: string; createdAt: number } | null {
    const notice = this.latestSafeChatScreenshot;
    return notice?.roomId === roomId
      ? { nickname: notice.nickname, createdAt: notice.createdAt }
      : null;
  }

  getOnlineStats(): { onlineCount: number; queueSize: number } {
    return { onlineCount: this.onlineCount, queueSize: this.queueSize };
  }

  getMatchCandidates(): LiveMatchCandidate[] {
    return this.matchCandidates;
  }

  getMatchError(): string | null {
    return this.matchError;
  }

  isPeerTypingInRoom(roomId: string): boolean {
    return Boolean(this.typingUsersByRoom.get(roomId));
  }

  subscribe(cb: () => void): () => void {
    this.stateListeners.add(cb);
    return () => {
      this.stateListeners.delete(cb);
    };
  }

  subscribeManualTopupConfigUpdates(cb: () => void): () => void {
    this.walletConfigListeners.add(cb);
    return () => this.walletConfigListeners.delete(cb);
  }

  subscribeManualTopupUpdates(cb: () => void): () => void {
    this.manualTopupListeners.add(cb);
    return () => this.manualTopupListeners.delete(cb);
  }

  subscribeInterestRequestUpdates(cb: () => void): () => void {
    this.interestRequestListeners.add(cb);
    return () => this.interestRequestListeners.delete(cb);
  }

  private notifyInterestRequestListeners(): void {
    for (const listener of this.interestRequestListeners) listener();
  }

  private notifyManualTopupListeners(): void {
    for (const listener of this.manualTopupListeners) listener();
  }

  private emitState(): void {
    for (const cb of this.stateListeners) {
      cb();
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const token = realmDB.getSettings().auth_token;
    return token
      ? {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        }
      : { 'Content-Type': 'application/json' };
  }

  async bootstrapSessionAndSync(): Promise<boolean> {
    await realmDB.open();
    const settings = realmDB.getSettings();

    try {
      if (!settings.auth_token) {
        this.connectionState = 'offline';
        this.emitState();
        return false;
      }
      const synced = await this.pullFullSync();
      if (!synced) {
        this.connectionState = 'offline';
        this.emitState();
        return false;
      }
      if (!realmDB.findSelfUser() || !realmDB.findPersonalLink()) {
        throw new Error('اكتملت المزامنة دون بيانات الحساب أو رابطه الشخصي.');
      }

      this.connectWebSocket();
      return true;
    } catch (error) {
      this.connectionState = 'offline';
      this.emitState();
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  private async fetchBootstrap(
    url: string,
    init: RequestInit,
    endpoint: string
  ): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 15000);
    try {
      return await fetch(url, { ...init, signal: controller.signal });
    } catch (error) {
      const reason =
        error instanceof Error && error.name === 'AbortError'
          ? 'انتهت مهلة الاتصال.'
          : error instanceof Error
            ? error.message
            : String(error);
      throw new Error(`${endpoint}: ${reason}`);
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  private async readBootstrapResponse<T>(res: Response, endpoint: string): Promise<T> {
    if (!res.ok) {
      let detail = '';
      try {
        const body: unknown = await res.json();
        if (isRecord(body) && typeof body.error === 'string') {
          detail = `: ${body.error}`;
        }
      } catch {
        // The HTTP status remains useful when the server does not return JSON.
      }
      throw new Error(`${endpoint} (HTTP ${res.status})${detail}`);
    }

    try {
      return (await res.json()) as T;
    } catch {
      throw new Error(`${endpoint}: استجابة JSON غير صالحة.`);
    }
  }

  async createFreshDeviceAccount(): Promise<string> {
    const base = this.getServerBaseUrl();
    const res = await this.fetchBootstrap(
      `${base}/api/auth/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      },
      'تعذر تسجيل الحساب'
    );
    const data: unknown = await this.readBootstrapResponse<unknown>(
      res,
      'تعذر تسجيل الحساب'
    );
    if (
      !isRecord(data) ||
      typeof data.authToken !== 'string' ||
      !data.authToken ||
      typeof data.recoveryCode !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.recoveryCode) ||
      !isRecord(data.selfUser) ||
      typeof data.selfUser.id !== 'string' ||
      !isRecord(data.personalLink) ||
      typeof data.personalLink.id !== 'string' ||
      data.personalLink.user_id !== data.selfUser.id
    ) {
      throw new Error('تعذر تسجيل الحساب: بيانات الاستجابة غير مكتملة.');
    }

    const registration = data as {
      authToken: string;
      recoveryCode: string;
      selfUser: RealmUser;
      personalLink: RealmPersonalLink;
    };

    const currentSettings = realmDB.getSettings();
    await realmDB.write((tx) => {
      tx.create('app_settings', {
        ...currentSettings,
        auth_token: registration.authToken,
        pending_recovery_code: registration.recoveryCode,
      });
      tx.create('users', { ...registration.selfUser, is_self: true });
      tx.create('personal_links', registration.personalLink);
    });
    if (!(await this.pullFullSync())) {
      throw new Error('تعذر مزامنة الحساب الجديد بعد إنشائه.');
    }
    this.connectWebSocket();
    return registration.recoveryCode;
  }

  async recoverAccount(recoveryCode: string): Promise<string> {
    const base = this.getServerBaseUrl();
    const res = await this.fetchBootstrap(
      `${base}/api/auth/recover`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recoveryCode: recoveryCode.trim().toLowerCase() }),
      },
      'تعذر استعادة الحساب'
    );
    const data: unknown = await this.readBootstrapResponse<unknown>(
      res,
      'تعذر استعادة الحساب'
    );
    if (
      !isRecord(data) ||
      typeof data.authToken !== 'string' ||
      !data.authToken ||
      typeof data.recoveryCode !== 'string' ||
      !/^[a-f0-9]{64}$/.test(data.recoveryCode) ||
      !isRecord(data.selfUser) ||
      typeof data.selfUser.id !== 'string' ||
      !isRecord(data.personalLink) ||
      typeof data.personalLink.id !== 'string' ||
      data.personalLink.user_id !== data.selfUser.id
    ) {
      throw new Error('تعذر استعادة الحساب: بيانات الاستجابة غير مكتملة.');
    }

    const currentSettings = realmDB.getSettings();
    await realmDB.write((tx) => {
      tx.create('app_settings', {
        ...currentSettings,
        auth_token: data.authToken as string,
        pending_recovery_code: data.recoveryCode as string,
      });
    });

    if (!(await this.pullFullSync())) {
      throw new Error('تم استرداد بيانات الدخول لكن تعذرت مزامنة الحساب.');
    }
    if (!realmDB.findSelfUser() || !realmDB.findPersonalLink()) {
      throw new Error('اكتملت الاستعادة دون بيانات الحساب أو رابطه الشخصي.');
    }
    this.connectWebSocket();
    return data.recoveryCode;
  }

  async loginWithFirebase(idToken: string): Promise<void> {
    const res = await this.fetchBootstrap(
      `${this.getServerBaseUrl()}/api/auth/firebase/session`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
      'تعذر تسجيل الدخول بحساب Firebase'
    );
    const response: unknown = await this.readBootstrapResponse<unknown>(
      res,
      'تعذر تسجيل الدخول بحساب Firebase'
    );
    await this.acceptFirebaseSession(response, false);
  }

  async registerWithFirebase(idToken: string): Promise<string> {
    const res = await this.fetchBootstrap(
      `${this.getServerBaseUrl()}/api/auth/firebase/register`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      },
      'تعذر إنشاء حساب فضفضة'
    );
    const response: unknown = await this.readBootstrapResponse<unknown>(
      res,
      'تعذر إنشاء حساب فضفضة'
    );
    return this.acceptFirebaseSession(response, true);
  }

  async linkFirebaseIdentity(idToken: string): Promise<void> {
    const res = await this.fetchBootstrap(
      `${this.getServerBaseUrl()}/api/auth/firebase/link`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ idToken }),
      },
      'تعذر ربط الحساب'
    );
    const response: unknown = await this.readBootstrapResponse<unknown>(res, 'تعذر ربط الحساب');
    if (!isRecord(response) || response.ok !== true) {
      throw new Error('تعذر ربط الحساب: استجابة الخادم غير مكتملة.');
    }
  }

  private async acceptFirebaseSession(
    response: unknown,
    requireRecoveryCode: boolean
  ): Promise<string> {
    if (
      !isRecord(response) ||
      typeof response.authToken !== 'string' ||
      !response.authToken ||
      !isRecord(response.selfUser) ||
      typeof response.selfUser.id !== 'string' ||
      !isRecord(response.personalLink) ||
      typeof response.personalLink.id !== 'string' ||
      response.personalLink.user_id !== response.selfUser.id ||
      (response.recoveryCode !== undefined &&
        (typeof response.recoveryCode !== 'string' ||
          !/^[a-f0-9]{64}$/.test(response.recoveryCode))) ||
      (requireRecoveryCode &&
        (typeof response.recoveryCode !== 'string' ||
          !/^[a-f0-9]{64}$/.test(response.recoveryCode)))
    ) {
      throw new Error('تعذر تسجيل الدخول: بيانات استجابة الحساب غير مكتملة.');
    }

    const recoveryCode =
      typeof response.recoveryCode === 'string' ? response.recoveryCode : '';
    const currentSettings = realmDB.getSettings();
    await realmDB.write((tx) => {
      tx.create('app_settings', {
        ...currentSettings,
        auth_token: response.authToken as string,
        ...(recoveryCode ? { pending_recovery_code: recoveryCode } : {}),
      });
    });

    if (!(await this.pullFullSync())) {
      throw new Error('تم تسجيل الدخول لكن تعذرت مزامنة بيانات الحساب.');
    }
    if (!realmDB.findSelfUser() || !realmDB.findPersonalLink()) {
      throw new Error('اكتملت المزامنة دون بيانات الحساب أو رابطه الشخصي.');
    }
    this.connectWebSocket();
    return recoveryCode;
  }

  async claimReplacementOwner(recoveryToken: string): Promise<void> {
    const base = this.getServerBaseUrl();
    const res = await this.fetchBootstrap(
      `${base}/api/admin/owner-recovery`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ recoveryToken: recoveryToken.trim() }),
      },
      'تعذر تفعيل حساب المالك'
    );
    const data: unknown = await this.readBootstrapResponse<unknown>(
      res,
      'تعذر تفعيل حساب المالك'
    );
    if (
      !isRecord(data) ||
      data.ok !== true ||
      data.role !== 'owner' ||
      !isRecord(data.selfUser) ||
      typeof data.selfUser.id !== 'string' ||
      data.selfUser.id !== realmDB.findSelfUser()?.id
    ) {
      throw new Error('تعذر تفعيل حساب المالك: استجابة الخادم غير مكتملة.');
    }

    if (!(await this.pullFullSync()) || realmDB.findSelfUser()?.role !== 'owner') {
      throw new Error('تم تفعيل الصلاحية لكن تعذرت مزامنة الحساب.');
    }
  }

  async dismissPendingRecoveryCode(): Promise<void> {
    const settings = realmDB.getSettings();
    await realmDB.write((tx) => {
      tx.create('app_settings', { ...settings, pending_recovery_code: '' });
    });
  }

  async pullFullSync(): Promise<boolean> {
    const base = this.getServerBaseUrl();
    const res = await this.fetchBootstrap(
      `${base}/api/sync`,
      {
        method: 'GET',
        headers: this.getAuthHeaders(),
      },
      'تعذرت مزامنة البيانات'
    );
    if (res.status === 401) {
      return false;
    }
    const data: unknown = await this.readBootstrapResponse<unknown>(
      res,
      'تعذرت مزامنة البيانات'
    );
    if (
      !isRecord(data) ||
      !isRecord(data.selfUser) ||
      typeof data.selfUser.id !== 'string' ||
      !isRecord(data.personalLink) ||
      typeof data.personalLink.id !== 'string' ||
      data.personalLink.user_id !== data.selfUser.id ||
      !Array.isArray(data.rooms) ||
      !Array.isArray(data.messages) ||
      !Array.isArray(data.peers) ||
      !Array.isArray(data.vents) ||
      (data.payments !== undefined && !Array.isArray(data.payments))
    ) {
      throw new Error('تعذرت مزامنة البيانات: استجابة الخادم غير مكتملة.');
    }

    const syncData = data as {
      selfUser: RealmUser;
      personalLink: RealmPersonalLink;
      rooms: RealmChatRoom[];
      messages: RealmMessage[];
      peers: Array<Omit<RealmUser, 'is_self'>>;
      vents: RealmPublicVent[];
      payments?: RealmPaymentTransaction[];
    };

    await realmDB.write((tx) => {
      // Reconcile users
      for (const existingU of realmDB.objects('users')) {
        tx.delete('users', existingU.id);
      }
      tx.create('users', { ...syncData.selfUser, is_self: true });
      for (const p of syncData.peers) {
        tx.create('users', {
          ...p,
          premium_plan: p.premium_plan ?? (p.is_premium ? 'monthly' : 'free'),
          points: 0,
          unlocked_frames: [0, 1],
          blocked_user_ids: [],
          daily_random_count: 0,
          last_random_date: '',
          role: p.role || 'user',
          status: p.status || 'active',
          is_self: false,
        });
      }

      tx.create('personal_links', syncData.personalLink);

      // Reconcile rooms
      for (const existingR of realmDB.objects('chat_rooms')) {
        tx.delete('chat_rooms', existingR.id);
      }
      for (const r of syncData.rooms) {
        tx.create('chat_rooms', r);
      }

      // Reconcile messages
      for (const existingM of realmDB.objects('messages')) {
        tx.delete('messages', existingM.id);
      }
      for (const m of syncData.messages) {
        tx.create('messages', m);
      }

      // Reconcile public vents
      for (const existingV of realmDB.objects('public_vents')) {
        tx.delete('public_vents', existingV.id);
      }
      for (const v of syncData.vents) {
        tx.create('public_vents', v);
      }

      // Reconcile payments
      if (Array.isArray(syncData.payments)) {
        for (const existingTx of realmDB.objects('payment_transactions')) {
          tx.delete('payment_transactions', existingTx.id);
        }
        for (const ptx of syncData.payments) {
          tx.create('payment_transactions', ptx);
        }
      }
    });

    return true;
  }

  connectWebSocket(): void {
    const token = realmDB.getSettings().auth_token;
    if (!token) return;

    if (this.ws) {
      this.manualClose = true;
      this.ws.close();
      this.ws = null;
    }
    this.manualClose = false;

    const httpBase = this.getServerBaseUrl();
    const wsBase = httpBase.replace(/^http/i, 'ws');
    const wsUrl = `${wsBase}/ws?token=${encodeURIComponent(token)}`;

    this.connectionState = 'connecting';
    this.emitState();

    try {
      const socket = new WebSocket(wsUrl);
      this.ws = socket;

      socket.onopen = () => {
        if (this.reconnectTimer) {
          window.clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.connectionState = 'connected';
        this.emitState();
        if (this.matchQueuePreferences) {
          this.joinMatchmakingQueue(
            this.matchQueuePreferences.countryFilter,
            this.matchQueuePreferences.langFilter
          );
        }
      };

      socket.onmessage = async (event) => {
        try {
          const payload = JSON.parse(String(event.data)) as Record<string, unknown>;
          await this.handleServerSocketEvent(payload);
        } catch {
          // Ignore
        }
      };

      socket.onclose = () => {
        if (this.ws === socket) {
          this.ws = null;
        }
        if (!this.manualClose) {
          this.connectionState = 'offline';
          this.emitState();
          this.scheduleReconnect();
        }
      };

      socket.onerror = () => {
        socket.close();
      };
    } catch {
      this.connectionState = 'offline';
      this.emitState();
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    this.reconnectTimer = window.setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.bootstrapSessionAndSync();
      } catch {
        this.scheduleReconnect();
      }
    }, 3500);
  }

  private async handleServerSocketEvent(ev: Record<string, unknown>): Promise<void> {
    const type = String(ev.type || '');
    const self = realmDB.findSelfUser();

    if (type === 'presence:online_users') {
      const users = (ev.users as Array<RealmUser>) || [];
      this.onlineCount = Math.max(1, users.length);
      const onlineIds = new Set(users.map((u) => u.id));
      await realmDB.write((tx) => {
        for (const existing of realmDB.objects('users')) {
          if (!existing.is_self) {
            tx.create('users', { ...existing, is_online: onlineIds.has(existing.id) });
          }
        }
        for (const u of users) {
          if (self && u.id === self.id) continue;
          const prev = realmDB.objectForPrimaryKey('users', u.id);
          tx.create('users', {
            ...(prev ?? {
              premium_plan: u.is_premium ? 'monthly' : 'free',
              points: 0,
              unlocked_frames: [0, 1],
              blocked_user_ids: [],
              daily_random_count: 0,
              last_random_date: '',
              role: u.role || 'user',
              status: u.status || 'active',
            }),
            ...u,
            is_self: false,
            is_online: true,
          });
        }
      });
      this.emitState();
    } else if (type === 'account:status_updated') {
      // Live moderation status update pushed to target user
      if (self) {
        await realmDB.write((tx) => {
          tx.create('users', {
            ...self,
            status: (ev.status as RealmUser['status']) ?? self.status,
            warning_message: (ev.warning_message as string) ?? undefined,
            restriction_reason: (ev.restriction_reason as string) ?? undefined,
            ban_reason: (ev.ban_reason as string) ?? undefined,
            suspension_until: (ev.suspension_until as number) ?? undefined,
            role: (ev.role as RealmUser['role']) ?? self.role,
            points:
              Number.isSafeInteger(Number(ev.points)) && Number(ev.points) >= 0
                ? Number(ev.points)
                : self.points,
          });
        });
        await triggerLightHaptic();
        this.emitState();
      }
    } else if (type === 'wallet:manual_topup_decision' && self) {
      const status = ev.status === 'APPROVED' ? 'APPROVED' : 'REJECTED';
      const pointsBalance = Number(ev.points_balance);
      const transaction = ev.transaction as RealmPaymentTransaction | undefined;
      const requestType = ev.request_type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'TOPUP';
      const premiumPlan =
        typeof ev.premium_plan === 'string' &&
        /^[a-zA-Z0-9_-]{1,64}$/.test(ev.premium_plan) &&
        ev.premium_plan !== 'free'
          ? ev.premium_plan
          : undefined;
      await realmDB.write((tx) => {
        const updatedSelf = {
          ...self,
          ...(Number.isSafeInteger(pointsBalance) && pointsBalance >= 0
            ? { points: pointsBalance }
            : {}),
        };
        if (requestType === 'SUBSCRIPTION' && status === 'APPROVED' && premiumPlan) {
          tx.create('users', {
            ...updatedSelf,
            is_premium: true,
            premium_plan: premiumPlan,
            premium_expires_at:
              typeof ev.premium_expires_at === 'number' ? ev.premium_expires_at : undefined,
          });
        } else if (Number.isSafeInteger(pointsBalance) && pointsBalance >= 0) {
          tx.create('users', updatedSelf);
        }
        if (transaction) tx.create('payment_transactions', transaction);
      });
      this.latestWalletNotice = {
        status,
        requestType,
        points: Number(ev.points_delta) || 0,
        premiumPlan,
        reason: typeof ev.rejection_reason === 'string' ? ev.rejection_reason : '',
      };
      await triggerLightHaptic();
      this.notifyManualTopupListeners();
      this.emitState();
    } else if (type === 'wallet:admin_credit' && self) {
      const pointsBalance = Number(ev.points_balance);
      const transaction = ev.transaction as RealmPaymentTransaction | undefined;
      await realmDB.write((tx) => {
        if (Number.isSafeInteger(pointsBalance) && pointsBalance >= 0) {
          tx.create('users', { ...self, points: pointsBalance });
        }
        if (transaction) tx.create('payment_transactions', transaction);
      });
      await triggerLightHaptic();
      this.emitState();
    } else if (type === 'wallet:config_updated') {
      for (const listener of this.walletConfigListeners) listener();
      this.emitState();
    } else if (
      type === 'wallet:manual_topup_created' ||
      type === 'wallet:manual_topup_reviewed'
    ) {
      this.notifyManualTopupListeners();
      this.emitState();
    } else if (
      type === 'interest:created' ||
      type === 'interest:updated' ||
      type === 'interest:accepted'
    ) {
      const request = ev.request as InterestRequestDTO | undefined;
      if (type === 'interest:created' && request?.direction === 'INCOMING') {
        this.latestInterestNotice = {
          kind: 'REQUEST',
          nickname: request.is_anonymous ? 'زائر مجهول' : request.sender_nickname,
        };
      } else if (type === 'interest:accepted') {
        this.latestInterestNotice = { kind: 'ACCEPTED' };
      } else if (
        type === 'interest:updated' &&
        request?.direction === 'OUTGOING' &&
        (request.status === 'REJECTED' || request.status === 'IGNORED')
      ) {
        this.latestInterestNotice = { kind: 'DECISION' };
      }
      this.notifyInterestRequestListeners();
      this.emitState();
    } else if (type === 'safe-chat:updated' || type === 'safe-chat:expired') {
      const room = ev.room as RealmChatRoom | undefined;
      const roomId = String(ev.roomId || room?.id || '');
      if (room) {
        await realmDB.write((tx) => {
          tx.create('chat_rooms', room);
          if (type === 'safe-chat:expired') {
            for (const message of realmDB.objects('messages')) {
              if (message.room_id === roomId) tx.delete('messages', message.id);
            }
          }
        });
      }
      this.emitState();
    } else if (type === 'safe-chat:screenshot') {
      this.latestSafeChatScreenshot = {
        roomId: String(ev.roomId || ''),
        nickname: typeof ev.nickname === 'string' ? ev.nickname : '',
        createdAt: typeof ev.created_at === 'number' ? ev.created_at : Date.now(),
      };
      this.emitState();
    } else if (type === 'peer:updated') {
      const peer = ev.peer as RealmUser | undefined;
      if (peer && (!self || peer.id !== self.id)) {
        await realmDB.write((tx) => {
          const prev = realmDB.objectForPrimaryKey('users', peer.id);
          tx.create('users', {
            ...(prev ?? {
              premium_plan: peer.is_premium ? 'monthly' : 'free',
              points: 0,
              unlocked_frames: [0, 1],
              blocked_user_ids: [],
              daily_random_count: 0,
              last_random_date: '',
              role: peer.role || 'user',
              status: peer.status || 'active',
            }),
            ...peer,
            is_self: false,
          });
        });
      }
    } else if (type === 'link:updated') {
      const link = ev.personalLink as RealmPersonalLink | undefined;
      if (link) {
        await realmDB.write((tx) => {
          tx.create('personal_links', link);
        });
      }
    } else if (type === 'room:upsert') {
      const room = ev.room as RealmChatRoom | undefined;
      const peer = ev.peer as RealmUser | undefined;
      const msg = ev.message as RealmMessage | undefined;
      await realmDB.write((tx) => {
        if (peer && (!self || peer.id !== self.id)) {
          const prev = realmDB.objectForPrimaryKey('users', peer.id);
          tx.create('users', {
            ...(prev ?? {
              premium_plan: peer.is_premium ? 'monthly' : 'free',
              points: 0,
              unlocked_frames: [0, 1],
              blocked_user_ids: [],
              daily_random_count: 0,
              last_random_date: '',
              role: peer.role || 'user',
              status: peer.status || 'active',
            }),
            ...peer,
            is_self: false,
          });
        }
        if (room) tx.create('chat_rooms', room);
        if (msg) tx.create('messages', msg);
      });
      await triggerLightHaptic();
    } else if (type === 'room:deleted') {
      const roomId = String(ev.roomId || '');
      if (roomId) {
        await realmDB.write((tx) => {
          for (const m of realmDB.objects('messages').filter((x) => x.room_id === roomId)) {
            tx.delete('messages', m.id);
          }
          tx.delete('chat_rooms', roomId);
        });
      }
    } else if (type === 'message:created') {
      const msg = ev.message as RealmMessage | undefined;
      const room = ev.room as RealmChatRoom | undefined;
      const senderPeer = ev.senderPeer as RealmUser | undefined;
      if (room) {
        this.typingUsersByRoom.set(room.id, false);
      }
      await realmDB.write((tx) => {
        if (senderPeer && (!self || senderPeer.id !== self.id)) {
          const prev = realmDB.objectForPrimaryKey('users', senderPeer.id);
          tx.create('users', {
            ...(prev ?? {
              premium_plan: senderPeer.is_premium ? 'monthly' : 'free',
              points: 0,
              unlocked_frames: [0, 1],
              blocked_user_ids: [],
              daily_random_count: 0,
              last_random_date: '',
              role: senderPeer.role || 'user',
              status: senderPeer.status || 'active',
            }),
            ...senderPeer,
            is_self: false,
          });
        }
        if (room) tx.create('chat_rooms', room);
        if (msg) tx.create('messages', msg);
      });
      if (msg && self && msg.sender_id !== self.id) {
        await triggerLightHaptic();
      }
      this.emitState();
    } else if (type === 'messages:read') {
      const roomId = String(ev.roomId || '');
      const ids = new Set((ev.messageIds as string[]) || []);
      await realmDB.write((tx) => {
        for (const m of realmDB.objects('messages')) {
          if (m.room_id === roomId && ids.has(m.id)) {
            tx.create('messages', { ...m, status: 'READ' });
          }
        }
      });
    } else if (type === 'typing') {
      const roomId = String(ev.roomId || '');
      this.typingUsersByRoom.set(roomId, Boolean(ev.isTyping));
      this.emitState();
    } else if (type === 'match:error') {
      const settings = realmDB.getSettings();
      const arabicMessage =
        typeof ev.message === 'string' ? ev.message : 'تعذر الانضمام إلى رادار المطابقة.';
      const englishMessage =
        typeof ev.message_en === 'string'
          ? ev.message_en
          : 'Could not join the live match radar.';
      this.matchCandidates = [];
      this.matchError = settings.language === 'ar' ? arabicMessage : englishMessage;
      this.emitState();
    } else if (type === 'match:candidates') {
      this.matchError = null;
      const rawList = (ev.candidates as Array<LiveMatchCandidate>) || [];
      this.matchCandidates = rawList.map((c) => {
        const prev = realmDB.objectForPrimaryKey('users', c.peer.id);
        return {
          ...c,
          peer: {
            ...(prev ?? {
              premium_plan: c.peer.is_premium ? 'monthly' : 'free',
              points: 0,
              unlocked_frames: [0, 1],
              blocked_user_ids: [],
              daily_random_count: 0,
              last_random_date: '',
              role: c.peer.role || 'user',
              status: c.peer.status || 'active',
            }),
            ...c.peer,
            is_self: false,
          },
        };
      });
      this.queueSize = Number(ev.queueSize) || 0;
      this.onlineCount = Math.max(1, Number(ev.onlineCount) || 1);
      this.emitState();
    } else if (type === 'vent:upsert') {
      const vent = ev.vent as Omit<RealmPublicVent, 'liked_by_me'> | undefined;
      const authorPeer = ev.authorPeer as RealmUser | undefined;
      if (vent) {
        await realmDB.write((tx) => {
          if (authorPeer && (!self || authorPeer.id !== self.id)) {
            const prev = realmDB.objectForPrimaryKey('users', authorPeer.id);
            tx.create('users', {
              ...(prev ?? {
                premium_plan: authorPeer.is_premium ? 'monthly' : 'free',
                points: 0,
                unlocked_frames: [0, 1],
                blocked_user_ids: [],
                daily_random_count: 0,
                last_random_date: '',
                role: authorPeer.role || 'user',
                status: authorPeer.status || 'active',
              }),
              ...authorPeer,
              is_self: false,
            });
          }
          const existing = realmDB.objectForPrimaryKey('public_vents', vent.id);
          tx.create('public_vents', {
            ...vent,
            liked_by_me: existing?.liked_by_me ?? false,
          });
        });
      }
    } else if (type === 'vent:likes_updated') {
      const ventId = String(ev.ventId || '');
      const likesCount = Number(ev.likes_count) || 0;
      const existing = realmDB.objectForPrimaryKey('public_vents', ventId);
      if (existing) {
        await realmDB.write((tx) => {
          tx.create('public_vents', { ...existing, likes_count: likesCount });
        });
      }
    } else if (type === 'report:new' || type === 'report:updated') {
      const rep = ev.report as RealmReportModeration | undefined;
      if (rep) {
        await realmDB.write((tx) => {
          tx.create('reports_moderation', rep);
        });
        this.emitState();
      }
    } else if (type === 'sync:needed') {
      await this.pullFullSync();
    }
  }

  // ============================================================================
  // CLIENT API ACTIONS
  // ============================================================================

  joinMatchmakingQueue(countryFilter: string, langFilter: string): void {
    this.matchQueuePreferences = { countryFilter, langFilter };
    if (this.matchError) {
      this.matchError = null;
      this.emitState();
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(
        JSON.stringify({
          type: 'match:join_queue',
          countryFilter,
          langFilter,
        })
      );
    }
  }

  leaveMatchmakingQueue(): void {
    this.matchQueuePreferences = null;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'match:leave_queue' }));
    }
  }

  sendTypingIndicator(roomId: string, isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'typing', roomId, isTyping }));
    }
  }

  async updateCustomServerUrl(newUrl: string): Promise<boolean> {
    const clean = newUrl.trim().replace(/\/+$/, '');
    const settings = realmDB.getSettings();
    await realmDB.write((tx) => {
      tx.create('app_settings', {
        ...settings,
        custom_server_url: clean,
        auth_token: '',
      });
    });
    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.manualClose = true;
      this.ws.close();
      this.ws = null;
    }
    this.connectionState = 'offline';
    this.emitState();
    try {
      const hasSession = await this.bootstrapSessionAndSync();
      if (!hasSession) {
        this.connectionState = 'offline';
        this.emitState();
        return false;
      }
      return this.connectionState !== 'offline';
    } catch {
      return false;
    }
  }

  async updateProfile(payload: {
    nickname: string;
    slug: string;
    country: string;
    bio: string;
    age: number | null;
    avatar_url: string;
    frame_id: number;
    interests: string[];
    languages: string[];
  }): Promise<{ ok: boolean; error?: string }> {
    try {
      const endpoint = 'تعذر حفظ الملف الشخصي';
      const res = await this.fetchBootstrap(
        `${this.getServerBaseUrl()}/api/profile`,
        {
          method: 'PUT',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(payload),
        },
        endpoint
      );
      const data: unknown = await this.readBootstrapResponse<unknown>(res, endpoint);
      if (
        !isRecord(data) ||
        !isRecord(data.selfUser) ||
        typeof data.selfUser.id !== 'string' ||
        !isRecord(data.personalLink) ||
        typeof data.personalLink.id !== 'string' ||
        data.personalLink.user_id !== data.selfUser.id
      ) {
        return { ok: false, error: 'لم يؤكد الخادم حفظ بيانات الملف الشخصي.' };
      }
      await realmDB.write((tx) => {
        tx.create('users', { ...(data.selfUser as RealmUser), is_self: true });
        tx.create('personal_links', data.personalLink as RealmPersonalLink);
      });
      return { ok: true };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'تعذر الاتصال بالخادم لحفظ الملف الشخصي.',
      };
    }
  }

  async fetchPublicLinkInfo(slug: string): Promise<{
    slug: string;
    visits_count: number;
    targetUser: RealmUser;
  } | null> {
    try {
      const res = await fetch(
        `${this.getServerBaseUrl()}/api/links/${encodeURIComponent(slug)}`
      );
      if (!res.ok) return null;
      return await res.json();
    } catch {
      return null;
    }
  }

  async arePushNotificationsEnabled(): Promise<boolean> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/health`);
    if (!res.ok) throw new Error('تعذر التحقق من إعداد الإشعارات.');
    const data: unknown = await res.json();
    return isRecord(data) && data.pushNotificationsEnabled === true;
  }

  async registerPushToken(token: string): Promise<void> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/push-tokens`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ token }),
    });
    const data: unknown = await res.json();
    if (!res.ok) {
      throw new Error(
        isRecord(data) && typeof data.error === 'string'
          ? data.error
          : 'تعذر تسجيل إشعارات هذا الجهاز.'
      );
    }
  }

  async discoverPeople(filters: {
    interests?: string[];
    country?: string;
    language?: string;
  } = {}): Promise<DiscoveryCandidateDTO[]> {
    const query = new URLSearchParams();
    if (filters.interests?.length) query.set('interests', filters.interests.join(','));
    if (filters.country) query.set('country', filters.country);
    if (filters.language) query.set('language', filters.language);
    const suffix = query.size ? `?${query.toString()}` : '';
    const res = await fetch(`${this.getServerBaseUrl()}/api/discovery${suffix}`, {
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر تحميل اقتراحات التعارف.');
    if (!Array.isArray(data.candidates)) throw new Error('استجابة الاكتشاف غير صالحة.');
    return data.candidates as DiscoveryCandidateDTO[];
  }

  async fetchCompanionBots(lang: AppLang): Promise<CompanionBotsResponseDTO> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/bots?lang=${encodeURIComponent(lang)}`,
      { headers: this.getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر تحميل شخصيات الذكاء الاصطناعي.');
    if (!Array.isArray(data.bots) || !Array.isArray(data.conversations)) {
      throw new Error('استجابة الشخصيات الذكية غير صالحة.');
    }
    return data as CompanionBotsResponseDTO;
  }

  async sendBotMessage(
    botId: string,
    content: string,
    lang: AppLang
  ): Promise<{ conversation: CompanionBotConversationDTO }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/bots/${encodeURIComponent(botId)}/messages`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ content, lang }),
      }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر إرسال الرسالة إلى الشخصية الذكية.');
    if (!isRecord(data.conversation) || !Array.isArray(data.conversation.turns)) {
      throw new Error('لم يؤكد الخادم حفظ المحادثة الذكية.');
    }
    return { conversation: data.conversation as CompanionBotConversationDTO };
  }

  async updateSafeChat(
    roomId: string,
    action: 'REQUEST' | 'ACCEPT' | 'DISABLE',
    durationSeconds?: number
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/safe-chat`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action, durationSeconds }),
      }
    );
    const data = await res.json();
    if (!res.ok) return { ok: false, error: data.error || 'تعذر تحديث وضع المحادثة الآمنة.' };
    if (!data.room || typeof data.room.id !== 'string') {
      return { ok: false, error: 'لم يؤكد الخادم تحديث وضع المحادثة الآمنة.' };
    }
    await realmDB.write((tx) => tx.create('chat_rooms', data.room as RealmChatRoom));
    this.emitState();
    return { ok: true };
  }

  async reportSafeChatScreenshot(roomId: string): Promise<void> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/safe-chat/screenshot`,
      { method: 'POST', headers: this.getAuthHeaders() }
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'تعذر إشعار الطرف الآخر بالتقاط الشاشة.');
  }

  async getInterestRequests(): Promise<InterestRequestDTO[]> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/interest-requests`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'تعذر تحميل طلبات التعارف.');
    }
    if (!Array.isArray(data.requests)) {
      throw new Error('استجابة طلبات التعارف غير صالحة.');
    }
    return data.requests as InterestRequestDTO[];
  }

  async createInterestRequest(
    targetUserId: string,
    introText: string
  ): Promise<{ ok: boolean; request?: InterestRequestDTO; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/interest-requests`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ targetUserId, introText }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'تعذر إرسال طلب التعارف.' };
    }
    this.notifyInterestRequestListeners();
    this.emitState();
    return { ok: true, request: data.request as InterestRequestDTO };
  }

  async respondToInterestRequest(
    requestId: string,
    action: 'ACCEPT' | 'REJECT' | 'IGNORE' | 'BLOCK'
  ): Promise<{ ok: boolean; roomId?: string; error?: string }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/interest-requests/${encodeURIComponent(requestId)}/respond`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action }),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'تعذر تحديث طلب التعارف.' };
    }
    if (data.room) {
      await realmDB.write((tx) => {
        if (data.peer && data.peer.id !== realmDB.findSelfUser()?.id) {
          tx.create('users', {
            premium_plan: 'free',
            points: 0,
            unlocked_frames: [0, 1],
            blocked_user_ids: [],
            daily_random_count: 0,
            last_random_date: '',
            role: 'user',
            status: 'active',
            ...data.peer,
            is_self: false,
          });
        }
        tx.create('chat_rooms', data.room as RealmChatRoom);
        if (data.message) tx.create('messages', data.message as RealmMessage);
      });
    }
    if (action === 'BLOCK' && !(await this.pullFullSync())) {
      throw new Error('تم حفظ الحظر لكن تعذرت مزامنة قائمة الحظر.');
    }
    this.notifyInterestRequestListeners();
    this.emitState();
    return { ok: true, roomId: data.room?.id };
  }

  async sendSecretLinkMessage(
    slug: string,
    payload: { content: string; senderAlias: string; senderAvatar: string }
  ): Promise<{ ok: boolean; requestId?: string; error?: string }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/links/${encodeURIComponent(slug)}/send`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(payload),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'تعذر إرسال الرسالة.' };
    }

    if (data.issuedAuthToken && data.issuedSelfUser) {
      const s = realmDB.getSettings();
      if (!s.auth_token) {
        await realmDB.write((tx) => {
          tx.create('app_settings', { ...s, auth_token: data.issuedAuthToken });
          tx.create('users', { ...data.issuedSelfUser, is_self: true });
          if (data.issuedPersonalLink) {
            tx.create('personal_links', data.issuedPersonalLink);
          }
        });
        this.connectWebSocket();
      }
    }

    await triggerLightHaptic();
    this.notifyInterestRequestListeners();
    return { ok: true, requestId: data.request?.id };
  }

  async requestRandomMatch(
    targetPeerId: string,
    introText?: string
  ): Promise<{ ok: boolean; request?: InterestRequestDTO; quotaReached?: boolean; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/match/interest-request`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ targetPeerId, introText }),
    });
    const data = await res.json();
    if (res.status === 429) {
      return { ok: false, quotaReached: true };
    }
    if (!res.ok) {
      return { ok: false, error: data.message || data.error || 'تعذر إرسال طلب المحادثة.' };
    }
    if (data.selfUser) {
      await realmDB.write((tx) =>
        tx.create('users', { ...data.selfUser, is_self: true } as RealmUser)
      );
    }
    this.notifyInterestRequestListeners();
    this.emitState();
    await triggerLightHaptic();
    return { ok: true, request: data.request as InterestRequestDTO };
  }

  async respondToChatRequest(roomId: string, action: 'ACCEPT' | 'REJECT'): Promise<void> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/respond`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ action }),
      }
    );
    const data = await res.json();
    if (action === 'REJECT' || data.deleted) {
      await realmDB.write((tx) => {
        for (const m of realmDB.objects('messages').filter((x) => x.room_id === roomId)) {
          tx.delete('messages', m.id);
        }
        tx.delete('chat_rooms', roomId);
      });
    } else if (data.room) {
      await realmDB.write((tx) => {
        tx.create('chat_rooms', data.room);
      });
    }
  }

  async sendMessage(
    roomId: string,
    params: { content: string; media_url?: string; media_type?: MediaType }
  ): Promise<{ ok: boolean; isFrozen?: boolean; reason?: string }> {
    const self = realmDB.findSelfUser();
    if (!self) return { ok: false };

    const msgId = `msg-${generateUUID().slice(0, 8)}`;
    const now = Date.now();

    const optimisticMsg: RealmMessage = {
      id: msgId,
      room_id: roomId,
      sender_id: self.id,
      content: params.content,
      media_url: params.media_url || '',
      media_type: params.media_type || 'text',
      ai_flag_score: 0,
      ai_flag_reason: '',
      is_frozen: false,
      status: 'SENT',
      created_at: now,
    };

    await realmDB.write((tx) => {
      tx.create('messages', optimisticMsg);
      const room = realmDB.objectForPrimaryKey('chat_rooms', roomId);
      if (room) {
        tx.create('chat_rooms', {
          ...room,
          last_message_preview: params.content,
          last_message_at: now,
        });
      }
    });

    try {
      const res = await fetch(
        `${this.getServerBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/messages`,
        {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            id: msgId,
            content: params.content,
            media_url: params.media_url || '',
            media_type: params.media_type || 'text',
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        await realmDB.write((tx) => tx.delete('messages', msgId));
        return { ok: false, reason: data.error };
      }

      await realmDB.write((tx) => {
        if (data.message) tx.create('messages', data.message);
        if (data.room) tx.create('chat_rooms', data.room);
      });

      if (data.message?.is_frozen) {
        return { ok: true, isFrozen: true, reason: data.message.ai_flag_reason };
      }
      await triggerLightHaptic();
      return { ok: true };
    } catch {
      return { ok: false, reason: 'انقطع الاتصال بالسيرفر.' };
    }
  }

  async markRoomRead(roomId: string): Promise<void> {
    const room = realmDB.objectForPrimaryKey('chat_rooms', roomId);
    if (room && room.unread_count > 0) {
      await realmDB.write((tx) => {
        tx.create('chat_rooms', { ...room, unread_count: 0 });
      });
    }
    try {
      await fetch(`${this.getServerBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/read`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // Reconciles on next sync
    }
  }

  async blockPeer(roomId: string): Promise<void> {
    await fetch(`${this.getServerBaseUrl()}/api/rooms/${encodeURIComponent(roomId)}/block`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
    });
    const self = realmDB.findSelfUser();
    const room = realmDB.objectForPrimaryKey('chat_rooms', roomId);
    if (self && room) {
      const peerId = room.participant_a === self.id ? room.participant_b : room.participant_a;
      await realmDB.write((tx) => {
        tx.create('chat_rooms', { ...room, status: 'BLOCKED' });
        tx.create('users', {
          ...self,
          blocked_user_ids: Array.from(new Set([...self.blocked_user_ids, peerId])),
        });
      });
    }
  }

  async submitReport(params: {
    roomId?: string;
    interestRequestId?: string;
    reportedUserId?: string;
    target_type?: ReportTargetType;
    target_id?: string;
    reason: string;
    details?: string;
  }): Promise<{ ok: boolean; summary: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/reports`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (data.report) {
      await realmDB.write((tx) => {
        tx.create('reports_moderation', data.report);
      });
      return { ok: true, summary: data.report.ai_summary };
    }
    return { ok: false, summary: 'تم حفظ البلاغ في سجل الإشراف.' };
  }

  async publishVent(topic: string, content: string): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/vents`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ topic, content }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.message || data.error || 'تعذر نشر الفضفضة.' };
    }
    await realmDB.write((tx) => {
      tx.create('public_vents', data.vent);
    });
    await triggerLightHaptic();
    return { ok: true };
  }

  async toggleLikeVent(ventId: string): Promise<void> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/vents/${encodeURIComponent(ventId)}/like`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
      }
    );
    if (!res.ok) return;
    const data = await res.json();
    const existing = realmDB.objectForPrimaryKey('public_vents', ventId);
    if (existing) {
      await realmDB.write((tx) => {
        tx.create('public_vents', {
          ...existing,
          likes_count: data.likes_count,
          liked_by_me: data.liked_by_me,
        });
      });
    }
  }

  // ============================================================================
  // VERIFIED PAYMENTS & MONETIZATION
  // ============================================================================

  async checkoutPackage(params: {
    type: 'SUBSCRIPTION' | 'POINTS_PACK';
    packageId: string;
    orderId?: string;
  }): Promise<{ ok: boolean; transaction?: RealmPaymentTransaction; error?: string }> {
    const idempotencyKey = `ord-${Date.now()}-${generateUUID().slice(0, 8)}`;
    const res = await fetch(`${this.getServerBaseUrl()}/api/payments/checkout`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        ...params,
        idempotencyKey,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'فشلت عملية الدفع.' };
    }

    await realmDB.write((tx) => {
      if (data.selfUser) {
        tx.create('users', { ...data.selfUser, is_self: true });
      }
      if (data.transaction) {
        tx.create('payment_transactions', data.transaction);
      }
    });

    await triggerLightHaptic();
    return { ok: true, transaction: data.transaction };
  }

  async spendPoints(params: {
    action: 'UNLOCK_FRAME' | 'UNLOCK_QUOTA';
    frameId?: number;
  }): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/payments/spend`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(params),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'رصيد النقاط غير كافٍ.' };
    }

    await realmDB.write((tx) => {
      if (data.selfUser) {
        tx.create('users', { ...data.selfUser, is_self: true });
      }
      if (data.transaction) {
        tx.create('payment_transactions', data.transaction);
      }
    });

    await triggerLightHaptic();
    return { ok: true };
  }

  async fetchPaymentHistory(): Promise<RealmPaymentTransaction[]> {
    try {
      const res = await fetch(`${this.getServerBaseUrl()}/api/payments/history`, {
        method: 'GET',
        headers: this.getAuthHeaders(),
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.transactions as RealmPaymentTransaction[]) || [];
    } catch {
      return [];
    }
  }

  // ============================================================================
  // ADMIN & MODERATION API METHODS (STRICT SERVER-VERIFIED RBAC)
  // ============================================================================

  async verifyStaffPasscode(passcode: string): Promise<{ ok: boolean; role?: string; error?: string }> {
    try {
      const res = await fetch(`${this.getServerBaseUrl()}/api/admin/staff-verify`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ passcode }),
      });
      const data = await res.json();
      if (!res.ok) {
        return { ok: false, error: data.message || data.error || 'رمز الصلاحيات غير صحيح.' };
      }

      if (data.selfUser) {
        await realmDB.write((tx) => {
          tx.create('users', { ...data.selfUser, is_self: true });
        });
      }
      this.emitState();
      await triggerLightHaptic();
      return { ok: true, role: data.role };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : 'تعذر الاتصال بالسيرفر للتحقق من الرمز.',
      };
    }
  }

  async getAdminReports(): Promise<RealmReportModeration[]> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/reports`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('FORBIDDEN');
    const data = await res.json();
    return (data.reports as RealmReportModeration[]) || [];
  }

  async takeModerationAction(
    reportId: string,
    params: {
      action: 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN' | 'RESOLVE' | 'DISMISS';
      reason?: string;
      duration_hours?: number;
      note?: string;
    }
  ): Promise<{ ok: boolean; report?: RealmReportModeration; error?: string }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/admin/reports/${encodeURIComponent(reportId)}/action`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'فشل تنفيذ الإجراء.' };
    }
    if (data.report) {
      await realmDB.write((tx) => {
        tx.create('reports_moderation', data.report);
      });
    }
    return { ok: true, report: data.report };
  }

  async getAdminAuditLogs(): Promise<any[]> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/audit-logs`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('FORBIDDEN');
    const data = await res.json();
    return data.logs || [];
  }

  async getAdminStats(): Promise<AdminStatsDTO> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/stats`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('FORBIDDEN');
    return (await res.json()) as AdminStatsDTO;
  }

  async getAdminUsers(query?: string): Promise<any[]> {
    const url = new URL(`${this.getServerBaseUrl()}/api/admin/users`);
    if (query) url.searchParams.set('q', query);
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('FORBIDDEN');
    const data = await res.json();
    return data.users || [];
  }

  async grantAdminCoins(
    username: string,
    amount: number
  ): Promise<{ ok: boolean; error?: string; nickname?: string; points_delta?: number; points_balance?: number }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/users/coins`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({ username, amount }),
    });
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'COIN_GRANT_FAILED' };
    }
    return {
      ok: true,
      nickname: data.nickname,
      points_delta: data.points_delta,
      points_balance: data.points_balance,
    };
  }

  async updateAdminUserStatus(
    userId: string,
    params: {
      action?: 'ACTIVATE' | 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN';
      role?: 'owner' | 'moderator' | 'user';
      reason?: string;
      duration_hours?: number;
    }
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/admin/users/${encodeURIComponent(userId)}/status`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(params),
      }
    );
    const data = await res.json();
    if (!res.ok) {
      return { ok: false, error: data.error || 'تعذر تحديث الحساب.' };
    }
    return { ok: true };
  }

  async getAdminPayments(): Promise<RealmPaymentTransaction[]> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/payments`, {
      method: 'GET',
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('FORBIDDEN');
    const data = await res.json();
    return (data.transactions as RealmPaymentTransaction[]) || [];
  }

  async getManualTopupConfig(): Promise<ManualTopupConfigDTO> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/payments/manual/config`);
    if (!res.ok) throw new Error('تعذر تحميل باقات الشحن ووسائل الدفع.');
    const config = (await res.json()) as Partial<ManualTopupConfigDTO>;
    return {
      packages: config.packages || [],
      vip_plans: config.vip_plans || [],
      payment_methods: config.payment_methods || [],
      updated_at: config.updated_at,
    };
  }

  async getManualTopupRequests(): Promise<ManualTopupRequestDTO[]> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/payments/manual/requests`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('تعذر تحميل طلبات الشحن.');
    const data = (await res.json()) as { requests?: ManualTopupRequestDTO[] };
    return data.requests || [];
  }

  async createManualTopupRequest(params: {
    packageId: string;
    paymentMethodId: string;
    transactionReference: string;
    proofDataUrl: string;
    idempotencyKey: string;
  }): Promise<{ ok: boolean; request?: ManualTopupRequestDTO; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/payments/manual/requests`, {
      method: 'POST',
      headers: { ...this.getAuthHeaders(), 'Idempotency-Key': params.idempotencyKey },
      body: JSON.stringify({
        package_id: params.packageId,
        payment_method_id: params.paymentMethodId,
        transaction_reference: params.transactionReference,
        proof_data_url: params.proofDataUrl,
      }),
    });
    const data = (await res.json()) as { request?: ManualTopupRequestDTO; error?: string };
    return res.ok
      ? { ok: true, request: data.request }
      : { ok: false, error: data.error || 'تعذر إرسال طلب الشحن.' };
  }

  async createManualSubscriptionRequest(params: {
    planId: Exclude<PremiumPlan, 'free'>;
    paymentMethodId: string;
    transactionReference: string;
    proofDataUrl: string;
    idempotencyKey: string;
  }): Promise<{ ok: boolean; request?: ManualTopupRequestDTO; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/payments/manual/requests`, {
      method: 'POST',
      headers: { ...this.getAuthHeaders(), 'Idempotency-Key': params.idempotencyKey },
      body: JSON.stringify({
        request_type: 'SUBSCRIPTION',
        plan_id: params.planId,
        payment_method_id: params.paymentMethodId,
        transaction_reference: params.transactionReference,
        proof_data_url: params.proofDataUrl,
      }),
    });
    const data = (await res.json()) as { request?: ManualTopupRequestDTO; error?: string };
    return res.ok
      ? { ok: true, request: data.request }
      : { ok: false, error: data.error || 'تعذر إرسال طلب اشتراك VIP.' };
  }

  async getAdminManualTopups(): Promise<ManualTopupRequestDTO[]> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/manual-topups`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('تعذر تحميل طلبات الشحن الإدارية.');
    const data = (await res.json()) as { requests?: ManualTopupRequestDTO[] };
    return data.requests || [];
  }

  async getAdminManualTopupProof(requestId: string): Promise<string> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/admin/manual-topups/${encodeURIComponent(requestId)}/proof`,
      { headers: this.getAuthHeaders() }
    );
    if (!res.ok) throw new Error('تعذر تحميل إثبات التحويل.');
    return URL.createObjectURL(await res.blob());
  }

  async reviewManualTopup(
    requestId: string,
    decision: 'APPROVE' | 'REJECT',
    reason?: string
  ): Promise<{ ok: boolean; error?: string }> {
    const res = await fetch(
      `${this.getServerBaseUrl()}/api/admin/manual-topups/${encodeURIComponent(requestId)}/review`,
      {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({ decision, reason }),
      }
    );
    const data = (await res.json()) as {
      error?: string;
      transaction?: RealmPaymentTransaction;
      points_balance?: number;
    };
    if (!res.ok) return { ok: false, error: data.error || 'تعذرت مراجعة طلب الشحن.' };
    if (data.transaction) {
      await realmDB.write((tx) => {
        tx.create('payment_transactions', data.transaction!);
      });
    }
    this.emitState();
    return { ok: true };
  }

  async getAdminManualTopupConfig(): Promise<ManualTopupConfigDTO> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/manual-topups/config`, {
      headers: this.getAuthHeaders(),
    });
    if (!res.ok) throw new Error('تعذر تحميل إعدادات الشحن اليدوي.');
    const config = (await res.json()) as Partial<ManualTopupConfigDTO>;
    return {
      packages: config.packages || [],
      vip_plans: config.vip_plans || [],
      payment_methods: config.payment_methods || [],
      updated_at: config.updated_at,
    };
  }

  async saveAdminManualTopupConfig(
    config: ManualTopupConfigDTO
  ): Promise<{ ok: boolean; config?: ManualTopupConfigDTO; error?: string }> {
    const res = await fetch(`${this.getServerBaseUrl()}/api/admin/manual-topups/config`, {
      method: 'PUT',
      headers: this.getAuthHeaders(),
      body: JSON.stringify(config),
    });
    const data = (await res.json()) as ManualTopupConfigDTO & { error?: string };
    return res.ok
      ? { ok: true, config: data }
      : { ok: false, error: data.error || 'تعذر حفظ إعدادات الشحن.' };
  }

  async deleteAccountPermanently(): Promise<void> {
    try {
      await fetch(`${this.getServerBaseUrl()}/api/account`, {
        method: 'DELETE',
        headers: this.getAuthHeaders(),
      });
    } catch {
      // Ignore
    }
    await realmDB.clearAllUserDataPreservePreferences();
    await this.bootstrapSessionAndSync();
  }
}

export const fadfadahClient = new FadfadahNetworkClient();
