import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';
import {
  computeServerEmbedding,
  cosineSimilarityServer,
  serverDB,
  type ChatRoomStatus,
  type MediaType,
  type ServerChatRoom,
  type ServerMessage,
  type ServerUserRecord,
  type ServerReportModeration,
  type ServerModerationAction,
  type ServerPaymentTransaction,
  type UserRole,
  type AccountStatus,
  type ReportTargetType,
  type ReportStatus,
} from './server/fadfadahServerDB.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Optional Gemini AI upgrade (server works 100% standalone without any API key too!)
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Standalone Built-in Arabic & English Safety Filter
const SEVERE_PATTERNS = [
  /انتحار|أقتلك|سأقتلك|تهديد|ابتزاز|مخدرات/i,
  /\b(kill you|suicide|blackmail|doxx|bomb)\b/i,
  /\b(\+?\d[\d\s-]{8,14}\d)\b/,
];
const PROFANITY_PATTERNS = [
  /غبي|أحمق|حيوان|تافه|لعنة|قذر/i,
  /\b(idiot|stupid|loser|shut up|trash)\b/i,
];

interface ModerationVerdict {
  flagScore: number;
  isFrozen: boolean;
  reasonAr: string;
  reasonEn: string;
}

async function moderateServerContent(
  text: string,
  imageBase64?: string,
  mimeType?: string
): Promise<ModerationVerdict> {
  const clean = text.trim();
  for (const pat of SEVERE_PATTERNS) {
    if (pat.test(clean)) {
      return {
        flagScore: 0.92,
        isFrozen: true,
        reasonAr: 'تم تجميد الرسالة لاحتوائها على تهديد أو مشاركة أرقام وبيانات حساسة.',
        reasonEn: 'Message frozen due to threat or sensitive personal contact information.',
      };
    }
  }
  for (const pat of PROFANITY_PATTERNS) {
    if (pat.test(clean)) {
      return {
        flagScore: 0.79,
        isFrozen: true,
        reasonAr: 'تم حجب الرسالة لاحتوائها على ألفاظ مسيئة مخالفة لإرشادات فضفضة.',
        reasonEn: 'Message blocked due to offensive language.',
      };
    }
  }

  const ai = getAiClient();
  if (!ai) {
    return { flagScore: 0.02, isFrozen: false, reasonAr: '', reasonEn: '' };
  }

  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imageBase64 && mimeType) {
      const rawData = imageBase64.includes(',') ? imageBase64.split(',')[1] : imageBase64;
      parts.push({ inlineData: { mimeType, data: rawData } });
    }
    parts.push({
      text: `Analyze this anonymous chat content for harassment, threats, explicit abuse, or sensitive personal phone/address sharing. Normal sadness or emotional venting is SAFE. Text: "${clean}"`,
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: { parts },
      config: {
        abortSignal: AbortSignal.timeout(2500),
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            flagScore: { type: Type.NUMBER },
            isFrozen: { type: Type.BOOLEAN },
            reasonAr: { type: Type.STRING },
            reasonEn: { type: Type.STRING },
          },
          required: ['flagScore', 'isFrozen', 'reasonAr', 'reasonEn'],
        },
      },
    });
    const parsed = JSON.parse((response.text ?? '{}').trim()) as Partial<ModerationVerdict>;
    if (typeof parsed.flagScore === 'number') {
      return {
        flagScore: Number(parsed.flagScore.toFixed(2)),
        isFrozen: Boolean(parsed.isFrozen || parsed.flagScore >= 0.72),
        reasonAr: parsed.reasonAr ?? '',
        reasonEn: parsed.reasonEn ?? '',
      };
    }
  } catch {
    // Fallback cleanly to standalone local verdict
  }

  return { flagScore: 0.02, isFrozen: false, reasonAr: '', reasonEn: '' };
}

function extractBearerToken(req: Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  return header.slice(7).trim();
}

function secureSecretMatches(provided: string, configured: string): boolean {
  const providedBuffer = Buffer.from(provided, 'utf8');
  const configuredBuffer = Buffer.from(configured, 'utf8');
  return (
    configuredBuffer.length >= 32 &&
    providedBuffer.length === configuredBuffer.length &&
    crypto.timingSafeEqual(providedBuffer, configuredBuffer)
  );
}

function formatRoomForUser(room: ServerChatRoom, viewerId: string) {
  return {
    id: room.id,
    type: room.type,
    participant_a: room.participant_a,
    participant_b: room.participant_b,
    status: room.status,
    unread_count: room.participant_a === viewerId ? room.unread_a : room.unread_b,
    last_message_preview: room.last_message_preview,
    last_message_at: room.last_message_at,
    created_at: room.created_at,
  };
}

const FRAME_POINTS_COST: Record<number, { cost: number; vipOnly: boolean }> = {
  0: { cost: 0, vipOnly: false },
  1: { cost: 0, vipOnly: false },
  2: { cost: 150, vipOnly: false },
  3: { cost: 250, vipOnly: false },
  4: { cost: 400, vipOnly: true },
  5: { cost: 500, vipOnly: true },
};

