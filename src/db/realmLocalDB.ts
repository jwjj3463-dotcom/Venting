/**
 * Local Realm DB Engine for Android APK (com.fadfadahnative v3.9.0+)
 * Acts as the fast 0ms offline-first persistence layer on the Android device,
 * automatically synchronized with the standalone Fadfadah Server & WebSocket Hub.
 * Zero mock/fake data — stores only real authenticated account & synced conversations.
 */

export type UserRole = 'owner' | 'moderator' | 'user';
export type AccountStatus = 'active' | 'warned' | 'restricted' | 'suspended' | 'banned';

export type ChatRoomType = 'LINK_BASED' | 'RANDOM';
export type ChatRoomStatus = 'PENDING' | 'ACCEPTED' | 'BLOCKED';
export type MessageStatus = 'SENT' | 'READ';
export type MediaType = 'text' | 'image' | 'sticker';
export type PremiumPlan = 'free' | (string & {});

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
  | 'ADMIN_CREDIT'
  | 'FRAME_PURCHASE'
  | 'QUOTA_UNLOCK';
export type PaymentStatus = 'COMPLETED' | 'FAILED' | 'REFUNDED';

export interface RealmObjectSchema {
  name: string;
  primaryKey: string;
  properties: Record<string, string>;
}

export interface RealmUser {
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
  points: number;
  unlocked_frames: number[];
  blocked_user_ids: string[];
  daily_random_count: number;
  last_random_date: string;
  is_self: boolean;
  is_online: boolean;
  bio: string;
  age?: number;
  is_adult?: boolean;
  role: UserRole;
  status: AccountStatus;
  warning_message?: string;
  restriction_reason?: string;
  suspension_until?: number;
  banned_at?: number;
  ban_reason?: string;
}

export function isRealmPremiumActive(
  user: Pick<RealmUser, 'is_premium' | 'premium_expires_at'>
): boolean {
  return user.is_premium && (user.premium_expires_at === undefined || user.premium_expires_at > Date.now());
}

export interface RealmPersonalLink {
  id: string;
  user_id: string;
  slug: string;
  is_active: boolean;
  visits_count: number;
  created_at: number;
}

export interface RealmChatRoom {
  id: string;
  type: ChatRoomType;
  participant_a: string;
  participant_b: string;
  status: ChatRoomStatus;
  unread_count: number;
  last_message_preview: string;
  last_message_at: number;
  created_at: number;
  safe_chat_status?: 'OFF' | 'PENDING' | 'ACTIVE';
  safe_chat_requested_by?: string;
  safe_chat_duration_seconds?: number;
  safe_chat_last_activity_at?: number;
  safe_chat_expires_at?: number;
}

export interface RealmMessage {
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
  message_type?: 'TEXT' | 'INTRO_CARD';
  introduction?: {
    nickname: string;
    avatar_url: string;
    frame_id: number;
    age?: number;
    bio: string;
    interests: string[];
    is_anonymous: boolean;
  };
}

export interface RealmReportModeration {
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

export interface RealmPublicVent {
  id: string;
  author_id: string;
  topic: string;
  content: string;
  likes_count: number;
  liked_by_me: boolean;
  ai_flag_score: number;
  created_at: number;
}

export interface RealmPaymentTransaction {
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

export interface RealmAppSettings {
  id: string;
  theme: 'dark' | 'light';
  language: 'ar' | 'en';
  auth_token: string;
  custom_server_url: string;
  pending_recovery_code?: string;
}

export type RealmCollectionName =
  | 'users'
  | 'personal_links'
  | 'chat_rooms'
  | 'messages'
  | 'reports_moderation'
  | 'public_vents'
  | 'payment_transactions'
  | 'app_settings';

export interface RealmStoreMap {
  users: RealmUser;
  personal_links: RealmPersonalLink;
  chat_rooms: RealmChatRoom;
  messages: RealmMessage;
  reports_moderation: RealmReportModeration;
  public_vents: RealmPublicVent;
  payment_transactions: RealmPaymentTransaction;
  app_settings: RealmAppSettings;
}

export const FADFADAH_REALM_SCHEMAS: RealmObjectSchema[] = [
  {
    name: 'users',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      nickname: 'string',
      avatar_url: 'string',
      frame_id: 'int',
      interests: 'string[]',
      languages: 'string[]',
      country: 'string',
      embedding_vector: 'float[]',
      is_premium: 'bool',
      premium_plan: 'string',
      premium_expires_at: 'date?',
      points: 'int',
      unlocked_frames: 'int[]',
      blocked_user_ids: 'string[]',
      daily_random_count: 'int',
      last_random_date: 'string',
      is_self: 'bool',
      is_online: 'bool',
      bio: 'string',
      age: 'int?',
      role: 'string',
      status: 'string',
    },
  },
  {
    name: 'personal_links',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      user_id: 'uuid',
      slug: 'string',
      is_active: 'bool',
      visits_count: 'int',
      created_at: 'date',
      message_type: 'string?',
      introduction: 'mixed?',
    },
  },
  {
    name: 'chat_rooms',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      type: 'string',
      participant_a: 'uuid',
      participant_b: 'uuid',
      status: 'string',
      unread_count: 'int',
      last_message_preview: 'string',
      last_message_at: 'date',
      created_at: 'date',
      safe_chat_status: 'string?',
      safe_chat_requested_by: 'uuid?',
      safe_chat_duration_seconds: 'int?',
      safe_chat_last_activity_at: 'date?',
      safe_chat_expires_at: 'date?',
    },
  },
  {
    name: 'messages',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      room_id: 'uuid',
      sender_id: 'uuid',
      content: 'string',
      media_url: 'string',
      media_type: 'string',
      ai_flag_score: 'float',
      ai_flag_reason: 'string',
      is_frozen: 'bool',
      status: 'string',
      created_at: 'date',
    },
  },
  {
    name: 'reports_moderation',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      reporter_id: 'uuid',
      reported_user_id: 'uuid',
      room_id: 'uuid',
      reason: 'string',
      recent_messages_log: 'string',
      ai_summary: 'string',
      status: 'string',
      created_at: 'date',
    },
  },
  {
    name: 'public_vents',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      author_id: 'uuid',
      topic: 'string',
      content: 'string',
      likes_count: 'int',
      liked_by_me: 'bool',
      ai_flag_score: 'float',
      created_at: 'date',
    },
  },
  {
    name: 'payment_transactions',
    primaryKey: 'id',
    properties: {
      id: 'uuid',
      user_id: 'uuid',
      user_nickname: 'string',
      type: 'string',
      item_id: 'string',
      item_title: 'string',
      amount_usd: 'float',
      points_delta: 'int',
      status: 'string',
      order_id: 'string',
      idempotency_key: 'string',
      created_at: 'date',
      amount_currency: 'string?',
    },
  },
  {
    name: 'app_settings',
    primaryKey: 'id',
    properties: {
      id: 'string',
      theme: 'string',
      language: 'string',
      auth_token: 'string',
      custom_server_url: 'string',
      pending_recovery_code: 'string?',
    },
  },
];

export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const DB_NAME = 'FadfadahAndroidRealmDB_v390_Prod';
const DB_VERSION = 2;

export interface RealmTransactionScope {
  create<K extends RealmCollectionName>(
    collection: K,
    data: RealmStoreMap[K],
    mode?: 'modified' | 'never'
  ): RealmStoreMap[K];
  delete<K extends RealmCollectionName>(collection: K, id: string): void;
}

export class LocalRealmDB {
  private idb: IDBDatabase | null = null;
  private memory: { [K in RealmCollectionName]: Map<string, RealmStoreMap[K]> } = {
    users: new Map(),
    personal_links: new Map(),
    chat_rooms: new Map(),
    messages: new Map(),
    reports_moderation: new Map(),
    public_vents: new Map(),
    payment_transactions: new Map(),
    app_settings: new Map(),
  };
  private listeners: Set<() => void> = new Set();
  private initialized = false;
  public readonly schemaVersion = 392;

  async open(): Promise<this> {
    if (this.initialized) return this;

    this.idb = await new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const schema of FADFADAH_REALM_SCHEMAS) {
          if (!db.objectStoreNames.contains(schema.name)) {
            db.createObjectStore(schema.name, { keyPath: schema.primaryKey });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });

    for (const schema of FADFADAH_REALM_SCHEMAS) {
      const col = schema.name as RealmCollectionName;
      const rows = await this.readAllFromIDB(col);
      const map = this.memory[col] as Map<string, unknown>;
      map.clear();
      for (const row of rows) {
        const record = row as unknown as Record<string, unknown>;
        map.set(String(record[schema.primaryKey]), row);
      }
    }

    if (!this.memory.app_settings.has('global')) {
      await this.write((tx) => {
        tx.create('app_settings', {
          id: 'global',
          theme: 'dark',
          language: 'ar',
          auth_token: '',
          custom_server_url: '',
        });
      });
    }