async function startServer() {
  await serverDB.init();

  const app = express();
  const httpServer = http.createServer(app);

  // Full CORS support for Capacitor Android APK (https://localhost, capacitor://localhost, LAN IPs)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  // Live WebSocket Connection Registry & Real Matchmaking Queue
  const activeSockets = new Map<string, Set<WebSocket>>(); // userId -> sockets
  const matchQueue = new Map<
    string,
    { countryFilter: string; langFilter: string; joinedAt: number }
  >();

  function isUserOnline(userId: string): boolean {
    const set = activeSockets.get(userId);
    return Boolean(set && set.size > 0);
  }

  function sendToUser(userId: string, eventPayload: Record<string, unknown>): void {
    const set = activeSockets.get(userId);
    if (!set) return;
    const raw = JSON.stringify(eventPayload);
    for (const ws of set) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(raw);
      }
    }
  }

  function broadcastAll(eventPayload: Record<string, unknown>): void {
    const raw = JSON.stringify(eventPayload);
    for (const set of activeSockets.values()) {
      for (const ws of set) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(raw);
        }
      }
    }
  }

  function broadcastStaff(eventPayload: Record<string, unknown>): void {
    const raw = JSON.stringify(eventPayload);
    for (const [userId, set] of activeSockets.entries()) {
      const user = serverDB.users.get(userId);
      if (user && (user.role === 'owner' || user.role === 'moderator')) {
        for (const ws of set) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(raw);
          }
        }
      }
    }
  }

  function broadcastOnlinePresence(): void {
    const onlineUsers = Array.from(activeSockets.keys())
      .filter((uid) => isUserOnline(uid))
      .map((uid) => serverDB.users.get(uid))
      .filter((u): u is ServerUserRecord => Boolean(u))
      .map((u) => serverDB.toPublicUser(u, true));

    broadcastAll({
      type: 'presence:online_users',
      users: onlineUsers,
    });
  }

  function pushLiveCandidatesToUser(viewer: ServerUserRecord, countryFilter: string, langFilter: string): void {
    const candidates = Array.from(serverDB.users.values())
      .filter((u) => {
        if (u.id === viewer.id) return false;
        if (viewer.blocked_user_ids.includes(u.id) || u.blocked_user_ids.includes(viewer.id)) {
          return false;
        }
        if (u.status === 'banned' || u.status === 'suspended') return false;
        if (countryFilter !== 'ALL' && u.country !== countryFilter) return false;
        if (langFilter !== 'ALL' && !u.languages.includes(langFilter)) return false;
        return true;
      })
      .map((peer) => {
        const online = isUserOnline(peer.id);
        const inQueue = matchQueue.has(peer.id);
        const sim = cosineSimilarityServer(viewer.embedding_vector, peer.embedding_vector);
        const priorityScore =
          sim * 0.65 +
          (inQueue ? 0.25 : 0) +
          (online ? 0.12 : 0) +
          (peer.is_premium ? 0.15 : 0);
        return {
          peer: serverDB.toPublicUser(peer, online),
          inQueue,
          similarityScore: Number(Math.min(0.99, Math.max(0.4, priorityScore)).toFixed(2)),
        };
      })
      .sort((a, b) => b.similarityScore - a.similarityScore)
      .slice(0, 30);

    sendToUser(viewer.id, {
      type: 'match:candidates',
      candidates,
      queueSize: matchQueue.size,
      onlineCount: activeSockets.size,
    });
  }

  function refreshLiveCandidatesForQueuedUsers(): void {
    for (const [userId, criteria] of matchQueue.entries()) {
      const viewer = serverDB.users.get(userId);
      if (!viewer || !isUserOnline(userId)) {
        matchQueue.delete(userId);
        continue;
      }
      pushLiveCandidatesToUser(viewer, criteria.countryFilter, criteria.langFilter);
    }
  }

  // WebSocket Server mounted on /ws
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    if (reqUrl.pathname === '/ws') {
      wss.handleUpgrade(request, socket, head, (ws: WebSocket) => {
        wss.emit('connection', ws, request);
      });
    }
  });

  wss.on('connection', (ws: WebSocket, request: http.IncomingMessage) => {
    const reqUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    const token = reqUrl.searchParams.get('token') || undefined;
    const user = serverDB.authenticateToken(token);

    if (!user) {
      ws.close(4001, 'Unauthorized');
      return;
    }

    if (user.status === 'banned') {
      ws.close(4003, 'Account Banned');
      return;
    }

    user.last_seen_at = Date.now();
    if (!activeSockets.has(user.id)) {
      activeSockets.set(user.id, new Set());
    }
    activeSockets.get(user.id)!.add(ws);
    broadcastOnlinePresence();
    refreshLiveCandidatesForQueuedUsers();

    ws.on('message', (rawBuf: any) => {
      try {
        const msg = JSON.parse(String(rawBuf)) as {
          type: string;
          roomId?: string;
          isTyping?: boolean;
          countryFilter?: string;
          langFilter?: string;
        };

        const freshUser = serverDB.users.get(user.id);
        if (!freshUser || freshUser.status === 'banned' || freshUser.status === 'suspended') return;

        if (msg.type === 'typing' && msg.roomId) {
          const room = serverDB.chatRooms.get(msg.roomId);
          if (!room || room.status !== 'ACCEPTED') return;
          if (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id) return;
          const peerId =
            room.participant_a === freshUser.id ? room.participant_b : room.participant_a;
          sendToUser(peerId, {
            type: 'typing',
            roomId: room.id,
            userId: freshUser.id,
            isTyping: Boolean(msg.isTyping),
          });
        } else if (msg.type === 'match:join_queue') {
          if (freshUser.status === 'restricted') return;
          const cf = msg.countryFilter || 'ALL';
          const lf = msg.langFilter || 'ALL';
          matchQueue.set(freshUser.id, {
            countryFilter: cf,
            langFilter: lf,
            joinedAt: Date.now(),
          });
          refreshLiveCandidatesForQueuedUsers();
        } else if (msg.type === 'match:leave_queue') {
          if (matchQueue.delete(freshUser.id)) {
            refreshLiveCandidatesForQueuedUsers();
          }
        }
      } catch {
        // Ignore
      }
    });

    ws.on('close', () => {
      const set = activeSockets.get(user.id);
      if (set) {
        set.delete(ws);
        if (set.size === 0) {
          activeSockets.delete(user.id);
          matchQueue.delete(user.id);
        }
      }
      const existing = serverDB.users.get(user.id);
      if (existing) {
        existing.last_seen_at = Date.now();
        serverDB.scheduleSave();
      }
      broadcastOnlinePresence();
      refreshLiveCandidatesForQueuedUsers();
    });
  });

  // ============================================================================
  // RBAC & STATUS MIDDLEWARE HELPERS
  // ============================================================================

  function verifyAccountActive(user: ServerUserRecord, res: Response): boolean {
    if (user.status === 'banned') {
      res.status(403).json({
        error: 'ACCOUNT_BANNED',
        banReason: user.ban_reason || 'تم حظر حسابك لمخالفة شروط الاستخدام وقواعد الأمان.',
      });
      return false;
    }
    if (user.status === 'suspended') {
      if (user.suspension_until && user.suspension_until > Date.now()) {
        const remainingHours = Math.ceil((user.suspension_until - Date.now()) / 3600000);
        res.status(403).json({
          error: 'ACCOUNT_SUSPENDED',
          suspensionUntil: user.suspension_until,
          banReason:
            user.ban_reason ||
            `تم تعليق حسابك مؤقتاً لمدة ${remainingHours} ساعة لمراجعة مخالفة إشرافية.`,
        });
        return false;
      } else {
        user.status = 'active';
        user.suspension_until = undefined;
        serverDB.scheduleSave();
      }
    }
    return true;
  }

  // ============================================================================
  // REST API ROUTES
  // ============================================================================

  // Health & Server Info
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      package: 'com.fadfadahnative',
      version: '3.10.1',
      onlineUsers: activeSockets.size,
      totalRegisteredUsers: serverDB.users.size,
    });
  });

  // 1. Register new real device account
  app.post('/api/auth/register', (req: Request, res: Response) => {
    const { nickname, avatar_url, country, languages, interests } = (req.body || {}) as {
      nickname?: string;
      avatar_url?: string;
      country?: string;
      languages?: string[];
      interests?: string[];
    };

    const { user, link, rawToken, recoveryCode } = serverDB.registerNewUser({
      nickname,
      avatar_url,
      country,
      languages,
      interests,
    });

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      ...safeSelf
    } = user;
    res.json({
      authToken: rawToken,
      recoveryCode,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
      personalLink: link,
    });

  });

  app.post('/api/auth/recover', (req: Request, res: Response) => {
    const recoveryCode =
      typeof req.body?.recoveryCode === 'string'
        ? req.body.recoveryCode.trim().toLowerCase()
        : '';
    if (!/^[a-f0-9]{64}$/.test(recoveryCode)) {
      res.status(401).json({ error: 'INVALID_RECOVERY_CODE' });
      return;
    }

    const recovered = serverDB.recoverAccount(recoveryCode);
    if (!recovered) {
      res.status(401).json({ error: 'INVALID_RECOVERY_CODE' });
      return;
    }

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      ...safeSelf
    } = recovered.user;
    res.json({
      authToken: recovered.rawToken,
      recoveryCode: recovered.recoveryCode,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
      personalLink: recovered.link,
    });
  });

  // 2. Full state sync on launch / reconnect
  app.get('/api/sync', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const link = serverDB.getLinkForUser(user.id);
    const myRooms = Array.from(serverDB.chatRooms.values())
      .filter((r) => r.participant_a === user.id || r.participant_b === user.id)
      .map((r) => formatRoomForUser(r, user.id));

    const myRoomIds = new Set(myRooms.map((r) => r.id));
    const myMessages = Array.from(serverDB.messages.values()).filter((m) =>
      myRoomIds.has(m.room_id)
    );

    const peerIds = new Set<string>();
    for (const r of myRooms) {
      peerIds.add(r.participant_a === user.id ? r.participant_b : r.participant_a);
    }
    for (const v of serverDB.publicVents.values()) {
      peerIds.add(v.author_id);
    }
    for (const onlineUid of activeSockets.keys()) {
      peerIds.add(onlineUid);
    }
    for (const u of serverDB.users.values()) {
      peerIds.add(u.id);
    }
    peerIds.delete(user.id);

    const peerProfiles = Array.from(peerIds)
      .map((pid) => serverDB.users.get(pid))
      .filter((p): p is ServerUserRecord => Boolean(p))
      .map((p) => serverDB.toPublicUser(p, isUserOnline(p.id)));

    const vents = Array.from(serverDB.publicVents.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 100)
      .map((v) => ({
        id: v.id,
        author_id: v.author_id,
        topic: v.topic,
        content: v.content,
        likes_count: v.liked_user_ids.length,
        liked_by_me: v.liked_user_ids.includes(user.id),
        ai_flag_score: v.ai_flag_score,
        created_at: v.created_at,
      }));

    const myPayments = Array.from(serverDB.paymentTransactions.values())
      .filter((tx) => tx.user_id === user.id)
      .sort((a, b) => b.created_at - a.created_at);

    const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
    res.json({
      selfUser: { ...safeSelf, is_self: true, is_online: true },
      personalLink: link,
      rooms: myRooms,
      messages: myMessages,
      peers: peerProfiles,
      vents,
      payments: myPayments,
    });
  });

  // 3. Update Profile & Custom Personal Link Slug
  app.put('/api/profile', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const { nickname, slug, country, bio, avatar_url, frame_id, interests, languages } =
      req.body as {
        nickname?: string;
        slug?: string;
        country?: string;
        bio?: string;
        avatar_url?: string;
        frame_id?: number;
        interests?: string[];
        languages?: string[];
      };

    const textToCheck = `${nickname ?? user.nickname} ${bio ?? user.bio}`;
    const isCustomImg = avatar_url?.startsWith('data:image/');
    const mod = await moderateServerContent(
      textToCheck,
      isCustomImg ? avatar_url : undefined,
      isCustomImg ? avatar_url?.slice(5, avatar_url.indexOf(';')) : undefined
    );
    if (mod.isFrozen) {
      res.status(400).json({ error: mod.reasonAr || 'بيانات الملف الشخصي مخالفة لإرشادات الأمان.' });
      return;
    }

    if (nickname?.trim()) user.nickname = nickname.trim().slice(0, 24);
    if (country) user.country = country.slice(0, 32);
    if (typeof bio === 'string') user.bio = bio.trim().slice(0, 120);
    if (avatar_url) user.avatar_url = avatar_url;
    if (typeof frame_id === 'number' && (user.is_premium || user.unlocked_frames.includes(frame_id))) {
      user.frame_id = frame_id;
    }
    if (Array.isArray(interests) && interests.length > 0) {
      user.interests = interests.slice(0, 12);
    }
    if (Array.isArray(languages) && languages.length > 0) {
      user.languages = languages.slice(0, 5);
    }
    user.embedding_vector = computeServerEmbedding(user.interests, user.languages);

    const link = serverDB.getLinkForUser(user.id);
    if (link && slug?.trim()) {
      const oldSlug = link.slug.toLowerCase();
      const uniqueSlug = serverDB.reserveUniqueSlug(slug, user.id);
      serverDB.slugIndex.delete(oldSlug);
      link.slug = uniqueSlug;
      serverDB.slugIndex.set(uniqueSlug, link.id);
    }

    serverDB.scheduleSave();
    broadcastAll({
      type: 'peer:updated',
      peer: serverDB.toPublicUser(user, isUserOnline(user.id)),
    });

    const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
    res.json({
      selfUser: { ...safeSelf, is_self: true, is_online: true },
      personalLink: link,
    });
  });

  // 4. Lookup Public Personal Link (/api/links/:slug)
  app.get('/api/links/:slug', (req: Request, res: Response) => {
    const link = serverDB.getLinkBySlug(req.params.slug || '');
    if (!link || !link.is_active) {
      res.status(404).json({ error: 'LINK_NOT_FOUND' });
      return;
    }
    const targetUser = serverDB.users.get(link.user_id);
    if (!targetUser || targetUser.status === 'banned') {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    link.visits_count += 1;
    serverDB.scheduleSave();

    sendToUser(targetUser.id, {
      type: 'link:updated',
      personalLink: link,
    });

    res.json({
      slug: link.slug,
      visits_count: link.visits_count,
      targetUser: serverDB.toPublicUser(targetUser, isUserOnline(targetUser.id)),
    });
  });

  // 5. Send Real Anonymous Message via Personal Link
  app.post('/api/links/:slug/send', async (req: Request, res: Response) => {
    const link = serverDB.getLinkBySlug(req.params.slug || '');
    if (!link || !link.is_active) {
      res.status(404).json({ error: 'الرابط الشخصي غير موجود أو غير مفعل.' });
      return;
    }
    const recipient = serverDB.users.get(link.user_id);
    if (!recipient || recipient.status === 'banned') {
      res.status(404).json({ error: 'صاحب الرابط غير موجود.' });
      return;
    }

    const { content, senderAlias, senderAvatar } = (req.body || {}) as {
      content?: string;
      senderAlias?: string;
      senderAvatar?: string;
    };
    const cleanText = (content || '').trim().slice(0, 1500);
    if (!cleanText) {
      res.status(400).json({ error: 'نص الرسالة مطلوب.' });
      return;
    }

    const mod = await moderateServerContent(cleanText);
    if (mod.isFrozen) {
      res.status(400).json({ error: mod.reasonAr, reasonEn: mod.reasonEn, isFrozen: true });
      return;
    }

    let sender = serverDB.authenticateToken(extractBearerToken(req));
    let issuedToken: string | undefined;
    let issuedLink = sender ? serverDB.getLinkForUser(sender.id) : undefined;

    if (!sender || sender.id === recipient.id) {
      const reg = serverDB.registerNewUser({
        nickname: senderAlias?.trim() || `زائر_${Math.floor(100 + Math.random() * 899)}`,
        avatar_url: senderAvatar || 'moon',
      });
      sender = reg.user;
      issuedToken = reg.rawToken;
      issuedLink = reg.link;
    } else {
      if (!verifyAccountActive(sender, res)) return;
      if (senderAlias?.trim()) {
        sender.nickname = senderAlias.trim().slice(0, 24);
        if (senderAvatar) sender.avatar_url = senderAvatar;
      }
    }

    if (recipient.blocked_user_ids.includes(sender.id)) {
      res.status(403).json({ error: 'لا يمكن إرسال رسالة لهذا المستخدم.' });
      return;
    }

    const now = Date.now();
    const roomId = `room-link-${crypto.randomUUID().slice(0, 8)}`;
    const room: ServerChatRoom = {
      id: roomId,
      type: 'LINK_BASED',
      participant_a: recipient.id,
      participant_b: sender.id,
      status: 'ACCEPTED',
      unread_a: 1,
      unread_b: 0,
      last_message_preview: cleanText,
      last_message_at: now,
      created_at: now,
    };

    const msgId = `msg-${crypto.randomUUID().slice(0, 8)}`;
    const message: ServerMessage = {
      id: msgId,
      room_id: roomId,
      sender_id: sender.id,
      content: cleanText,
      media_url: '',
      media_type: 'text',
      ai_flag_score: mod.flagScore,
      ai_flag_reason: '',
      is_frozen: false,
      status: 'SENT',
      created_at: now,
    };

    serverDB.chatRooms.set(room.id, room);
    serverDB.messages.set(message.id, message);
    serverDB.scheduleSave();

    sendToUser(recipient.id, {
      type: 'room:upsert',
      room: formatRoomForUser(room, recipient.id),
      peer: serverDB.toPublicUser(sender, isUserOnline(sender.id)),
      message,
    });

    sendToUser(sender.id, {
      type: 'room:upsert',
      room: formatRoomForUser(room, sender.id),
      peer: serverDB.toPublicUser(recipient, isUserOnline(recipient.id)),
      message,
    });

    const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSender } = sender;
    res.json({
      room: formatRoomForUser(room, sender.id),
      message,
      recipientPeer: serverDB.toPublicUser(recipient, isUserOnline(recipient.id)),
      issuedAuthToken: issuedToken,
      issuedSelfUser: issuedToken ? { ...safeSender, is_self: true, is_online: true } : undefined,
      issuedPersonalLink: issuedLink,
    });
  });

  // 6. Initiate Real Random Match / Chat Request
  app.post('/api/match/request', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    if (user.status === 'restricted') {
      res.status(403).json({
        error: 'ACCOUNT_RESTRICTED',
        message: 'تم تقييد حسابك من المطابقة العشوائية بقرار إشرافي.',
      });
      return;
    }

    const { targetPeerId, introText } = (req.body || {}) as {
      targetPeerId?: string;
      introText?: string;
    };
    const peer = targetPeerId ? serverDB.users.get(targetPeerId) : undefined;
    if (!peer || peer.id === user.id || peer.status === 'banned') {
      res.status(404).json({ error: 'المستخدم غير متاح حالياً.' });
      return;
    }
    if (user.blocked_user_ids.includes(peer.id) || peer.blocked_user_ids.includes(user.id)) {
      res.status(403).json({ error: 'لا يمكن بدء محادثة مع هذا المستخدم.' });
      return;
    }

    const existingRoom = Array.from(serverDB.chatRooms.values()).find(
      (r) =>
        r.status !== 'BLOCKED' &&
        ((r.participant_a === user.id && r.participant_b === peer.id) ||
          (r.participant_b === user.id && r.participant_a === peer.id))
    );

    if (existingRoom) {
      if (existingRoom.status === 'PENDING' && existingRoom.participant_b === user.id) {
        existingRoom.status = 'ACCEPTED';
        serverDB.scheduleSave();
        sendToUser(peer.id, {
          type: 'room:upsert',
          room: formatRoomForUser(existingRoom, peer.id),
          peer: serverDB.toPublicUser(user, isUserOnline(user.id)),
        });
      }
      res.json({
        room: formatRoomForUser(existingRoom, user.id),
        peer: serverDB.toPublicUser(peer, isUserOnline(peer.id)),
      });
      return;
    }

    // Free Tier Daily Quota: 5/day unless Premium
    const todayStr = new Date().toISOString().slice(0, 10);
    const usedToday = user.last_random_date === todayStr ? user.daily_random_count : 0;
    if (!user.is_premium && usedToday >= 5) {
      res.status(429).json({ error: 'DAILY_QUOTA_REACHED' });
      return;
    }

    user.daily_random_count = usedToday + 1;
    user.last_random_date = todayStr;

    const bothInLiveQueue = matchQueue.has(user.id) && matchQueue.has(peer.id);
    const initialStatus: ChatRoomStatus = bothInLiveQueue ? 'ACCEPTED' : 'PENDING';
    if (bothInLiveQueue) {
      matchQueue.delete(user.id);
      matchQueue.delete(peer.id);
    }

    const now = Date.now();
    const roomId = `room-rand-${crypto.randomUUID().slice(0, 8)}`;
    const cleanIntro =
      (introText || '').trim().slice(0, 500) ||
      `طلب محادثة عشوائية من ${user.nickname}`;

    const room: ServerChatRoom = {
      id: roomId,
      type: 'RANDOM',
      participant_a: user.id,
      participant_b: peer.id,
      status: initialStatus,
      unread_a: 0,
      unread_b: 1,
      last_message_preview: cleanIntro,
      last_message_at: now,
      created_at: now,
    };

    const msg: ServerMessage = {
      id: `msg-${crypto.randomUUID().slice(0, 8)}`,
      room_id: roomId,
      sender_id: user.id,
      content: cleanIntro,
      media_url: '',
      media_type: 'text',
      ai_flag_score: 0.0,
      ai_flag_reason: '',
      is_frozen: false,
      status: 'SENT',
      created_at: now,
    };

    serverDB.chatRooms.set(room.id, room);
    serverDB.messages.set(msg.id, msg);
    serverDB.scheduleSave();

    sendToUser(peer.id, {
      type: 'room:upsert',
      room: formatRoomForUser(room, peer.id),
      peer: serverDB.toPublicUser(user, isUserOnline(user.id)),
      message: msg,
    });

    const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
    res.json({
      room: formatRoomForUser(room, user.id),
      message: msg,
      peer: serverDB.toPublicUser(peer, isUserOnline(peer.id)),
      selfUser: { ...safeSelf, is_self: true, is_online: true },
    });
  });

  // 7. Accept or Reject Incoming Chat Request
  app.post('/api/rooms/:roomId/respond', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const room = serverDB.chatRooms.get(req.params.roomId || '');
    if (!room || (room.participant_a !== user.id && room.participant_b !== user.id)) {
      res.status(404).json({ error: 'ROOM_NOT_FOUND' });
      return;
    }

    const { action } = (req.body || {}) as { action?: 'ACCEPT' | 'REJECT' };
    const peerId = room.participant_a === user.id ? room.participant_b : room.participant_a;

    if (action === 'REJECT') {
      serverDB.chatRooms.delete(room.id);
      for (const [mId, m] of serverDB.messages.entries()) {
        if (m.room_id === room.id) serverDB.messages.delete(mId);
      }
      serverDB.scheduleSave();
      sendToUser(peerId, { type: 'room:deleted', roomId: room.id });
      res.json({ deleted: true, roomId: room.id });
      return;
    }

    room.status = 'ACCEPTED';
    if (room.participant_a === user.id) room.unread_a = 0;
    else room.unread_b = 0;
    serverDB.scheduleSave();

    const peer = serverDB.users.get(peerId);
    sendToUser(peerId, {
      type: 'room:upsert',
      room: formatRoomForUser(room, peerId),
      peer: serverDB.toPublicUser(user, isUserOnline(user.id)),
    });

    res.json({
      room: formatRoomForUser(room, user.id),
      peer: peer ? serverDB.toPublicUser(peer, isUserOnline(peer.id)) : undefined,
    });
  });

  // 8. Send Real Message in Room
  app.post('/api/rooms/:roomId/messages', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const room = serverDB.chatRooms.get(req.params.roomId || '');
    if (!room || room.status === 'BLOCKED') {
      res.status(404).json({ error: 'المحادثة غير متاحة.' });
      return;
    }
    if (room.participant_a !== user.id && room.participant_b !== user.id) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    if (room.status !== 'ACCEPTED') {
      res.status(409).json({ error: 'ROOM_NOT_ACCEPTED' });
      return;
    }

    const { id: clientMsgId, content, media_url, media_type } = (req.body || {}) as {
      id?: string;
      content?: string;
      media_url?: string;
      media_type?: MediaType;
    };

    if (clientMsgId && serverDB.messages.has(clientMsgId)) {
      res.json({ message: serverDB.messages.get(clientMsgId), room: formatRoomForUser(room, user.id) });
      return;
    }

    const cleanContent = (content || '').trim().slice(0, 2000);
    const mType: MediaType = media_type || 'text';
    if (!cleanContent && !media_url) {
      res.status(400).json({ error: 'EMPTY_MESSAGE' });
      return;
    }

    const isImg = mType === 'image' && media_url?.startsWith('data:image/');
    const mod =
      mType === 'sticker'
        ? { flagScore: 0, isFrozen: false, reasonAr: '', reasonEn: '' }
        : await moderateServerContent(
            cleanContent,
            isImg ? media_url : undefined,
            isImg ? media_url?.slice(5, media_url.indexOf(';')) : undefined
          );

    const now = Date.now();
    const message: ServerMessage = {
      id: clientMsgId && /^[a-zA-Z0-9_-]{4,64}$/.test(clientMsgId)
        ? clientMsgId
        : `msg-${crypto.randomUUID().slice(0, 8)}`,
      room_id: room.id,
      sender_id: user.id,
      content: cleanContent || 'صورة مرفقة',
      media_url: mod.isFrozen ? '' : media_url || '',
      media_type: mType,
      ai_flag_score: mod.flagScore,
      ai_flag_reason: mod.reasonAr,
      is_frozen: mod.isFrozen,
      status: 'SENT',
      created_at: now,
    };

    serverDB.messages.set(message.id, message);

    const peerId = room.participant_a === user.id ? room.participant_b : room.participant_a;
    if (!mod.isFrozen) {
      room.last_message_preview = message.content;
      room.last_message_at = now;
      if (room.participant_a === peerId) room.unread_a += 1;
      else room.unread_b += 1;
    }

    serverDB.scheduleSave();

    if (!mod.isFrozen) {
      sendToUser(peerId, {
        type: 'message:created',
        message,
        room: formatRoomForUser(room, peerId),
        senderPeer: serverDB.toPublicUser(user, true),
      });
    }

    sendToUser(user.id, {
      type: 'message:created',
      message,
      room: formatRoomForUser(room, user.id),
    });

    res.json({
      message,
      room: formatRoomForUser(room, user.id),
    });
  });

  // 9. Mark Room Messages as READ
  app.post('/api/rooms/:roomId/read', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const room = serverDB.chatRooms.get(req.params.roomId || '');
    if (!room || (room.participant_a !== user.id && room.participant_b !== user.id)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    if (room.participant_a === user.id) room.unread_a = 0;
    else room.unread_b = 0;

    const updatedIds: string[] = [];
    for (const m of serverDB.messages.values()) {
      if (m.room_id === room.id && m.sender_id !== user.id && m.status !== 'READ') {
        m.status = 'READ';
        updatedIds.push(m.id);
      }
    }
    serverDB.scheduleSave();

    const peerId = room.participant_a === user.id ? room.participant_b : room.participant_a;
    if (updatedIds.length > 0) {
      sendToUser(peerId, {
        type: 'messages:read',
        roomId: room.id,
        messageIds: updatedIds,
      });
    }

    res.json({ ok: true, room: formatRoomForUser(room, user.id) });
  });

  // 10. Block User Permanently
  app.post('/api/rooms/:roomId/block', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const room = serverDB.chatRooms.get(req.params.roomId || '');
    if (!room || (room.participant_a !== user.id && room.participant_b !== user.id)) {
      res.status(404).json({ error: 'NOT_FOUND' });
      return;
    }

    const peerId = room.participant_a === user.id ? room.participant_b : room.participant_a;
    room.status = 'BLOCKED';
    if (!user.blocked_user_ids.includes(peerId)) {
      user.blocked_user_ids.push(peerId);
    }
    serverDB.scheduleSave();

    sendToUser(peerId, { type: 'room:deleted', roomId: room.id });
    res.json({ ok: true, blockedPeerId: peerId });
  });

  // 11. Submit Real Moderation Report (Against Account, Message, or Vent)
  app.post('/api/reports', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const { roomId, reportedUserId, target_type, target_id, reason, details } = (req.body || {}) as {
      roomId?: string;
      reportedUserId?: string;
      target_type?: ReportTargetType;
      target_id?: string;
      reason?: string;
      details?: string;
    };

    const targetType: ReportTargetType = target_type || 'user';
    const reported = reportedUserId ? serverDB.users.get(reportedUserId) : undefined;
    const reportedNick = reported?.nickname || 'مستخدم غير معروف';

    // Capture comprehensive evidence
    let evidenceItems: Array<{ sender: string; content: string; time?: string }> = [];

    if (targetType === 'message' && target_id) {
      const msg = serverDB.messages.get(target_id);
      if (msg) {
        evidenceItems.push({
          sender: msg.sender_id === user.id ? user.nickname : reportedNick,
          content: msg.content,
          time: new Date(msg.created_at).toISOString(),
        });
      }
    } else if (targetType === 'vent' && target_id) {
      const v = serverDB.publicVents.get(target_id);
      if (v) {
        evidenceItems.push({
          sender: reportedNick,
          content: `[فضفضة عامة - ${v.topic}]: ${v.content}`,
          time: new Date(v.created_at).toISOString(),
        });
      }
    }

    if (roomId) {
      const roomMsgs = Array.from(serverDB.messages.values())
        .filter((m) => m.room_id === roomId)
        .sort((a, b) => a.created_at - b.created_at)
        .slice(-10)
        .map((m) => ({
          sender: m.sender_id === user.id ? user.nickname : reportedNick,
          content: m.content,
          time: new Date(m.created_at).toISOString(),
        }));
      evidenceItems = [...evidenceItems, ...roomMsgs];
    }

    const evidenceStr = JSON.stringify(evidenceItems);
    let aiSummary = `توثيق إشرافي: تم قيد بلاغ ضد (${reportedNick}) بسبب: "${reason || 'مخالفة'}". التفاصيل: "${
      details || 'لا توجد تفاصيل إضافية'
    }". تم حفظ ${evidenceItems.length} أدلة للمراجعة.`;

    const ai = getAiClient();
    if (ai) {
      try {
        const resp = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: `لخص في جملتين موجزتين بالعربية تقريراً إشرافياً مقدماً من "${user.nickname}" ضد "${reportedNick}" لسبب "${reason}" وملاحظات "${details}". الأدلة: ${evidenceStr}`,
          config: {
            abortSignal: AbortSignal.timeout(1800),
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          },
        });
        if (resp.text) aiSummary = resp.text.trim();
      } catch {
        // Fallback cleanly
      }
    }

    const now = Date.now();
    const rep: ServerReportModeration = {
      id: `rep-${crypto.randomUUID().slice(0, 8)}`,
      reporter_id: user.id,
      reporter_nickname: user.nickname,
      reported_user_id: reportedUserId || (reported?.id ?? ''),
      reported_user_nickname: reportedNick,
      room_id: roomId || undefined,
      target_type: targetType,
      target_id: target_id || undefined,
      reason: reason || 'مخالفة سلوك أو محتوى',
      details: details || '',
      evidence_snapshot: evidenceStr,
      ai_summary: aiSummary,
      status: 'PENDING',
      created_at: now,
      updated_at: now,
      action_taken: 'none',
    };

    serverDB.reports.set(rep.id, rep);
    serverDB.scheduleSave();

    // Push instant real-time notification to all active staff (Owner & Moderators)
    broadcastStaff({
      type: 'report:new',
      report: rep,
    });

    res.json({ report: rep });
  });

  // 12. Public Venting Wall: Publish, Like
  app.post('/api/vents', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    if (user.status === 'restricted') {
      res.status(403).json({
        error: 'ACCOUNT_RESTRICTED',
        message: 'تم تقييد حسابك من نشر الفضفضة العامة بقرار إشرافي.',
      });
      return;
    }

    const { topic, content } = (req.body || {}) as { topic?: string; content?: string };
    const clean = (content || '').trim().slice(0, 1200);
    if (!clean) {
      res.status(400).json({ error: 'EMPTY_CONTENT' });
      return;
    }

    const mod = await moderateServerContent(clean);
    if (mod.isFrozen) {
      res.status(400).json({ error: mod.reasonAr, isFrozen: true });
      return;
    }

    const vent = {
      id: `vent-${crypto.randomUUID().slice(0, 8)}`,
      author_id: user.id,
      topic: (topic || 'فضفضة').slice(0, 32),
      content: clean,
      liked_user_ids: [] as string[],
      ai_flag_score: mod.flagScore,
      created_at: Date.now(),
    };
    serverDB.publicVents.set(vent.id, vent);
    serverDB.scheduleSave();

    broadcastAll({
      type: 'vent:upsert',
      vent: {
        id: vent.id,
        author_id: vent.author_id,
        topic: vent.topic,
        content: vent.content,
        likes_count: 0,
        ai_flag_score: vent.ai_flag_score,
        created_at: vent.created_at,
      },
      authorPeer: serverDB.toPublicUser(user, true),
    });

    res.json({
      vent: {
        ...vent,
        likes_count: 0,
        liked_by_me: false,
      },
    });
  });

  app.post('/api/vents/:ventId/like', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const vent = serverDB.publicVents.get(req.params.ventId || '');
    if (!vent) {
      res.status(404).json({ error: 'VENT_NOT_FOUND' });
      return;
    }

    const idx = vent.liked_user_ids.indexOf(user.id);
    if (idx >= 0) vent.liked_user_ids.splice(idx, 1);
    else vent.liked_user_ids.push(user.id);
    serverDB.scheduleSave();

    broadcastAll({
      type: 'vent:likes_updated',
      ventId: vent.id,
      likes_count: vent.liked_user_ids.length,
    });

    res.json({
      ventId: vent.id,
      likes_count: vent.liked_user_ids.length,
      liked_by_me: vent.liked_user_ids.includes(user.id),
    });
  });

  // ============================================================================
  // 13. PAYMENTS (disabled until server-side provider verification is configured)
  // ============================================================================

  app.post('/api/payments/checkout', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    res.status(503).json({ error: 'PAYMENT_VERIFICATION_NOT_CONFIGURED' });
  });

  // Server-Authoritative Points Spending (Frame Purchase or Quota Unlock)
  app.post('/api/payments/spend', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const { action, frameId } = (req.body || {}) as {
      action?: 'UNLOCK_FRAME' | 'UNLOCK_QUOTA';
      frameId?: number;
    };

    const now = Date.now();

    if (action === 'UNLOCK_FRAME' && typeof frameId === 'number') {
      const frameConfig = FRAME_POINTS_COST[frameId];
      if (!frameConfig) {
        res.status(400).json({ error: 'INVALID_FRAME' });
        return;
      }
      if (frameConfig.vipOnly && !user.is_premium) {
        res.status(403).json({ error: 'VIP_FRAME_REQUIRED' });
        return;
      }

      const cost = frameConfig.cost;
      if (user.points < cost) {
        res.status(400).json({ error: 'INSUFFICIENT_POINTS', required: cost, current: user.points });
        return;
      }

      user.points -= cost;
      if (!user.unlocked_frames.includes(frameId)) {
        user.unlocked_frames.push(frameId);
      }
      user.frame_id = frameId;

      const tx: ServerPaymentTransaction = {
        id: `tx-${crypto.randomUUID().slice(0, 8)}`,
        user_id: user.id,
        user_nickname: user.nickname,
        type: 'FRAME_PURCHASE',
        item_id: `frame_${frameId}`,
        item_title: `فتح إطار رقم ${frameId}`,
        amount_usd: 0,
        points_delta: -cost,
        status: 'COMPLETED',
        order_id: `DEBIT-FRAME-${now}`,
        idempotency_key: `debit-frame-${user.id}-${frameId}-${now}`,
        created_at: now,
      };
      serverDB.paymentTransactions.set(tx.id, tx);
      serverDB.scheduleSave();

      const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
      res.json({ ok: true, transaction: tx, selfUser: { ...safeSelf, is_self: true, is_online: true } });
      return;
    } else if (action === 'UNLOCK_QUOTA') {
      const cost = 50;
      if (user.points < cost) {
        res.status(400).json({ error: 'INSUFFICIENT_POINTS', required: cost, current: user.points });
        return;
      }

      user.points -= cost;
      user.daily_random_count = Math.max(0, user.daily_random_count - 3);

      const tx: ServerPaymentTransaction = {
        id: `tx-${crypto.randomUUID().slice(0, 8)}`,
        user_id: user.id,
        user_nickname: user.nickname,
        type: 'QUOTA_UNLOCK',
        item_id: 'quota_3_matches',
        item_title: 'فتح 3 مطابقات عشوائية إضافية',
        amount_usd: 0,
        points_delta: -cost,
        status: 'COMPLETED',
        order_id: `DEBIT-QUOTA-${now}`,
        idempotency_key: `debit-quota-${user.id}-${now}`,
        created_at: now,
      };
      serverDB.paymentTransactions.set(tx.id, tx);
      serverDB.scheduleSave();

      const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
      res.json({ ok: true, transaction: tx, selfUser: { ...safeSelf, is_self: true, is_online: true } });
      return;
    }

    res.status(400).json({ error: 'UNKNOWN_ACTION' });
  });

  // User Payment History
  app.get('/api/payments/history', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }

    const history = Array.from(serverDB.paymentTransactions.values())
      .filter((tx) => tx.user_id === user.id)
      .sort((a, b) => b.created_at - a.created_at);

    res.json({ transactions: history });
  });

  // ============================================================================
  // 14. ADMIN & MODERATION DASHBOARD (STRICT SERVER-LEVEL RBAC PROTECTION)
  // ============================================================================

  app.post('/api/admin/owner-recovery', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const configured = process.env.OWNER_RECOVERY_TOKEN?.trim() || '';
    if (Buffer.byteLength(configured, 'utf8') < 32) {
      res.status(503).json({ error: 'OWNER_RECOVERY_NOT_CONFIGURED' });
      return;
    }
    if (serverDB.ownerRecoveryCompleted) {
      res.status(403).json({ error: 'OWNER_RECOVERY_ALREADY_USED' });
      return;
    }

    const recoveryToken =
      typeof req.body?.recoveryToken === 'string' ? req.body.recoveryToken.trim() : '';
    if (!secureSecretMatches(recoveryToken, configured)) {
      res.status(401).json({ error: 'INVALID_RECOVERY_TOKEN' });
      return;
    }
    try {
      if (!(await serverDB.claimReplacementOwner(user.id))) {
        res.status(409).json({ error: 'OWNER_RECOVERY_NOT_AVAILABLE' });
        return;
      }
    } catch (error) {
      console.error('Failed to persist replacement owner recovery:', error);
      res.status(500).json({ error: 'OWNER_RECOVERY_PERSISTENCE_FAILED' });
      return;
    }

    const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
    res.json({
      ok: true,
      role: user.role,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
    });
  });

  // Staff Passcode Verification / Session Elevation
  app.post('/api/admin/staff-verify', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    if (user.role === 'owner' || user.role === 'moderator') {
      const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
      res.json({
        ok: true,
        role: user.role,
        selfUser: { ...safeSelf, is_self: true, is_online: true },
      });
      return;
    }

    const { passcode } = (req.body || {}) as { passcode?: string };
    const configured = process.env.OWNER_BOOTSTRAP_TOKEN?.trim() || '';
    if (serverDB.ownerBootstrapCompleted) {
      res.status(403).json({ error: 'OWNER_ALREADY_CONFIGURED' });
      return;
    }
    if (Buffer.byteLength(configured, 'utf8') < 32) {
      res.status(503).json({ error: 'OWNER_BOOTSTRAP_NOT_CONFIGURED' });
      return;
    }
    if (!secureSecretMatches((passcode || '').trim(), configured)) {
      res.status(401).json({ error: 'INVALID_PASSCODE' });
      return;
    }
    if (!serverDB.claimInitialOwner(user.id)) {
      res.status(403).json({ error: 'OWNER_ALREADY_CONFIGURED' });
      return;
    }

    const { auth_token_hash: _hidden, recovery_code_hash: _recoveryHash, ...safeSelf } = user;
    res.json({
      ok: true,
      role: user.role,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
    });
  });

  // Staff Only: Get All Reports
  app.get('/api/admin/reports', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const reports = Array.from(serverDB.reports.values()).sort(
      (a, b) => b.created_at - a.created_at
    );

    res.json({ reports });
  });

  // Staff Only: Take Moderation Action on Report
  app.post('/api/admin/reports/:reportId/action', (req: Request, res: Response) => {
    const staff = serverDB.authenticateToken(extractBearerToken(req));
    if (!staff || (staff.role !== 'owner' && staff.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const report = serverDB.reports.get(req.params.reportId || '');
    if (!report) {
      res.status(404).json({ error: 'REPORT_NOT_FOUND' });
      return;
    }

    const { action, reason, duration_hours, note } = (req.body || {}) as {
      action?: 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN' | 'RESOLVE' | 'DISMISS';
      reason?: string;
      duration_hours?: number;
      note?: string;
    };

    if (!action) {
      res.status(400).json({ error: 'ACTION_REQUIRED' });
      return;
    }

    const targetUser = serverDB.users.get(report.reported_user_id);
    const now = Date.now();
    const actionReason = reason?.trim() || note?.trim() || `إجراء إشرافي بناءً على بلاغ ${report.id}`;

    let reportStatus: ReportStatus = report.status;
    let actionTakenVal: ServerReportModeration['action_taken'] = 'none';

    if (action === 'DISMISS') {
      reportStatus = 'DISMISSED';
    } else {
      reportStatus = 'ACTION_TAKEN';
    }

    if (targetUser && action !== 'DISMISS') {
      if (action === 'WARN') {
        targetUser.status = 'warned';
        targetUser.warning_message = actionReason;
        actionTakenVal = 'warning';
      } else if (action === 'RESTRICT') {
        targetUser.status = 'restricted';
        targetUser.restriction_reason = actionReason;
        actionTakenVal = 'restriction';
      } else if (action === 'SUSPEND') {
        const hours = duration_hours && duration_hours > 0 ? duration_hours : 24;
        targetUser.status = 'suspended';
        targetUser.suspension_until = now + hours * 3600000;
        targetUser.ban_reason = actionReason;
        actionTakenVal = 'suspension';
      } else if (action === 'BAN') {
        targetUser.status = 'banned';
        targetUser.banned_at = now;
        targetUser.ban_reason = actionReason;
        actionTakenVal = 'ban';
      }
    }

    report.status = reportStatus;
    report.action_taken = actionTakenVal;
    report.updated_at = now;
    report.resolved_by = staff.id;
    report.resolved_by_name = staff.nickname;
    report.resolution_note = note || actionReason;

    // Record in permanent Moderation Audit Log
    const auditAction: ServerModerationAction = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      moderator_id: staff.id,
      moderator_name: staff.nickname,
      moderator_role: staff.role,
      target_user_id: report.reported_user_id,
      target_user_nickname: report.reported_user_nickname,
      report_id: report.id,
      action_type:
        action === 'WARN'
          ? 'WARN'
          : action === 'RESTRICT'
          ? 'RESTRICT'
          : action === 'SUSPEND'
          ? 'SUSPEND'
          : action === 'BAN'
          ? 'BAN'
          : action === 'DISMISS'
          ? 'DISMISS_REPORT'
          : 'RESOLVE_REPORT',
      reason: actionReason,
      duration_hours: duration_hours,
      created_at: now,
    };
    serverDB.moderationActions.set(auditAction.id, auditAction);
    serverDB.scheduleSave();

    // Live WebSocket push to target user if penalized
    if (targetUser) {
      sendToUser(targetUser.id, {
        type: 'account:status_updated',
        status: targetUser.status,
        warning_message: targetUser.warning_message,
        restriction_reason: targetUser.restriction_reason,
        ban_reason: targetUser.ban_reason,
        suspension_until: targetUser.suspension_until,
      });
    }

    // Broadcast updated report & action to all staff
    broadcastStaff({
      type: 'report:updated',
      report,
      auditAction,
    });

    res.json({ ok: true, report, auditAction });
  });

  // Staff Only: Get Audit Logs
  app.get('/api/admin/audit-logs', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const logs = Array.from(serverDB.moderationActions.values()).sort(
      (a, b) => b.created_at - a.created_at
    );

    res.json({ logs });
  });

  // Staff Only: Get Platform Analytics & Metrics
  app.get('/api/admin/stats', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const allUsers = Array.from(serverDB.users.values());
    const reports = Array.from(serverDB.reports.values());
    const payments = Array.from(serverDB.paymentTransactions.values());

    const pendingReports = reports.filter((r) => r.status === 'PENDING').length;
    const resolvedReports = reports.filter((r) => r.status === 'ACTION_TAKEN' || r.status === 'DISMISSED').length;
    const bannedUsers = allUsers.filter((u) => u.status === 'banned').length;
    const suspendedUsers = allUsers.filter((u) => u.status === 'suspended').length;
    const restrictedUsers = allUsers.filter((u) => u.status === 'restricted').length;
    const premiumUsers = allUsers.filter((u) => u.is_premium).length;

    const totalRevenueUsd = payments.reduce((sum, tx) => sum + (tx.amount_usd || 0), 0);

    res.json({
      totalUsers: allUsers.length,
      onlineUsers: activeSockets.size,
      activeChatRooms: serverDB.chatRooms.size,
      totalMessages: serverDB.messages.size,
      totalVents: serverDB.publicVents.size,
      pendingReports,
      resolvedReports,
      totalReports: reports.length,
      bannedUsers,
      suspendedUsers,
      restrictedUsers,
      premiumUsers,
      totalRevenueUsd: Number(totalRevenueUsd.toFixed(2)),
      totalTransactions: payments.length,
    });
  });

  // Staff Only: Get Users List & Direct Status Modification
  app.get('/api/admin/users', (req: Request, res: Response) => {
    const staff = serverDB.authenticateToken(extractBearerToken(req));
    if (!staff || (staff.role !== 'owner' && staff.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const q = ((req.query.q as string) || '').toLowerCase().trim();
    const users = Array.from(serverDB.users.values())
      .filter((u) => {
        if (!q) return true;
        return (
          u.nickname.toLowerCase().includes(q) ||
          u.id.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q)
        );
      })
      .map((u) => ({
        id: u.id,
        nickname: u.nickname,
        avatar_url: u.avatar_url,
        country: u.country,
        role: u.role,
        status: u.status,
        is_premium: u.is_premium,
        premium_plan: u.premium_plan,
        points: u.points,
        warning_message: u.warning_message,
        restriction_reason: u.restriction_reason,
        ban_reason: u.ban_reason,
        suspension_until: u.suspension_until,
        created_at: u.created_at,
        last_seen_at: u.last_seen_at,
      }))
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 100);

    res.json({ users });
  });

  app.post('/api/admin/users/:userId/status', (req: Request, res: Response) => {
    const staff = serverDB.authenticateToken(extractBearerToken(req));
    if (!staff || (staff.role !== 'owner' && staff.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const targetUser = serverDB.users.get(req.params.userId || '');
    if (!targetUser) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }

    const { action, role, reason, duration_hours } = (req.body || {}) as {
      action?: 'ACTIVATE' | 'WARN' | 'RESTRICT' | 'SUSPEND' | 'BAN';
      role?: UserRole;
      reason?: string;
      duration_hours?: number;
    };

    const now = Date.now();
    const actionReason = reason?.trim() || `تحديث إشرافي مباشر بواسطة ${staff.nickname}`;

    if (action === 'ACTIVATE') {
      targetUser.status = 'active';
      targetUser.warning_message = undefined;
      targetUser.restriction_reason = undefined;
      targetUser.ban_reason = undefined;
      targetUser.suspension_until = undefined;
    } else if (action === 'WARN') {
      targetUser.status = 'warned';
      targetUser.warning_message = actionReason;
    } else if (action === 'RESTRICT') {
      targetUser.status = 'restricted';
      targetUser.restriction_reason = actionReason;
    } else if (action === 'SUSPEND') {
      const hours = duration_hours && duration_hours > 0 ? duration_hours : 24;
      targetUser.status = 'suspended';
      targetUser.suspension_until = now + hours * 3600000;
      targetUser.ban_reason = actionReason;
    } else if (action === 'BAN') {
      targetUser.status = 'banned';
      targetUser.banned_at = now;
      targetUser.ban_reason = actionReason;
    }

    // Role modification (Owner only)
    if (role && staff.role === 'owner') {
      targetUser.role = role;
    }

    const auditAction: ServerModerationAction = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      moderator_id: staff.id,
      moderator_name: staff.nickname,
      moderator_role: staff.role,
      target_user_id: targetUser.id,
      target_user_nickname: targetUser.nickname,
      action_type:
        action === 'ACTIVATE'
          ? 'UNBAN'
          : action === 'WARN'
          ? 'WARN'
          : action === 'RESTRICT'
          ? 'RESTRICT'
          : action === 'SUSPEND'
          ? 'SUSPEND'
          : 'BAN',
      reason: actionReason,
      duration_hours,
      created_at: now,
    };
    serverDB.moderationActions.set(auditAction.id, auditAction);
    serverDB.scheduleSave();

    sendToUser(targetUser.id, {
      type: 'account:status_updated',
      status: targetUser.status,
      warning_message: targetUser.warning_message,
      restriction_reason: targetUser.restriction_reason,
      ban_reason: targetUser.ban_reason,
      suspension_until: targetUser.suspension_until,
      role: targetUser.role,
    });

    broadcastStaff({
      type: 'audit:new',
      auditAction,
    });

    res.json({ ok: true, user: serverDB.toPublicUser(targetUser, isUserOnline(targetUser.id)), auditAction });
  });

  // Staff Only: Get Financial Transactions Ledger
  app.get('/api/admin/payments', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const transactions = Array.from(serverDB.paymentTransactions.values()).sort(
      (a, b) => b.created_at - a.created_at
    );

    res.json({ transactions });
  });

  // ============================================================================
  // 15. ADVERTISEMENTS & ADMOB REWARD ECOSYSTEM
  // ============================================================================

  // Public/User Ad Config
  app.get('/api/ads/config', (_req: Request, res: Response) => {
    const config = serverDB.getAdSettings();
    res.json({
      enabled: config.enabled,
      banner_enabled: config.banner_enabled,
      interstitial_enabled: config.interstitial_enabled,
      rewarded_enabled: false,
      test_mode: config.test_mode,
      ad_provider: config.ad_provider || 'admob',
      adsense_publisher_id: config.adsense_publisher_id || '',
      adsense_banner_slot_id: config.adsense_banner_slot_id || '',
      monetag_zone_id: config.monetag_zone_id || '',
      custom_banner_code: config.custom_banner_code || '',
      rewarded_sponsor_url: config.rewarded_sponsor_url || '',
      admob_app_id: config.admob_app_id,
      admob_banner_id: config.admob_banner_id,
      admob_interstitial_id: config.admob_interstitial_id,
      admob_rewarded_id: config.admob_rewarded_id,
      reward_points_amount: config.reward_points_amount,
      interstitial_cooldown_seconds: config.interstitial_cooldown_seconds,
    });
  });

  // Rewarded ads stay disabled until a server-side AdMob verification callback is implemented.
  app.post('/api/ads/reward', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;
    res.status(503).json({
      error: 'REWARDED_ADS_NOT_CONFIGURED',
      message: 'لن تُمنح نقاط مقابل إعلان قبل تفعيل التحقق الآمن من AdMob.',
    });
  });

  // Staff Only: Get Full Ad Settings
  app.get('/api/admin/ads/config', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }
    res.json({ config: serverDB.getAdSettings() });
  });

  // Staff Only: Update AdMob & Ad Settings
  app.put('/api/admin/ads/config', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }

    const body = req.body || {};
    const updated = serverDB.updateAdSettings(body);

    // Audit log
    const auditAction: ServerModerationAction = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      moderator_id: user.id,
      moderator_name: user.nickname,
      moderator_role: user.role,
      target_user_id: 'system',
      target_user_nickname: 'إعدادات الإعلانات وAdMob',
      action_type: 'RESOLVE_REPORT',
      reason: `تحديث إعدادات AdMob والإعلانات بواسطة ${user.nickname}`,
      created_at: Date.now(),
    };
    serverDB.moderationActions.set(auditAction.id, auditAction);
    serverDB.scheduleSave();
    broadcastStaff({ type: 'audit:new', auditAction });

    res.json({ ok: true, config: updated });
  });

  // 16. Permanent Account & Data Deletion (User & UGC Compliance)
  app.delete('/api/account', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const affectedPeers = serverDB.deleteAccountCompletely(user.id);
    for (const pid of affectedPeers) {
      sendToUser(pid, { type: 'sync:needed' });
    }
    broadcastOnlinePresence();
    res.json({ deleted: true });
  });

  // Support clean /u/:slug share links redirecting smoothly into the SPA gateway (?u=slug)
  app.get('/u/:slug', (req: Request, res: Response) => {
    res.redirect(302, `/?u=${encodeURIComponent(req.params.slug || '')}`);
  });

  // Serve SPA via Vite in dev or static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        watch: null,
      },
      plugins: [
        {
          name: 'fadfadah-attach-ws-server',
          config() {
            return {
              server: {
                hmr: {
                  server: httpServer,
                },
                watch: null,
              },
            };
          },
        },
      ],
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  httpServer.listen(port, '0.0.0.0', () => {
    console.log(`Fadfadah Real Server + WebSocket Hub listening on http://0.0.0.0:${port}`);
  });
}

startServer();