    this.initialized = true;
    this.notify();
    return this;
  }

  private readAllFromIDB<K extends RealmCollectionName>(storeName: K): Promise<RealmStoreMap[K][]> {
    return new Promise((resolve, reject) => {
      if (!this.idb) return resolve([]);
      const tx = this.idb.transaction(storeName, 'readonly');
      const store = tx.objectStore(storeName);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as RealmStoreMap[K][]);
      req.onerror = () => reject(req.error);
    });
  }

  objects<K extends RealmCollectionName>(collection: K): RealmStoreMap[K][] {
    return Array.from(this.memory[collection].values());
  }

  objectForPrimaryKey<K extends RealmCollectionName>(
    collection: K,
    id: string
  ): RealmStoreMap[K] | undefined {
    return this.memory[collection].get(id);
  }

  findSelfUser(): RealmUser | undefined {
    return this.objects('users').find((u) => u.is_self);
  }

  findPersonalLink(): RealmPersonalLink | undefined {
    const self = this.findSelfUser();
    if (!self) return undefined;
    return this.objects('personal_links').find((l) => l.user_id === self.id);
  }

  getSettings(): RealmAppSettings {
    const s = this.memory.app_settings.get('global');
    return (
      s ?? {
        id: 'global',
        theme: 'dark',
        language: 'ar',
        auth_token: '',
        custom_server_url: '',
      }
    );
  }

  async write(mutator: (tx: RealmTransactionScope) => void): Promise<void> {
    const dirtyStores = new Set<RealmCollectionName>();
    const deletions: Array<{ collection: RealmCollectionName; id: string }> = [];

    const scope: RealmTransactionScope = {
      create: <K extends RealmCollectionName>(
        collection: K,
        data: RealmStoreMap[K],
        mode: 'modified' | 'never' = 'modified'
      ): RealmStoreMap[K] => {
        const map = this.memory[collection] as Map<string, RealmStoreMap[K]>;
        const pk = (data as unknown as Record<string, string>).id;
        if (mode === 'never' && map.has(pk)) {
          throw new Error(`Duplicate primary key ${pk} in ${collection}`);
        }
        const cloned = structuredClone(data);
        map.set(pk, cloned);
        dirtyStores.add(collection);
        return cloned;
      },
      delete: <K extends RealmCollectionName>(collection: K, id: string) => {
        const map = this.memory[collection] as Map<string, RealmStoreMap[K]>;
        if (map.delete(id)) {
          dirtyStores.add(collection);
          deletions.push({ collection, id });
        }
      },
    };

    mutator(scope);

    if (this.idb && dirtyStores.size > 0) {
      const storeList = Array.from(dirtyStores);
      await new Promise<void>((resolve, reject) => {
        const tx = this.idb!.transaction(storeList, 'readwrite');
        for (const del of deletions) {
          tx.objectStore(del.collection).delete(del.id);
        }
        for (const col of storeList) {
          const store = tx.objectStore(col);
          for (const item of this.memory[col].values()) {
            store.put(item);
          }
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    this.notify();
  }

  async clearAllUserDataPreservePreferences(): Promise<void> {
    const currentSettings = this.getSettings();
    for (const schema of FADFADAH_REALM_SCHEMAS) {
      const col = schema.name as RealmCollectionName;
      (this.memory[col] as Map<string, unknown>).clear();
    }

    if (this.idb) {
      const allNames = FADFADAH_REALM_SCHEMAS.map((s) => s.name);
      await new Promise<void>((resolve, reject) => {
        const tx = this.idb!.transaction(allNames, 'readwrite');
        for (const name of allNames) {
          tx.objectStore(name).clear();
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    await this.write((tx) => {
      tx.create('app_settings', {
        ...currentSettings,
        auth_token: '',
      });
    });
  }

  exportSnapshotJSON(): string {
    const payload: Record<string, unknown[]> = {};
    for (const schema of FADFADAH_REALM_SCHEMAS) {
      const col = schema.name as RealmCollectionName;
      if (col === 'app_settings') {
        // Mask raw auth_token in exported JSON
        payload[col] = this.objects('app_settings').map((s) => ({ ...s, auth_token: '***' }));
      } else {
        payload[col] = this.objects(col);
      }
    }
    return JSON.stringify(
      {
        engine: 'FadfadahAndroidRealmDB',
        package: 'com.fadfadahnative',
        schemaVersion: this.schemaVersion,
        exportedAt: new Date().toISOString(),
        collections: payload,
      },
      null,
      2
    );
  }

  addListener(cb: () => void): () => void {
    this.listeners.add(cb);
    return () => {
      this.listeners.delete(cb);
    };
  }

  private notify(): void {
    for (const cb of this.listeners) {
      cb();
    }
  }
}

export const realmDB = new LocalRealmDB();
