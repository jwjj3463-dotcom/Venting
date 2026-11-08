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
  type GroupRoomCategory,
  type MediaType,
  type ServerGroupMessage,
  type ServerGroupRoom,
  type ServerChatRoom,
  type ServerMessage,
  type ServerUserRecord,
  type ServerReportModeration,
  type ServerModerationAction,
  type ServerBanAppeal,
  type ServerCallLog,
  type ServerPaymentTransaction,
  type ServerManualTopupRequest,
  type ServerManualTopupPackage,
  type ServerManualPaymentMethod,
  type ManualPaymentRequestType,
  type PremiumPlan,
  type UserRole,
  type AccountStatus,
  type ReportTargetType,
  type ReportStatus,
  OWNER_MIN_POINTS,
  normalizeAuthUsername,
} from './server/fadfadahServerDB.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MANUAL_SUBSCRIPTION_PLANS: Record<
  Exclude<PremiumPlan, 'free'>,
  {
    title_ar: string;
    title_en: string;
    points: number;
    amount: number;
    currency: string;
    duration_days: number;
  }
> = {
  weekly: {
    title_ar: 'اشتراك VIP أسبوعي',
    title_en: 'Weekly VIP subscription',
    points: 150,
    amount: 2.99,
    currency: 'USD',
    duration_days: 7,
  },
  monthly: {
    title_ar: 'اشتراك VIP شهري',
    title_en: 'Monthly VIP subscription',
    points: 500,
    amount: 7.99,
    currency: 'USD',
    duration_days: 30,
  },
  quarterly: {
    title_ar: 'اشتراك VIP لمدة 3 أشهر',
    title_en: '3-month VIP subscription',
    points: 1500,
    amount: 18.99,
    currency: 'USD',
    duration_days: 90,
  },
};

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
const HYPERLINK_PATTERN =
  /(?:https?:\/\/|www\.)\S+|\b(?:[\p{L}\d](?:[\p{L}\d-]*[\p{L}\d])?\.)+[\p{L}]{2,}(?:\/\S*)?/iu;

function containsHyperlink(text: string): boolean {
  return HYPERLINK_PATTERN.test(text);
}

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
  setInterval(() => {
    if (serverDB.pruneExpiredCallLogs()) serverDB.scheduleSave();
  }, 60 * 60 * 1000);

  const app = express();
  const httpServer = http.createServer(app);

  // Full CORS support for Capacitor Android APK (https://localhost, capacitor://localhost, LAN IPs)
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Idempotency-Key');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  app.use(express.json({ limit: '6mb' }));

  // Live WebSocket Connection Registry & Real Matchmaking Queue
  const activeSockets = new Map<string, Set<WebSocket>>(); // userId -> sockets
  const activeCallsByRoom = new Map<string, string>();
  const connectFourRows = 6;
  const connectFourColumns = 7;
  function getConnectFourDropIndex(board: Array<'X' | 'O' | null>, column: number): number {
    if (!Number.isInteger(column) || column < 0 || column >= connectFourColumns) return -1;
    for (let row = connectFourRows - 1; row >= 0; row -= 1) {
      const index = row * connectFourColumns + column;
      if (board[index] === null) return index;
    }
    return -1;
  }
  function getConnectFourWinner(board: Array<'X' | 'O' | null>): 'X' | 'O' | null {
    for (let row = 0; row < connectFourRows; row += 1) {
      for (let column = 0; column < connectFourColumns; column += 1) {
        const mark = board[row * connectFourColumns + column];
        if (!mark) continue;
        for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
          const cells = Array.from({ length: 4 }, (_, offset) => {
            const nextRow = row + rowStep * offset;
            const nextColumn = column + columnStep * offset;
            return nextRow >= 0 && nextRow < connectFourRows &&
              nextColumn >= 0 && nextColumn < connectFourColumns
              ? board[nextRow * connectFourColumns + nextColumn]
              : null;
          });
          if (cells.every((cell) => cell === mark)) return mark;
        }
      }
    }
    return null;
  }
  type ChatGameState = {
    id: string;
    roomId: string;
    createdAt: number;
    gameType: 'tic-tac-toe' | 'rock-paper-scissors' | 'connect-four' | 'guess-number' | 'bulls-cows' | 'pig-dice' | 'nim';
    inviterId: string;
    opponentId: string;
    status: 'invited' | 'active' | 'finished';
    board: Array<'X' | 'O' | null>;
    turnUserId: string;
    winner: 'X' | 'O' | 'DRAW' | null;
    round?: number;
    roundWinners?: Array<'X' | 'O' | 'DRAW'>;
    pendingChoices?: Partial<Record<string, 'rock' | 'paper' | 'scissors'>>;
    secretNumber?: number;
    secretCode?: string;
    secretReady?: boolean;
    lastGuess?: number;
    guessHint?: 'higher' | 'lower' | 'correct';
    lastCodeGuess?: string;
    bulls?: number;
    cows?: number;
    scores?: Record<string, number>;
    turnPoints?: number;
    lastDieRoll?: number;
    nimHeaps?: number[];
  };
  const chatGamesById = new Map<string, ChatGameState>();
  const activeChatGamesByRoom = new Map<string, string>();
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

  function publicChatGame(game: ChatGameState) {
    const {
      pendingChoices: _pendingChoices,
      secretNumber: _secretNumber,
      secretCode: _secretCode,
      ...publicGame
    } = game;
    return publicGame;
  }

  function sendChatGameState(game: ChatGameState): void {
    for (const userId of [game.inviterId, game.opponentId]) {
      sendToUser(userId, {
        type: 'game:state',
        game: {
          ...publicChatGame(game),
          pendingMove: game.pendingChoices?.[userId] ?? null,
        },
      });
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

  const chatGameInvitationExpiryTimer = setInterval(() => {
    const now = Date.now();
    for (const [gameId, game] of chatGamesById) {
      if (game.status !== 'invited' || now - game.createdAt < 60_000) continue;
      const event = { type: 'game:end', game: publicChatGame(game), reason: 'expired' };
      chatGamesById.delete(gameId);
      activeChatGamesByRoom.delete(game.roomId);
      sendToUser(game.inviterId, event);
      sendToUser(game.opponentId, event);
    }
  }, 10_000);
  chatGameInvitationExpiryTimer.unref();

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
          (serverDB.isPremiumActive(peer) ? 0.15 : 0);
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
          callId?: string;
          gameId?: string;
          gameType?: string;
          accept?: boolean;
          index?: number;
          guess?: number;
          secretNumber?: number;
          secretCode?: string;
          choice?: string;
          codeGuess?: string;
          action?: 'roll' | 'hold';
          heapIndex?: number;
          count?: number;
          callType?: 'audio' | 'video';
          signalKind?: 'offer' | 'answer' | 'ice' | 'end';
          signal?: unknown;
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
        } else if (msg.type === 'game:invite' && msg.roomId && msg.gameId) {
          const room = serverDB.chatRooms.get(msg.roomId);
          if (
            !room ||
            room.status !== 'ACCEPTED' ||
            (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id) ||
            !['tic-tac-toe', 'rock-paper-scissors', 'connect-four', 'guess-number', 'bulls-cows', 'pig-dice', 'nim'].includes(msg.gameType || '') ||
            !/^[a-f0-9-]{36}$/i.test(msg.gameId) ||
            chatGamesById.has(msg.gameId) ||
            activeChatGamesByRoom.has(room.id) ||
            activeCallsByRoom.has(room.id)
          ) return;
          const opponentId =
            room.participant_a === freshUser.id ? room.participant_b : room.participant_a;
          const gameType =
            msg.gameType === 'rock-paper-scissors'
              ? 'rock-paper-scissors'
              : msg.gameType === 'connect-four'
                ? 'connect-four'
                : msg.gameType === 'guess-number'
                  ? 'guess-number'
                  : msg.gameType === 'bulls-cows'
                    ? 'bulls-cows'
                    : msg.gameType === 'pig-dice'
                      ? 'pig-dice'
                      : msg.gameType === 'nim'
                        ? 'nim'
                  : 'tic-tac-toe';
          const game: ChatGameState = {
            id: msg.gameId,
            roomId: room.id,
            createdAt: Date.now(),
            gameType,
            inviterId: freshUser.id,
            opponentId,
            status: 'invited',
            board: gameType === 'guess-number' || gameType === 'bulls-cows' || gameType === 'pig-dice' || gameType === 'nim'
              ? []
              : Array(gameType === 'connect-four' ? connectFourRows * connectFourColumns : 9).fill(null),
            turnUserId: gameType === 'guess-number' || gameType === 'bulls-cows'
              ? opponentId
              : freshUser.id,
            winner: null,
            ...(gameType === 'guess-number' || gameType === 'bulls-cows'
              ? { secretReady: false }
              : {}),
            ...(gameType === 'pig-dice'
              ? { scores: { [freshUser.id]: 0, [opponentId]: 0 }, turnPoints: 0 }
              : {}),
            ...(gameType === 'nim' ? { nimHeaps: [3, 4, 5] } : {}),
            ...(gameType === 'rock-paper-scissors'
              ? { round: 1, roundWinners: [], pendingChoices: {} }
              : {}),
          };
          chatGamesById.set(game.id, game);
          activeChatGamesByRoom.set(room.id, game.id);
          sendChatGameState(game);
        } else if (msg.type === 'game:respond' && msg.gameId && typeof msg.accept === 'boolean') {
          const game = chatGamesById.get(msg.gameId);
          const room = game ? serverDB.chatRooms.get(game.roomId) : undefined;
          if (
            !game ||
            !room ||
            game.status !== 'invited' ||
            game.opponentId !== freshUser.id ||
            (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id)
          ) return;
          if (msg.accept) {
            game.status = 'active';
            sendChatGameState(game);
          } else {
            const event = { type: 'game:end', game: publicChatGame(game), reason: 'declined' };
            chatGamesById.delete(game.id);
            activeChatGamesByRoom.delete(game.roomId);
            sendToUser(game.inviterId, event);
            sendToUser(game.opponentId, event);
          }
        } else if (
          msg.type === 'game:set_secret' &&
          msg.gameId
        ) {
          const game = chatGamesById.get(msg.gameId);
          if (
            !game ||
            (game.gameType !== 'guess-number' && game.gameType !== 'bulls-cows') ||
            game.status !== 'active' ||
            game.inviterId !== freshUser.id ||
            game.secretReady
          ) return;
          if (game.gameType === 'guess-number') {
            if (
              typeof msg.secretNumber !== 'number' ||
              !Number.isInteger(msg.secretNumber) ||
              msg.secretNumber < 1 ||
              msg.secretNumber > 100
            ) return;
            game.secretNumber = msg.secretNumber;
          } else {
            if (
              typeof msg.secretCode !== 'string' ||
              !/^\d{4}$/.test(msg.secretCode) ||
              new Set(msg.secretCode).size !== 4
            ) return;
            game.secretCode = msg.secretCode;
          }
          game.secretReady = true;
          sendChatGameState(game);
        } else if (msg.type === 'game:move' && msg.gameId) {
          const game = chatGamesById.get(msg.gameId);
          const room = game ? serverDB.chatRooms.get(game.roomId) : undefined;
          if (
            !game ||
            !room ||
            room.status !== 'ACCEPTED' ||
            (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id) ||
            game.status !== 'active' ||
            (game.gameType !== 'rock-paper-scissors' && game.turnUserId !== freshUser.id)
          ) return;
          if (game.gameType === 'nim') {
            const heaps = game.nimHeaps;
            if (
              !heaps ||
              !Number.isInteger(msg.heapIndex) ||
              !Number.isInteger(msg.count) ||
              msg.heapIndex! < 0 ||
              msg.heapIndex! >= heaps.length ||
              msg.count! < 1 ||
              msg.count! > heaps[msg.heapIndex!]
            ) return;
            heaps[msg.heapIndex!] -= msg.count!;
            if (heaps.every((size) => size === 0)) {
              game.winner = freshUser.id === game.inviterId ? 'O' : 'X';
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            } else {
              game.turnUserId =
                freshUser.id === game.inviterId ? game.opponentId : game.inviterId;
            }
          } else if (game.gameType === 'pig-dice') {
            if (msg.action === 'hold') {
              game.scores ??= { [game.inviterId]: 0, [game.opponentId]: 0 };
              game.scores[freshUser.id] = (game.scores[freshUser.id] ?? 0) + (game.turnPoints ?? 0);
              game.turnPoints = 0;
              game.lastDieRoll = undefined;
              game.turnUserId =
                freshUser.id === game.inviterId ? game.opponentId : game.inviterId;
            } else if (msg.action === 'roll') {
              const roll = crypto.randomInt(1, 7);
              game.lastDieRoll = roll;
              if (roll === 1) {
                game.turnPoints = 0;
                game.turnUserId =
                  freshUser.id === game.inviterId ? game.opponentId : game.inviterId;
              } else {
                game.turnPoints = (game.turnPoints ?? 0) + roll;
              }
            } else {
              return;
            }
          } else if (game.gameType === 'guess-number') {
            if (
              !game.secretReady ||
              !Number.isInteger(msg.guess) ||
              msg.guess! < 1 ||
              msg.guess! > 100 ||
              freshUser.id !== game.opponentId
            ) return;
            game.lastGuess = msg.guess;
            game.guessHint =
              msg.guess === game.secretNumber
                ? 'correct'
                : msg.guess! < game.secretNumber!
                  ? 'higher'
                  : 'lower';
            if (game.guessHint === 'correct') {
              game.winner = 'O';
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            }
          } else if (game.gameType === 'bulls-cows') {
            if (
              !game.secretReady ||
              typeof msg.codeGuess !== 'string' ||
              !/^\d{4}$/.test(msg.codeGuess) ||
              new Set(msg.codeGuess).size !== 4 ||
              freshUser.id !== game.opponentId
            ) return;
            const bulls = [...msg.codeGuess].filter(
              (digit, index) => game.secretCode?.[index] === digit
            ).length;
            const matchingDigits = [...msg.codeGuess].filter(
              (digit) => game.secretCode?.includes(digit)
            ).length;
            game.lastCodeGuess = msg.codeGuess;
            game.bulls = bulls;
            game.cows = matchingDigits - bulls;
            if (bulls === 4) {
              game.winner = 'O';
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            }
          } else if (game.gameType === 'tic-tac-toe') {
            if (
              !Number.isInteger(msg.index) ||
              msg.index! < 0 ||
              msg.index! >= game.board.length ||
              game.board[msg.index!] !== null
            ) return;
            game.board[msg.index!] = freshUser.id === game.inviterId ? 'X' : 'O';
            const winningLines = [
              [0, 1, 2], [3, 4, 5], [6, 7, 8],
              [0, 3, 6], [1, 4, 7], [2, 5, 8],
              [0, 4, 8], [2, 4, 6],
            ];
            const winningLine = winningLines.find(([a, b, c]) =>
              game.board[a] !== null &&
              game.board[a] === game.board[b] &&
              game.board[a] === game.board[c]
            );
            if (winningLine) {
              game.winner = game.board[winningLine[0]];
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            } else if (game.board.every((cell) => cell !== null)) {
              game.winner = 'DRAW';
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            } else {
              game.turnUserId =
                freshUser.id === game.inviterId ? game.opponentId : game.inviterId;
            }
          } else if (game.gameType === 'connect-four') {
            if (!Number.isInteger(msg.index)) return;
            const index = getConnectFourDropIndex(game.board, msg.index!);
            if (index < 0) return;
            game.board[index] = freshUser.id === game.inviterId ? 'X' : 'O';
            const winner = getConnectFourWinner(game.board);
            if (winner) {
              game.winner = winner;
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            } else if (game.board.every((cell) => cell !== null)) {
              game.winner = 'DRAW';
              game.status = 'finished';
              activeChatGamesByRoom.delete(game.roomId);
            } else {
              game.turnUserId =
                freshUser.id === game.inviterId ? game.opponentId : game.inviterId;
            }
          } else if (
            game.gameType === 'rock-paper-scissors' &&
            ['rock', 'paper', 'scissors'].includes(String(msg.choice)) &&
            !game.pendingChoices?.[freshUser.id]
          ) {
            game.pendingChoices ??= {};
            const choice =
              msg.choice === 'rock' || msg.choice === 'paper' || msg.choice === 'scissors'
                ? msg.choice
                : null;
            if (!choice) return;
            game.pendingChoices[freshUser.id] = choice;
            if (game.pendingChoices[game.inviterId] && game.pendingChoices[game.opponentId]) {
              const inviterChoice = game.pendingChoices[game.inviterId]!;
              const opponentChoice = game.pendingChoices[game.opponentId]!;
              const roundWinner =
                inviterChoice === opponentChoice
                  ? 'DRAW'
                  : (
                      (inviterChoice === 'rock' && opponentChoice === 'scissors') ||
                      (inviterChoice === 'paper' && opponentChoice === 'rock') ||
                      (inviterChoice === 'scissors' && opponentChoice === 'paper')
                    )
                    ? 'X'
                    : 'O';
              game.roundWinners ??= [];
              game.roundWinners.push(roundWinner);
              game.pendingChoices = {};
              if ((game.round ?? 1) >= 3) {
                const xWins = game.roundWinners.filter((winner) => winner === 'X').length;
                const oWins = game.roundWinners.filter((winner) => winner === 'O').length;
                game.winner = xWins === oWins ? 'DRAW' : xWins > oWins ? 'X' : 'O';
                game.status = 'finished';
                activeChatGamesByRoom.delete(game.roomId);
              } else {
                game.round = (game.round ?? 1) + 1;
              }
            }
          } else {
            return;
          }
          sendChatGameState(game);
        } else if (msg.type === 'game:end' && msg.gameId) {
          const game = chatGamesById.get(msg.gameId);
          const room = game ? serverDB.chatRooms.get(game.roomId) : undefined;
          if (
            !game ||
            !room ||
            room.status !== 'ACCEPTED' ||
            (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id) ||
            (game.inviterId !== freshUser.id && game.opponentId !== freshUser.id)
          ) return;
          const event = { type: 'game:end', game: publicChatGame(game), reason: 'ended' };
          chatGamesById.delete(game.id);
          activeChatGamesByRoom.delete(game.roomId);
          sendToUser(game.inviterId, event);
          sendToUser(game.opponentId, event);
        } else if (msg.type === 'call:start' && msg.roomId && msg.callId) {
          const room = serverDB.chatRooms.get(msg.roomId);
          if (
            !room ||
            room.status !== 'ACCEPTED' ||
            (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id) ||
            !/^[a-f0-9-]{36}$/i.test(msg.callId) ||
            (msg.callType !== 'audio' && msg.callType !== 'video') ||
            serverDB.callLogs.has(msg.callId) ||
            activeCallsByRoom.has(room.id) ||
            activeChatGamesByRoom.has(room.id)
          ) return;
          const peerId =
            room.participant_a === freshUser.id ? room.participant_b : room.participant_a;
          const callLog: ServerCallLog = {
            id: msg.callId,
            room_id: room.id,
            caller_id: freshUser.id,
            callee_id: peerId,
            call_type: msg.callType,
            started_at: Date.now(),
          };
          serverDB.callLogs.set(callLog.id, callLog);
          activeCallsByRoom.set(room.id, callLog.id);
          serverDB.pruneExpiredCallLogs();
          serverDB.scheduleSave();
          sendToUser(peerId, {
            type: 'call:signal',
            roomId: room.id,
            callId: callLog.id,
            signalKind: 'start',
            callType: callLog.call_type,
            fromUserId: freshUser.id,
          });
        } else if (msg.type === 'call:signal' && msg.roomId && msg.callId) {
          const room = serverDB.chatRooms.get(msg.roomId);
          const callLog = serverDB.callLogs.get(msg.callId);
          if (
            !room ||
            room.status !== 'ACCEPTED' ||
            !callLog ||
            callLog.ended_at ||
            activeCallsByRoom.get(room.id) !== callLog.id ||
            callLog.room_id !== room.id ||
            (callLog.caller_id !== freshUser.id && callLog.callee_id !== freshUser.id) ||
            (room.participant_a !== freshUser.id && room.participant_b !== freshUser.id) ||
            !['offer', 'answer', 'ice', 'end'].includes(msg.signalKind || '')
          ) return;
          if (msg.signalKind !== 'end') {
            let signalSize: number;
            try {
              signalSize = JSON.stringify(msg.signal).length;
            } catch {
              return;
            }
            if (signalSize > 32_000 || !msg.signal || typeof msg.signal !== 'object') return;
          }
          const peerId =
            room.participant_a === freshUser.id ? room.participant_b : room.participant_a;
          if (msg.signalKind === 'end' && !callLog.ended_at) {
            callLog.ended_at = Date.now();
            callLog.duration_seconds = Math.max(
              0,
              Math.floor((callLog.ended_at - callLog.started_at) / 1000)
            );
            activeCallsByRoom.delete(room.id);
            serverDB.scheduleSave();
          }
          sendToUser(peerId, {
            type: 'call:signal',
            roomId: room.id,
            callId: callLog.id,
            signalKind: msg.signalKind,
            signal: msg.signal,
            fromUserId: freshUser.id,
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
          for (const [gameId, game] of chatGamesById) {
            if (game.inviterId !== user.id && game.opponentId !== user.id) continue;
            const event = { type: 'game:end', game: publicChatGame(game), reason: 'disconnected' };
            chatGamesById.delete(gameId);
            activeChatGamesByRoom.delete(game.roomId);
            const peerId = game.inviterId === user.id ? game.opponentId : game.inviterId;
            sendToUser(peerId, event);
          }
          for (const [roomId, callId] of activeCallsByRoom) {
            const callLog = serverDB.callLogs.get(callId);
            if (
              !callLog ||
              (callLog.caller_id !== user.id && callLog.callee_id !== user.id)
            ) continue;
            callLog.ended_at = Date.now();
            callLog.duration_seconds = Math.max(
              0,
              Math.floor((callLog.ended_at - callLog.started_at) / 1000)
            );
            activeCallsByRoom.delete(roomId);
            serverDB.scheduleSave();
            const peerId = callLog.caller_id === user.id ? callLog.callee_id : callLog.caller_id;
            sendToUser(peerId, {
              type: 'call:signal',
              roomId,
              callId,
              signalKind: 'end',
              fromUserId: user.id,
            });
          }
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

  async function verifyTurnstileRequest(
    res: Response,
    token: unknown
  ): Promise<boolean> {
    const secret = process.env.CLOUDFLARE_TURNSTILE_SECRET_KEY?.trim();
    if (!secret) {
      if (process.env.NODE_ENV === 'production') {
        res.status(503).json({ error: 'BOT_PROTECTION_NOT_CONFIGURED' });
        return false;
      }
      return true;
    }
    if (typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'BOT_CHALLENGE_REQUIRED' });
      return false;
    }

    try {
      const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ secret, response: token }),
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        res.status(503).json({ error: 'BOT_CHALLENGE_SERVICE_UNAVAILABLE' });
        return false;
      }
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('success' in result) ||
        result.success !== true
      ) {
        res.status(400).json({ error: 'BOT_CHALLENGE_FAILED' });
        return false;
      }
      return true;
    } catch {
      res.status(503).json({ error: 'BOT_CHALLENGE_SERVICE_UNAVAILABLE' });
      return false;
    }
  }

  // ============================================================================
  // REST API ROUTES
  // ============================================================================

  // Health & Server Info
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      package: 'com.fadfadahnative',
      version: '3.11.2',
      onlineUsers: activeSockets.size,
      totalRegisteredUsers: serverDB.users.size,
    });
  });

  // 1. Register new real device account
  app.post('/api/auth/register', async (req: Request, res: Response) => {
    const {
      nickname,
      avatar_url,
      country,
      languages,
      interests,
      age,
      gender,
      password,
      turnstileToken,
    } = (req.body || {}) as {
      nickname?: string;
      avatar_url?: string;
      country?: string;
      languages?: string[];
      interests?: string[];
      age?: number;
      gender?: 'female' | 'male' | 'other';
      password?: string;
      turnstileToken?: string;
    };

    if (password !== undefined) {
      const cleanNickname = nickname?.trim() || '';
      if (cleanNickname.length < 3 || cleanNickname.length > 24) {
        res.status(400).json({ error: 'NICKNAME_MUST_BE_3_TO_24_CHARACTERS' });
        return;
      }
      if (password.length < 8 || password.length > 128) {
        res.status(400).json({ error: 'PASSWORD_MUST_BE_8_TO_128_CHARACTERS' });
        return;
      }
      if (typeof age !== 'number' || !Number.isInteger(age) || age < 18 || age > 120) {
        res.status(400).json({ error: 'AGE_MUST_BE_18_OR_OLDER' });
        return;
      }
      if (!gender || !['female', 'male', 'other'].includes(gender)) {
        res.status(400).json({ error: 'INVALID_GENDER' });
        return;
      }
      if (serverDB.isUsernameTaken(cleanNickname)) {
        res.status(409).json({ error: 'NICKNAME_ALREADY_IN_USE' });
        return;
      }
    }

    if (age !== undefined && (!Number.isInteger(age) || age < 18 || age > 120)) {
      res.status(400).json({ error: 'AGE_MUST_BE_18_OR_OLDER' });
      return;
    }
    if (gender !== undefined && !['female', 'male', 'other'].includes(gender)) {
      res.status(400).json({ error: 'INVALID_GENDER' });
      return;
    }

    if (!(await verifyTurnstileRequest(res, turnstileToken))) return;

    const { user, link, rawToken, recoveryCode } = serverDB.registerNewUser({
      nickname,
      avatar_url,
      country,
      languages,
      interests,
      age,
      gender,
      password,
    });

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = user;
    res.json({
      authToken: rawToken,
      recoveryCode,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
      personalLink: link,
    });

  });

  app.post('/api/auth/login', (req: Request, res: Response) => {
    const username = typeof req.body?.username === 'string' ? req.body.username.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!username || !password) {
      res.status(400).json({ error: 'USERNAME_AND_PASSWORD_REQUIRED' });
      return;
    }

    const session = serverDB.loginWithPassword(username, password);
    if (!session) {
      res.status(401).json({ error: 'INVALID_USERNAME_OR_PASSWORD' });
      return;
    }
    if (!verifyAccountActive(session.user, res)) return;

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = session.user;
    res.json({
      authToken: session.rawToken,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
      personalLink: session.link,
    });
  });

  app.get('/api/rooms/:roomId/call-ice-servers', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || !verifyAccountActive(user, res)) {
      if (!user) res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const room = serverDB.chatRooms.get(req.params.roomId || '');
    if (
      !room ||
      room.status !== 'ACCEPTED' ||
      (room.participant_a !== user.id && room.participant_b !== user.id)
    ) {
      res.status(403).json({ error: 'CALL_ROOM_NOT_AVAILABLE' });
      return;
    }
    const urls = (process.env.TURN_SERVER_URLS || process.env.TURN_SERVER_URL || '')
      .split(',')
      .map((url) => url.trim())
      .filter(Boolean);
    const sharedSecret = process.env.TURN_SHARED_SECRET?.trim();
    if (
      urls.length === 0 ||
      urls.some((url) => !/^(turn|turns):[^\s,]+$/i.test(url)) ||
      !sharedSecret ||
      Buffer.byteLength(sharedSecret, 'utf8') < 32
    ) {
      res.status(503).json({ error: 'CALL_TURN_NOT_CONFIGURED' });
      return;
    }
    const expiresAt = Math.floor(Date.now() / 1000) + 60 * 60;
    const username = `${expiresAt}:${user.id}`;
    const credential = crypto.createHmac('sha1', sharedSecret).update(username).digest('base64');
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      iceServers: [{ urls: ['stun:stun.l.google.com:19302', ...urls], username, credential }],
      expiresAt,
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
      auth_username: _authUsername,
      password_hash: _passwordHash,
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

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = user;
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

  function groupRoomDto(room: ServerGroupRoom, viewerId: string) {
    const isMember = room.member_ids.includes(viewerId);
    const viewer = serverDB.users.get(viewerId);
    return {
      id: room.id,
      name_ar: room.name_ar,
      name_en: room.name_en,
      description_ar: room.description_ar,
      description_en: room.description_en,
      category: room.category,
      invite_code: isMember && room.category === 'PRIVATE' ? room.invite_code ?? null : null,
      created_by: room.created_by,
      host_id: room.host_id,
      member_count: room.member_ids.length,
      is_member: isMember,
      ...(isMember
        ? {
            members: room.member_ids.flatMap((memberId) => {
              const member = serverDB.users.get(memberId);
              if (
                !member ||
                viewer?.blocked_user_ids.includes(memberId) ||
                member.blocked_user_ids.includes(viewerId)
              ) {
                return [];
              }
              return [{ id: member.id, nickname: member.nickname }];
            }),
          }
        : {}),
      is_host: room.host_id === viewerId,
      created_at: room.created_at,
      updated_at: room.updated_at,
      is_active: room.is_active,
    };
  }

  function canUseGroupRooms(user: ServerUserRecord, res: Response): boolean {
    if (user.age === undefined || user.age < 18 || !user.gender) {
      res.status(403).json({
        error: 'PROFILE_REQUIRED',
        message: 'أكمل العمر والجنس من الملف الشخصي قبل استخدام الغرف الجماعية.',
      });
      return false;
    }
    return true;
  }

  function verifyGroupRoomPassword(room: ServerGroupRoom, password: string): boolean {
    if (room.category !== 'PRIVATE') return true;
    if (password.length < 6 || password.length > 64) return false;
    const expected = room.password_hash ? Buffer.from(room.password_hash, 'hex') : Buffer.alloc(0);
    const actual =
      room.password_salt && password
        ? crypto.scryptSync(password, room.password_salt, 64)
        : Buffer.alloc(0);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  function addGroupRoomMember(room: ServerGroupRoom, userId: string): void {
    if (room.member_ids.includes(userId)) return;
    room.member_ids.push(userId);
    if (room.member_ids.length === 1 && room.host_id === room.created_by) {
      room.host_id = userId;
    }
    room.updated_at = Date.now();
    serverDB.scheduleSave();
    for (const memberId of room.member_ids) {
      sendToUser(memberId, { type: 'group-room:updated', roomId: room.id });
    }
  }

  app.get('/api/group-rooms', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res) || !canUseGroupRooms(user, res)) return;

    const rooms = Array.from(serverDB.groupRooms.values())
      .filter(
        (room) =>
          room.is_active &&
          (room.category !== 'PRIVATE' || room.member_ids.includes(user.id))
      )
      .sort((a, b) => b.updated_at - a.updated_at)
      .map((room) => groupRoomDto(room, user.id));
    res.json({ rooms });
  });

  app.post('/api/group-rooms', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res) || !canUseGroupRooms(user, res)) return;
    if (user.status === 'restricted') {
      res.status(403).json({ error: 'ACCOUNT_RESTRICTED' });
      return;
    }

    const body = (
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? req.body
        : {}
    ) as {
      name_ar?: unknown;
      name_en?: unknown;
      description_ar?: unknown;
      description_en?: unknown;
      category?: unknown;
      password?: unknown;
    };
    const nameAr = typeof body.name_ar === 'string' ? body.name_ar.trim() : '';
    const nameEn =
      typeof body.name_en === 'string' && body.name_en.trim()
        ? body.name_en.trim().slice(0, 50)
        : nameAr;
    const descriptionAr =
      typeof body.description_ar === 'string' ? body.description_ar.trim().slice(0, 240) : '';
    const descriptionEn =
      typeof body.description_en === 'string' ? body.description_en.trim().slice(0, 240) : '';
    const validCategories: GroupRoomCategory[] = ['PUBLIC', 'PRIVATE', 'HOSTED'];
    const category = validCategories.find((value) => value === body.category) ?? null;
    const password = typeof body.password === 'string' ? body.password : '';
    if (
      !nameAr ||
      nameAr.length > 50 ||
      !category ||
      (category === 'PRIVATE' && (password.length < 6 || password.length > 64))
    ) {
      res.status(400).json({ error: 'INVALID_GROUP_ROOM' });
      return;
    }

    const roomModeration = await moderateServerContent(
      `${nameAr} ${nameEn} ${descriptionAr} ${descriptionEn}`
    );
    if (roomModeration.isFrozen) {
      res.status(400).json({ error: roomModeration.reasonAr || 'وصف الغرفة يخالف إرشادات الأمان.' });
      return;
    }

    const now = Date.now();
    const salt = category === 'PRIVATE' ? crypto.randomBytes(16).toString('hex') : undefined;
    let inviteCode = crypto.randomBytes(5).toString('hex').toUpperCase();
    while (
      Array.from(serverDB.groupRooms.values()).some((existing) => existing.invite_code === inviteCode)
    ) {
      inviteCode = crypto.randomBytes(5).toString('hex').toUpperCase();
    }
    const room: ServerGroupRoom = {
      id: `group-${crypto.randomUUID()}`,
      name_ar: nameAr,
      name_en: nameEn,
      description_ar: descriptionAr,
      description_en: descriptionEn,
      category,
      invite_code: inviteCode,
      created_by: user.id,
      host_id: user.id,
      member_ids: [user.id],
      password_salt: salt,
      password_hash:
        salt && category === 'PRIVATE'
          ? crypto.scryptSync(password, salt, 64).toString('hex')
          : undefined,
      created_at: now,
      updated_at: now,
      is_active: true,
    };
    serverDB.groupRooms.set(room.id, room);
    serverDB.scheduleSave();
    broadcastAll({ type: 'group-room:updated', roomId: room.id });
    res.status(201).json({ room: groupRoomDto(room, user.id) });
  });

  app.post('/api/group-rooms/:roomId/join', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res) || !canUseGroupRooms(user, res)) return;

    const room = serverDB.groupRooms.get(req.params.roomId || '');
    if (!room || !room.is_active) {
      res.status(404).json({ error: 'GROUP_ROOM_NOT_FOUND' });
      return;
    }
    if (room.category === 'PRIVATE' && !room.member_ids.includes(user.id)) {
      const password = typeof req.body?.password === 'string' ? req.body.password : '';
      if (!verifyGroupRoomPassword(room, password)) {
        res.status(403).json({ error: 'INVALID_GROUP_ROOM_PASSWORD' });
        return;
      }
    }

    addGroupRoomMember(room, user.id);
    res.json({ room: groupRoomDto(room, user.id) });
  });

  app.post('/api/group-rooms/join-by-code', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res) || !canUseGroupRooms(user, res)) return;

    const code = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const room = Array.from(serverDB.groupRooms.values()).find(
      (candidate) => candidate.invite_code === code && candidate.category === 'PRIVATE'
    );
    if (!room || !room.is_active) {
      res.status(404).json({ error: 'GROUP_ROOM_NOT_FOUND' });
      return;
    }
    if (!verifyGroupRoomPassword(room, password)) {
      res.status(403).json({ error: 'INVALID_GROUP_ROOM_PASSWORD' });
      return;
    }

    addGroupRoomMember(room, user.id);
    res.json({ room: groupRoomDto(room, user.id) });
  });

  app.post('/api/group-rooms/:roomId/leave', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const room = serverDB.groupRooms.get(req.params.roomId || '');
    if (!room || !room.member_ids.includes(user.id)) {
      res.status(404).json({ error: 'GROUP_ROOM_NOT_FOUND' });
      return;
    }

    room.member_ids = room.member_ids.filter((memberId) => memberId !== user.id);
    if (room.host_id === user.id) room.host_id = room.member_ids[0] || room.created_by;
    if (room.member_ids.length === 0) room.is_active = false;
    room.updated_at = Date.now();
    serverDB.scheduleSave();
    for (const memberId of room.member_ids) {
      sendToUser(memberId, { type: 'group-room:updated', roomId: room.id });
    }
    res.json({ ok: true });
  });

  app.get('/api/group-rooms/:roomId/messages', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res) || !canUseGroupRooms(user, res)) return;
    const room = serverDB.groupRooms.get(req.params.roomId || '');
    if (!room || !room.is_active || !room.member_ids.includes(user.id)) {
      res.status(404).json({ error: 'GROUP_ROOM_NOT_FOUND' });
      return;
    }
    const messages = Array.from(serverDB.groupMessages.values())
      .filter((message) => message.room_id === room.id)
      .filter((message) => {
        const sender = serverDB.users.get(message.sender_id);
        return (
          message.sender_id === user.id ||
          (!user.blocked_user_ids.includes(message.sender_id) &&
            !sender?.blocked_user_ids.includes(user.id))
        );
      })
      .sort((a, b) => a.created_at - b.created_at)
      .slice(-100);
    res.json({ messages });
  });

  app.post('/api/group-rooms/:roomId/messages', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res) || !canUseGroupRooms(user, res)) return;
    if (user.status === 'restricted') {
      res.status(403).json({ error: 'ACCOUNT_RESTRICTED' });
      return;
    }

    const room = serverDB.groupRooms.get(req.params.roomId || '');
    const content = typeof req.body?.content === 'string' ? req.body.content.trim() : '';
    const rawMentionedUserIds = req.body?.mentioned_user_ids;
    if (!room || !room.is_active || !room.member_ids.includes(user.id)) {
      res.status(404).json({ error: 'GROUP_ROOM_NOT_FOUND' });
      return;
    }
    if (!content || content.length > 1000) {
      res.status(400).json({ error: 'INVALID_GROUP_MESSAGE' });
      return;
    }
    if (!serverDB.isTrustedMember(user) && containsHyperlink(content)) {
      res.status(403).json({ error: 'TRUSTED_MEMBER_REQUIRED' });
      return;
    }
    if (
      rawMentionedUserIds !== undefined &&
      (!Array.isArray(rawMentionedUserIds) ||
        rawMentionedUserIds.some(
          (id) =>
            typeof id !== 'string' ||
            id === user.id ||
            !room.member_ids.includes(id) ||
            user.blocked_user_ids.includes(id) ||
            serverDB.users.get(id)?.blocked_user_ids.includes(user.id)
        ))
    ) {
      res.status(400).json({ error: 'INVALID_GROUP_MESSAGE_MENTIONS' });
      return;
    }
    const mentionedUserIds = Array.isArray(rawMentionedUserIds)
      ? [...new Set(rawMentionedUserIds as string[])]
      : [];

    const moderation = await moderateServerContent(content);
    const message: ServerGroupMessage = {
      id: `group-msg-${crypto.randomUUID()}`,
      room_id: room.id,
      sender_id: user.id,
      content,
      mentioned_user_ids: mentionedUserIds,
      created_at: Date.now(),
      is_frozen: moderation.isFrozen,
      ai_flag_score: moderation.flagScore,
      ai_flag_reason: moderation.reasonAr,
    };
    serverDB.groupMessages.set(message.id, message);
    if (!moderation.isFrozen) serverDB.recordAcceptedMessage(user.id);
    room.updated_at = message.created_at;
    serverDB.scheduleSave();
    for (const memberId of room.member_ids) {
      const member = serverDB.users.get(memberId);
      if (
        memberId !== user.id &&
        (user.blocked_user_ids.includes(memberId) ||
          member?.blocked_user_ids.includes(user.id))
      ) {
        continue;
      }
      sendToUser(memberId, {
        type: 'group-message:new',
        roomId: room.id,
        message,
      });
    }
    if (!moderation.isFrozen) {
      const senderNickname = user.nickname;
      for (const mentionedUserId of mentionedUserIds) {
        const mentionedUser = serverDB.users.get(mentionedUserId);
        if (
          !mentionedUser ||
          user.blocked_user_ids.includes(mentionedUserId) ||
          mentionedUser.blocked_user_ids.includes(user.id)
        ) {
          continue;
        }
        sendToUser(mentionedUserId, {
          type: 'group-message:mention',
          roomId: room.id,
          senderNickname,
          roomNameAr: room.name_ar,
          roomNameEn: room.name_en,
        });
      }
    }
    res.json({ message });
  });

  // 3. Update Profile & Custom Personal Link Slug
  app.put('/api/profile', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const {
      nickname,
      slug,
      country,
      bio,
      age,
      gender,
      avatar_url,
      frame_id,
      interests,
      languages,
    } =
      req.body as {
        nickname?: string;
        slug?: string;
        country?: string;
        bio?: string;
        age?: number | null;
        gender?: 'female' | 'male' | 'other' | null;
        avatar_url?: string;
        frame_id?: number;
        interests?: string[];
        languages?: string[];
      };

    if (
      age !== undefined &&
      age !== null &&
      (!Number.isInteger(age) || age < 18 || age > 120)
    ) {
      res.status(400).json({ error: 'AGE_MUST_BE_18_OR_OLDER' });
      return;
    }
    if (gender !== undefined && gender !== null && !['female', 'male', 'other'].includes(gender)) {
      res.status(400).json({ error: 'INVALID_GENDER' });
      return;
    }

    const nextNickname = nickname?.trim();
    if (user.auth_username && nextNickname) {
      if (nextNickname.length < 3 || nextNickname.length > 24) {
        res.status(400).json({ error: 'NICKNAME_MUST_BE_3_TO_24_CHARACTERS' });
        return;
      }
      if (serverDB.isUsernameTaken(nextNickname, user.id)) {
        res.status(409).json({ error: 'NICKNAME_ALREADY_IN_USE' });
        return;
      }
    }

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

    if (nextNickname) {
      if (user.auth_username) {
        serverDB.usernameIndex.delete(user.auth_username);
        user.auth_username = normalizeAuthUsername(nextNickname);
        serverDB.usernameIndex.set(user.auth_username, user.id);
      }
      user.nickname = nextNickname.slice(0, 24);
    }
    if (country) user.country = country.slice(0, 32);
    if (typeof bio === 'string') user.bio = bio.trim().slice(0, 120);
    if (age === null) {
      user.age = undefined;
    } else if (age !== undefined) {
      user.age = age;
    }
    if (gender === null) {
      user.gender = undefined;
    } else if (gender !== undefined) {
      user.gender = gender;
    }
    if (avatar_url) user.avatar_url = avatar_url;
    if (typeof frame_id === 'number' && (serverDB.isPremiumActive(user) || user.unlocked_frames.includes(frame_id))) {
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

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = user;
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
    serverDB.recordAcceptedMessage(sender.id);
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

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSender
    } = sender;
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
    if (
      !serverDB.isTrustedMember(user) &&
      typeof introText === 'string' &&
      containsHyperlink(introText)
    ) {
      res.status(403).json({ error: 'TRUSTED_MEMBER_REQUIRED' });
      return;
    }
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
    if (!serverDB.isPremiumActive(user) && usedToday >= 5) {
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
    serverDB.recordAcceptedMessage(user.id);
    serverDB.scheduleSave();

    sendToUser(peer.id, {
      type: 'room:upsert',
      room: formatRoomForUser(room, peer.id),
      peer: serverDB.toPublicUser(user, isUserOnline(user.id)),
      message: msg,
    });

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = user;
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
    const mType: MediaType =
      media_type === 'image' ||
      media_type === 'sticker' ||
      media_type === 'audio' ||
      media_type === 'video' ||
      media_type === 'text'
        ? media_type
        : 'text';
    if (!cleanContent && !media_url) {
      res.status(400).json({ error: 'EMPTY_MESSAGE' });
      return;
    }
    if (
      !serverDB.isTrustedMember(user) &&
      (mType !== 'text' || Boolean(media_url) || containsHyperlink(cleanContent))
    ) {
      res.status(403).json({ error: 'TRUSTED_MEMBER_REQUIRED' });
      return;
    }

    const imageMatch =
      mType === 'image' && typeof media_url === 'string'
        ? /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(media_url)
        : null;
    if (mType === 'image') {
      if (!imageMatch) {
        res.status(400).json({ error: 'INVALID_IMAGE_ATTACHMENT' });
        return;
      }
      const imageBytes = Buffer.from(imageMatch[2], 'base64');
      const mimeType = `image/${imageMatch[1]}`;
      const hasValidSignature =
        mimeType === 'image/png'
          ? imageBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          : mimeType === 'image/jpeg'
            ? imageBytes.length >= 3 &&
              imageBytes[0] === 255 &&
              imageBytes[1] === 216 &&
              imageBytes[2] === 255
            : imageBytes.length >= 12 &&
              imageBytes.toString('ascii', 0, 4) === 'RIFF' &&
              imageBytes.toString('ascii', 8, 12) === 'WEBP';
      if (!imageBytes.length || imageBytes.length > 650 * 1024 || !hasValidSignature) {
        res.status(400).json({ error: 'INVALID_IMAGE_ATTACHMENT' });
        return;
      }
    }
    if (mType === 'audio') {
      const audioMatch =
        typeof media_url === 'string'
          ? /^data:audio\/(webm|mp4|ogg|wav|mpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(
              media_url
            )
          : null;
      if (!audioMatch) {
        res.status(400).json({ error: 'INVALID_AUDIO_ATTACHMENT' });
        return;
      }
      const audioBytes = Buffer.from(audioMatch[2], 'base64');
      const container = audioMatch[1];
      const hasValidSignature =
        container === 'webm'
          ? audioBytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))
          : container === 'ogg'
            ? audioBytes.subarray(0, 4).toString('ascii') === 'OggS'
            : container === 'wav'
              ? audioBytes.length >= 12 &&
                audioBytes.toString('ascii', 0, 4) === 'RIFF' &&
                audioBytes.toString('ascii', 8, 12) === 'WAVE'
              : container === 'mp4'
                ? audioBytes.length >= 12 &&
                  audioBytes.toString('ascii', 4, 8) === 'ftyp'
                : audioBytes.length >= 2 &&
                  audioBytes[0] === 0xff &&
                  (audioBytes[1] & 0xe0) === 0xe0;
      if (!audioBytes.length || audioBytes.length > 650 * 1024 || !hasValidSignature) {
        res.status(400).json({ error: 'INVALID_AUDIO_ATTACHMENT' });
        return;
      }
    }
    if (mType === 'video') {
      const videoMatch =
        typeof media_url === 'string'
          ? /^data:video\/(mp4|webm);base64,([A-Za-z0-9+/]+={0,2})$/.exec(media_url)
          : null;
      if (!videoMatch) {
        res.status(400).json({ error: 'INVALID_VIDEO_ATTACHMENT' });
        return;
      }
      const videoBytes = Buffer.from(videoMatch[2], 'base64');
      const hasValidSignature =
        videoMatch[1] === 'mp4'
          ? videoBytes.length >= 12 && videoBytes.toString('ascii', 4, 8) === 'ftyp'
          : videoBytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
      if (!videoBytes.length || videoBytes.length > 3 * 1024 * 1024 || !hasValidSignature) {
        res.status(400).json({ error: 'INVALID_VIDEO_ATTACHMENT' });
        return;
      }
    }
    const isImg = Boolean(imageMatch);
    // Private conversations are reviewed through user reports, not automated content scanning.
    const mod = { flagScore: 0, isFrozen: false, reasonAr: '', reasonEn: '' };

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
    if (!message.is_frozen) serverDB.recordAcceptedMessage(user.id);

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
    const groupRoom = roomId ? serverDB.groupRooms.get(roomId) : undefined;
    if (groupRoom && !groupRoom.member_ids.includes(user.id)) {
      res.status(403).json({ error: 'FORBIDDEN' });
      return;
    }
    if (groupRoom && reportedUserId && !groupRoom.member_ids.includes(reportedUserId)) {
      res.status(400).json({ error: 'REPORTED_USER_NOT_IN_GROUP_ROOM' });
      return;
    }
    if (groupRoom && targetType === 'message') {
      const groupTargetMessage = target_id
        ? serverDB.groupMessages.get(target_id)
        : undefined;
      if (
        !groupTargetMessage ||
        groupTargetMessage.room_id !== groupRoom.id ||
        !reportedUserId ||
        reportedUserId !== groupTargetMessage.sender_id
      ) {
        res.status(400).json({ error: 'INVALID_GROUP_MESSAGE_REPORT' });
        return;
      }
    }

    // Capture comprehensive evidence
    let evidenceItems: Array<{ sender: string; content: string; time?: string }> = [];

    if (targetType === 'message' && target_id) {
      const msg = serverDB.messages.get(target_id);
      const groupMessage = serverDB.groupMessages.get(target_id);
      if (msg && (!roomId || msg.room_id === roomId)) {
        evidenceItems.push({
          sender: msg.sender_id === user.id ? user.nickname : reportedNick,
          content: msg.content,
          time: new Date(msg.created_at).toISOString(),
        });
      } else if (groupMessage && groupRoom?.id === groupMessage.room_id) {
        evidenceItems.push({
          sender: serverDB.users.get(groupMessage.sender_id)?.nickname || reportedNick,
          content: groupMessage.content,
          time: new Date(groupMessage.created_at).toISOString(),
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
      if (groupRoom) {
        const groupMsgs = Array.from(serverDB.groupMessages.values())
         .filter((message) => message.room_id === roomId)
         .sort((a, b) => a.created_at - b.created_at)
         .slice(-10)
         .map((message) => ({
           sender: serverDB.users.get(message.sender_id)?.nickname || 'مستخدم غير معروف',
           content: message.content,
           time: new Date(message.created_at).toISOString(),
         }));
        evidenceItems = [...evidenceItems, ...groupMsgs];
      }
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

  const manualTopupReservations = new Set<string>();

  const publicManualTopupRequest = (request: ServerManualTopupRequest) => ({
    id: request.id,
    request_type: request.request_type || 'TOPUP',
    premium_plan: request.premium_plan,
    user_id: request.user_id,
    user_nickname: request.user_nickname,
    package_title_ar: request.package_title_ar,
    package_title_en: request.package_title_en,
    points: request.points,
    amount: request.amount,
    currency: request.currency,
    payment_method_title_ar: request.payment_method_title_ar,
    payment_method_title_en: request.payment_method_title_en,
    transaction_reference: request.transaction_reference,
    status: request.status,
    rejection_reason: request.rejection_reason,
    created_at: request.created_at,
    reviewed_at: request.reviewed_at,
    reviewed_by: request.reviewed_by,
    has_proof: Boolean(request.proof_file),
  });

  // Public payment instructions and packages are configured by the account owner.
  app.get('/api/payments/manual/config', (_req: Request, res: Response) => {
    res.json({
      packages: serverDB.manualTopupPackages.filter((pack) => pack.enabled),
      payment_methods: serverDB.manualPaymentMethods.filter((method) => method.enabled),
    });
  });

  app.get('/api/payments/manual/requests', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const requests = Array.from(serverDB.manualTopupRequests.values())
      .filter((request) => request.user_id === user.id)
      .sort((a, b) => b.created_at - a.created_at)
      .map(publicManualTopupRequest);
    res.json({ requests });
  });

  app.post('/api/payments/manual/requests', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (!verifyAccountActive(user, res)) return;

    const body = (req.body || {}) as Record<string, unknown>;
    const { package_id: packageId, payment_method_id: paymentMethodId, transaction_reference: reference, proof_data_url: proofDataUrl } =
      body;
    const requestedType = body.request_type;
    const requestType: ManualPaymentRequestType =
      requestedType === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'TOPUP';
    const planId = body.plan_id;
    const idempotencyKey = String(req.get('Idempotency-Key') || '');
    if (!/^[a-f0-9-]{36}$/i.test(idempotencyKey)) {
      res.status(400).json({ error: 'INVALID_IDEMPOTENCY_KEY' });
      return;
    }

    const existing = Array.from(serverDB.manualTopupRequests.values()).find(
      (request) => request.user_id === user.id && request.idempotency_key === idempotencyKey
    );
    if (existing) {
      res.json({ request: publicManualTopupRequest(existing) });
      return;
    }

    if (requestedType !== undefined && requestedType !== 'TOPUP' && requestedType !== 'SUBSCRIPTION') {
      res.status(400).json({ error: 'INVALID_MANUAL_PAYMENT_TYPE' });
      return;
    }
    const topupPackage =
      requestType === 'TOPUP'
        ? serverDB.manualTopupPackages.find((item) => item.id === packageId && item.enabled)
        : undefined;
    const subscriptionPlan =
      requestType === 'SUBSCRIPTION' &&
      (planId === 'weekly' || planId === 'monthly' || planId === 'quarterly')
        ? MANUAL_SUBSCRIPTION_PLANS[planId]
        : undefined;
    const method = serverDB.manualPaymentMethods.find((item) => item.id === paymentMethodId && item.enabled);
    if ((!topupPackage && !subscriptionPlan) || !method) {
      res.status(400).json({ error: 'INVALID_PACKAGE_OR_PAYMENT_METHOD' });
      return;
    }
    const item = topupPackage
      ? {
          id: topupPackage.id,
          title_ar: topupPackage.title_ar,
          title_en: topupPackage.title_en,
          points: topupPackage.points,
          amount: topupPackage.amount,
          currency: topupPackage.currency,
        }
      : {
          id: planId as Exclude<PremiumPlan, 'free'>,
          title_ar: subscriptionPlan!.title_ar,
          title_en: subscriptionPlan!.title_en,
          points: subscriptionPlan!.points,
          amount: subscriptionPlan!.amount,
          currency: subscriptionPlan!.currency,
        };
    if (typeof reference !== 'string' || reference.trim().length < 3 || reference.trim().length > 100) {
      res.status(400).json({ error: 'INVALID_TRANSACTION_REFERENCE' });
      return;
    }
    if (typeof proofDataUrl !== 'string') {
      res.status(400).json({ error: 'PAYMENT_PROOF_REQUIRED' });
      return;
    }
    const proofMatch = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(proofDataUrl);
    if (!proofMatch) {
      res.status(400).json({ error: 'INVALID_PAYMENT_PROOF' });
      return;
    }
    const proofMimeType = proofMatch[1] === 'jpeg' ? 'image/jpeg' : `image/${proofMatch[1]}`;
    const proofBytes = Buffer.from(proofMatch[2], 'base64');
    const hasValidSignature =
      proofMimeType === 'image/png'
        ? proofBytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : proofMimeType === 'image/jpeg'
          ? proofBytes.length >= 3 && proofBytes[0] === 255 && proofBytes[1] === 216 && proofBytes[2] === 255
          : proofBytes.length >= 12 &&
            proofBytes.toString('ascii', 0, 4) === 'RIFF' &&
            proofBytes.toString('ascii', 8, 12) === 'WEBP';
    if (!proofBytes.length || proofBytes.length > 2 * 1024 * 1024 || !hasValidSignature) {
      res.status(400).json({ error: 'INVALID_PAYMENT_PROOF' });
      return;
    }

    const referenceKey = reference.trim().normalize('NFKC').toLocaleLowerCase();
    if (
      Array.from(serverDB.manualTopupRequests.values()).some(
        (request) => request.reference_key === referenceKey
      ) ||
      manualTopupReservations.has(`reference:${referenceKey}`)
    ) {
      res.status(409).json({ error: 'TRANSACTION_REFERENCE_ALREADY_USED' });
      return;
    }

    const idempotencyReservation = `idempotency:${user.id}:${idempotencyKey}`;
    if (manualTopupReservations.has(idempotencyReservation)) {
      res.status(409).json({ error: 'MANUAL_TOPUP_REQUEST_IN_PROGRESS' });
      return;
    }
    manualTopupReservations.add(idempotencyReservation);
    manualTopupReservations.add(`reference:${referenceKey}`);
    const id = crypto.randomUUID();
    const extension = proofMimeType === 'image/png' ? 'png' : proofMimeType === 'image/webp' ? 'webp' : 'jpg';
    const proofFile = `${id}.${extension}`;
    try {
      await serverDB.saveManualTopupProof(proofFile, proofMimeType, proofBytes);
    } catch (error) {
      manualTopupReservations.delete(idempotencyReservation);
      manualTopupReservations.delete(`reference:${referenceKey}`);
      console.error('Manual top-up proof storage failed:', error);
      res.status(500).json({ error: 'PAYMENT_PROOF_STORAGE_FAILED' });
      return;
    }

    const request: ServerManualTopupRequest = {
      id,
      request_type: requestType,
      premium_plan: requestType === 'SUBSCRIPTION' ? (planId as Exclude<PremiumPlan, 'free'>) : undefined,
      user_id: user.id,
      user_nickname: user.nickname,
      package_id: item.id,
      package_title_ar: item.title_ar,
      package_title_en: item.title_en,
      points: item.points,
      amount: item.amount,
      currency: item.currency,
      payment_method_id: method.id,
      payment_method_title_ar: method.title_ar,
      payment_method_title_en: method.title_en,
      payment_instructions_ar: method.instructions_ar,
      payment_instructions_en: method.instructions_en,
      transaction_reference: reference.trim(),
      reference_key: referenceKey,
      proof_file: proofFile,
      proof_mime_type: proofMimeType,
      status: 'PENDING',
      created_at: Date.now(),
      idempotency_key: idempotencyKey,
    };
    serverDB.manualTopupRequests.set(id, request);
    try {
      await serverDB.flushNow();
    } catch (error) {
      serverDB.manualTopupRequests.delete(id);
      await serverDB.deleteManualTopupProof(proofFile).catch((cleanupError) => {
        console.error('Failed to remove an uncommitted manual top-up proof:', cleanupError);
      });
      manualTopupReservations.delete(idempotencyReservation);
      manualTopupReservations.delete(`reference:${referenceKey}`);
      console.error('Manual top-up request persistence failed:', error);
      res.status(500).json({ error: 'MANUAL_TOPUP_STORAGE_FAILED' });
      return;
    }
    manualTopupReservations.delete(idempotencyReservation);
    manualTopupReservations.delete(`reference:${referenceKey}`);
    res.status(201).json({ request: publicManualTopupRequest(request) });
  });

  app.get('/api/admin/manual-topups', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }
    const requests = Array.from(serverDB.manualTopupRequests.values())
      .sort((a, b) => b.created_at - a.created_at)
      .slice(0, 200)
      .map(publicManualTopupRequest);
    res.json({ requests });
  });

  app.get('/api/admin/manual-topups/:id/proof', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || user.role !== 'owner') {
      res.status(403).json({ error: 'FORBIDDEN_OWNER_ONLY' });
      return;
    }
    const request = serverDB.manualTopupRequests.get(req.params.id);
    if (!request) {
      res.status(404).json({ error: 'MANUAL_TOPUP_NOT_FOUND' });
      return;
    }
    try {
      const proof = await serverDB.readManualTopupProof(request.proof_file);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.type(proof.mimeType).send(proof.bytes);
    } catch (error) {
      console.error('Manual top-up proof could not be read:', error);
      res.status(404).json({ error: 'PAYMENT_PROOF_NOT_FOUND' });
    }
  });

  app.post('/api/admin/manual-topups/:id/review', async (req: Request, res: Response) => {
    const reviewer = serverDB.authenticateToken(extractBearerToken(req));
    if (!reviewer || reviewer.role !== 'owner') {
      res.status(403).json({ error: 'FORBIDDEN_OWNER_ONLY' });
      return;
    }
    const request = serverDB.manualTopupRequests.get(req.params.id);
    if (!request) {
      res.status(404).json({ error: 'MANUAL_TOPUP_NOT_FOUND' });
      return;
    }
    if (request.status !== 'PENDING') {
      res.status(409).json({ error: 'MANUAL_TOPUP_ALREADY_REVIEWED' });
      return;
    }
    if (
      request.request_type === 'SUBSCRIPTION' &&
      (!request.premium_plan || !MANUAL_SUBSCRIPTION_PLANS[request.premium_plan])
    ) {
      res.status(400).json({ error: 'INVALID_MANUAL_SUBSCRIPTION' });
      return;
    }

    const decision = (req.body || {}) as { decision?: unknown; reason?: unknown };
    if (decision.decision !== 'APPROVE' && decision.decision !== 'REJECT') {
      res.status(400).json({ error: 'INVALID_REVIEW_DECISION' });
      return;
    }
    const rejectionReason =
      typeof decision.reason === 'string' ? decision.reason.trim().slice(0, 500) : '';
    if (decision.decision === 'REJECT' && rejectionReason.length < 2) {
      res.status(400).json({ error: 'REJECTION_REASON_REQUIRED' });
      return;
    }

    const targetUser = serverDB.users.get(request.user_id);
    if (!targetUser) {
      res.status(404).json({ error: 'TOPUP_USER_NOT_FOUND' });
      return;
    }
    const previousPoints = targetUser.points;
    const previousStatus = request.status;
    const previousReviewedAt = request.reviewed_at;
    const previousReviewer = request.reviewed_by;
    const previousReason = request.rejection_reason;
    const previousPremium = {
      is_premium: targetUser.is_premium,
      premium_plan: targetUser.premium_plan,
      premium_expires_at: targetUser.premium_expires_at,
    };
    let transaction: ServerPaymentTransaction | undefined;
    if (decision.decision === 'APPROVE') {
      targetUser.points += request.points;
      if (request.request_type === 'SUBSCRIPTION' && request.premium_plan) {
        const plan = MANUAL_SUBSCRIPTION_PLANS[request.premium_plan];
        const currentExpiry = serverDB.isPremiumActive(targetUser)
          ? targetUser.premium_expires_at
          : undefined;
        const startAt = Math.max(currentExpiry ?? Date.now(), Date.now());
        targetUser.is_premium = true;
        targetUser.premium_plan = request.premium_plan;
        targetUser.premium_expires_at = startAt + plan.duration_days * 24 * 60 * 60 * 1000;
      }
      transaction = {
        id: crypto.randomUUID(),
        user_id: targetUser.id,
        user_nickname: targetUser.nickname,
        type: request.request_type === 'SUBSCRIPTION' ? 'SUBSCRIPTION' : 'MANUAL_TOPUP',
        item_id: request.package_id,
        item_title: request.package_title_ar,
        amount_usd: request.currency === 'USD' ? request.amount : 0,
        amount_currency: `${request.amount} ${request.currency}`,
        points_delta: request.points,
        status: 'COMPLETED',
        order_id: request.id,
        idempotency_key: `manual-topup-${request.id}`,
        created_at: Date.now(),
      };
      serverDB.paymentTransactions.set(transaction.id, transaction);
      serverDB.idempotencyKeys.add(transaction.idempotency_key);
    }
    request.status = decision.decision === 'APPROVE' ? 'APPROVED' : 'REJECTED';
    request.reviewed_at = Date.now();
    request.reviewed_by = reviewer.id;
    request.rejection_reason = decision.decision === 'REJECT' ? rejectionReason : undefined;

    try {
      await serverDB.flushNow();
    } catch (error) {
      targetUser.points = previousPoints;
      targetUser.is_premium = previousPremium.is_premium;
      targetUser.premium_plan = previousPremium.premium_plan;
      targetUser.premium_expires_at = previousPremium.premium_expires_at;
      request.status = previousStatus;
      request.reviewed_at = previousReviewedAt;
      request.reviewed_by = previousReviewer;
      request.rejection_reason = previousReason;
      if (transaction) {
        serverDB.paymentTransactions.delete(transaction.id);
        serverDB.idempotencyKeys.delete(transaction.idempotency_key);
      }
      console.error('Manual top-up review persistence failed:', error);
      res.status(500).json({ error: 'MANUAL_TOPUP_REVIEW_STORAGE_FAILED' });
      return;
    }

    sendToUser(targetUser.id, {
      type: 'wallet:manual_topup_decision',
      request_id: request.id,
      status: request.status,
      request_type: request.request_type || 'TOPUP',
      premium_plan: request.premium_plan,
      points_delta: transaction?.points_delta ?? 0,
      points_balance: targetUser.points,
      is_premium: targetUser.is_premium,
      premium_expires_at: targetUser.premium_expires_at,
      rejection_reason: request.rejection_reason || '',
      transaction,
    });
    res.json({
      request: publicManualTopupRequest(request),
      transaction,
      points_balance: targetUser.points,
    });
  });

  app.get('/api/admin/manual-topups/config', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || user.role !== 'owner') {
      res.status(403).json({ error: 'FORBIDDEN_OWNER_ONLY' });
      return;
    }
    res.json({
      packages: serverDB.manualTopupPackages,
      payment_methods: serverDB.manualPaymentMethods,
    });
  });

  app.put('/api/admin/manual-topups/config', async (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || user.role !== 'owner') {
      res.status(403).json({ error: 'FORBIDDEN_OWNER_ONLY' });
      return;
    }
    const body = (req.body || {}) as {
      packages?: unknown;
      payment_methods?: unknown;
    };
    const isText = (value: unknown, max: number) =>
      typeof value === 'string' && value.trim().length > 0 && value.trim().length <= max;
    const validId = (value: unknown) =>
      typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value);
    const validPackages =
      Array.isArray(body.packages) &&
      body.packages.length <= 50 &&
      body.packages.every((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const pack = entry as Partial<ServerManualTopupPackage>;
        return (
          validId(pack.id) &&
          isText(pack.title_ar, 60) &&
          isText(pack.title_en, 60) &&
          Number.isSafeInteger(pack.points) &&
          Number(pack.points) > 0 &&
          Number(pack.points) <= 10_000_000 &&
          typeof pack.amount === 'number' &&
          Number.isFinite(pack.amount) &&
          pack.amount > 0 &&
          pack.amount <= 1_000_000 &&
          Math.round(pack.amount * 100) === pack.amount * 100 &&
          typeof pack.currency === 'string' &&
          /^[A-Z]{3}$/.test(pack.currency) &&
          typeof pack.enabled === 'boolean'
        );
      });
    const validMethods =
      Array.isArray(body.payment_methods) &&
      body.payment_methods.length <= 50 &&
      body.payment_methods.every((entry) => {
        if (!entry || typeof entry !== 'object') return false;
        const method = entry as Partial<ServerManualPaymentMethod>;
        return (
          validId(method.id) &&
          isText(method.title_ar, 60) &&
          isText(method.title_en, 60) &&
          isText(method.instructions_ar, 1000) &&
          isText(method.instructions_en, 1000) &&
          typeof method.enabled === 'boolean'
        );
      });
    if (!validPackages || !validMethods) {
      res.status(400).json({ error: 'INVALID_MANUAL_TOPUP_CONFIGURATION' });
      return;
    }
    const packages = body.packages as ServerManualTopupPackage[];
    const methods = body.payment_methods as ServerManualPaymentMethod[];
    if (
      new Set(packages.map((pack) => pack.id)).size !== packages.length ||
      new Set(methods.map((method) => method.id)).size !== methods.length
    ) {
      res.status(400).json({ error: 'DUPLICATE_CONFIGURATION_ID' });
      return;
    }
    const previousPackages = serverDB.manualTopupPackages;
    const previousMethods = serverDB.manualPaymentMethods;
    serverDB.manualTopupPackages = packages.map((pack) => ({
      ...pack,
      title_ar: pack.title_ar.trim(),
      title_en: pack.title_en.trim(),
    }));
    serverDB.manualPaymentMethods = methods.map((method) => ({
      ...method,
      title_ar: method.title_ar.trim(),
      title_en: method.title_en.trim(),
      instructions_ar: method.instructions_ar.trim(),
      instructions_en: method.instructions_en.trim(),
    }));
    try {
      await serverDB.flushNow();
    } catch (error) {
      serverDB.manualTopupPackages = previousPackages;
      serverDB.manualPaymentMethods = previousMethods;
      console.error('Manual top-up configuration persistence failed:', error);
      res.status(500).json({ error: 'MANUAL_TOPUP_CONFIG_STORAGE_FAILED' });
      return;
    }
    res.json({ packages: serverDB.manualTopupPackages, payment_methods: serverDB.manualPaymentMethods });
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
      if (frameConfig.vipOnly && !serverDB.isPremiumActive(user)) {
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

      const {
        auth_token_hash: _hidden,
        recovery_code_hash: _recoveryHash,
        auth_username: _authUsername,
        password_hash: _passwordHash,
        ...safeSelf
      } = user;
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

      const {
        auth_token_hash: _hidden,
        recovery_code_hash: _recoveryHash,
        auth_username: _authUsername,
        password_hash: _passwordHash,
        ...safeSelf
      } = user;
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

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = user;
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
      const {
        auth_token_hash: _hidden,
        recovery_code_hash: _recoveryHash,
        auth_username: _authUsername,
        password_hash: _passwordHash,
        ...safeSelf
      } = user;
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

    const {
      auth_token_hash: _hidden,
      recovery_code_hash: _recoveryHash,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeSelf
    } = user;
    res.json({
      ok: true,
      role: user.role,
      selfUser: { ...safeSelf, is_self: true, is_online: true },
    });
  });

  app.get('/api/account/ban-appeal', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    const appeal = Array.from(serverDB.banAppeals.values()).find(
      (item) => item.user_id === user.id
    );
    res.json({ appeal: appeal ?? null });
  });

  app.post('/api/account/ban-appeal', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user) {
      res.status(401).json({ error: 'UNAUTHORIZED' });
      return;
    }
    if (user.status !== 'banned') {
      res.status(409).json({ error: 'ACCOUNT_NOT_BANNED' });
      return;
    }
    const existing = Array.from(serverDB.banAppeals.values()).find(
      (item) => item.user_id === user.id
    );
    if (existing) {
      res.status(409).json({ error: 'BAN_APPEAL_ALREADY_SUBMITTED', appeal: existing });
      return;
    }
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
    if (message.length < 20 || message.length > 2000) {
      res.status(400).json({ error: 'BAN_APPEAL_MESSAGE_MUST_BE_20_TO_2000_CHARACTERS' });
      return;
    }
    const appeal: ServerBanAppeal = {
      id: `appeal-${crypto.randomUUID()}`,
      user_id: user.id,
      user_nickname: user.nickname,
      ban_reason: user.ban_reason || 'حظر دائم',
      message,
      status: 'PENDING',
      created_at: Date.now(),
    };
    serverDB.banAppeals.set(appeal.id, appeal);
    serverDB.scheduleSave();
    res.status(201).json({ appeal });
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

  app.get('/api/admin/ban-appeals', (req: Request, res: Response) => {
    const user = serverDB.authenticateToken(extractBearerToken(req));
    if (!user || (user.role !== 'owner' && user.role !== 'moderator')) {
      res.status(403).json({ error: 'FORBIDDEN_STAFF_ONLY' });
      return;
    }
    const appeals = Array.from(serverDB.banAppeals.values()).sort(
      (a, b) => b.created_at - a.created_at
    );
    res.json({ appeals });
  });

  app.post('/api/admin/ban-appeals/:appealId/review', (req: Request, res: Response) => {
    const staff = serverDB.authenticateToken(extractBearerToken(req));
    if (!staff || staff.role !== 'owner') {
      res.status(403).json({ error: 'FORBIDDEN_OWNER_ONLY' });
      return;
    }
    const appeal = serverDB.banAppeals.get(req.params.appealId || '');
    if (!appeal) {
      res.status(404).json({ error: 'BAN_APPEAL_NOT_FOUND' });
      return;
    }
    if (appeal.status !== 'PENDING') {
      res.status(409).json({ error: 'BAN_APPEAL_ALREADY_REVIEWED' });
      return;
    }
    const { decision, note } = (req.body || {}) as {
      decision?: 'ACCEPT' | 'REJECT';
      note?: string;
    };
    if (decision !== 'ACCEPT' && decision !== 'REJECT') {
      res.status(400).json({ error: 'INVALID_BAN_APPEAL_DECISION' });
      return;
    }
    const cleanNote = typeof note === 'string' ? note.trim().slice(0, 1000) : '';
    if (cleanNote.length < 2) {
      res.status(400).json({ error: 'BAN_APPEAL_REVIEW_NOTE_REQUIRED' });
      return;
    }
    const targetUser = serverDB.users.get(appeal.user_id);
    if (!targetUser) {
      res.status(404).json({ error: 'APPEAL_ACCOUNT_NOT_FOUND' });
      return;
    }
    const now = Date.now();
    appeal.status = decision === 'ACCEPT' ? 'ACCEPTED' : 'REJECTED';
    appeal.reviewed_at = now;
    appeal.reviewed_by = staff.id;
    appeal.reviewed_by_name = staff.nickname;
    appeal.review_note = cleanNote;
    if (decision === 'ACCEPT') {
      targetUser.status = 'active';
      targetUser.ban_reason = undefined;
      targetUser.banned_at = undefined;
      targetUser.warning_message = undefined;
      targetUser.restriction_reason = undefined;
      targetUser.suspension_until = undefined;
    }
    const auditAction: ServerModerationAction = {
      id: `act-${crypto.randomUUID().slice(0, 8)}`,
      moderator_id: staff.id,
      moderator_name: staff.nickname,
      moderator_role: staff.role,
      target_user_id: targetUser.id,
      target_user_nickname: targetUser.nickname,
      action_type: decision === 'ACCEPT' ? 'BAN_APPEAL_ACCEPT' : 'BAN_APPEAL_REJECT',
      reason: cleanNote,
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
    });
    broadcastStaff({ type: 'ban_appeal:updated', appeal, auditAction });
    const {
      auth_token_hash: _token,
      recovery_code_hash: _recovery,
      auth_username: _authUsername,
      password_hash: _passwordHash,
      ...safeUser
    } = targetUser;
    res.json({
      ok: true,
      appeal,
      auditAction,
      ...(decision === 'ACCEPT' ? { selfUser: { ...safeUser, is_self: true } } : {}),
    });
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
    const premiumUsers = allUsers.filter((u) => serverDB.isPremiumActive(u)).length;

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
        is_premium: serverDB.isPremiumActive(u),
        premium_plan: u.premium_plan,
        premium_expires_at: u.premium_expires_at,
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

  app.post('/api/admin/users/coins', async (req: Request, res: Response) => {
    const staff = serverDB.authenticateToken(extractBearerToken(req));
    if (!staff || staff.role !== 'owner') {
      res.status(403).json({ error: 'FORBIDDEN_OWNER_ONLY' });
      return;
    }
    if (!verifyAccountActive(staff, res)) return;

    const username =
      typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    const amount = req.body?.amount;
    if (!username || username.length > 64) {
      res.status(400).json({ error: 'INVALID_USERNAME' });
      return;
    }
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10_000_000) {
      res.status(400).json({ error: 'INVALID_COIN_AMOUNT' });
      return;
    }

    const exactSlugMatches = Array.from(serverDB.personalLinks.values())
      .filter((link) => link.slug.toLowerCase() === username)
      .map((link) => serverDB.users.get(link.user_id))
      .filter((user): user is ServerUserRecord => Boolean(user));
    const exactNicknameMatches = Array.from(serverDB.users.values()).filter(
      (user) => user.nickname.trim().toLowerCase() === username
    );
    const matches = exactSlugMatches.length ? exactSlugMatches : exactNicknameMatches;
    if (matches.length === 0) {
      res.status(404).json({ error: 'USER_NOT_FOUND' });
      return;
    }
    if (matches.length > 1) {
      res.status(409).json({ error: 'USERNAME_NOT_UNIQUE' });
      return;
    }

    const targetUser = matches[0];
    const previousPoints = targetUser.points;
    const pointsBalance = previousPoints + amount;
    if (!Number.isSafeInteger(previousPoints) || !Number.isSafeInteger(pointsBalance)) {
      res.status(409).json({ error: 'COIN_BALANCE_LIMIT_REACHED' });
      return;
    }

    const transactionId = crypto.randomUUID();
    const transaction: ServerPaymentTransaction = {
      id: transactionId,
      user_id: targetUser.id,
      user_nickname: targetUser.nickname,
      type: 'ADMIN_CREDIT',
      item_id: 'admin-coin-grant',
      item_title: `منح عملات إدارية بواسطة ${staff.nickname}`,
      amount_usd: 0,
      amount_currency: 'ADMIN_GRANT',
      points_delta: amount,
      status: 'COMPLETED',
      order_id: `admin-coin-grant-${transactionId}`,
      idempotency_key: `admin-coin-grant-${transactionId}`,
      created_at: Date.now(),
    };
    targetUser.points = pointsBalance;
    serverDB.paymentTransactions.set(transaction.id, transaction);
    serverDB.idempotencyKeys.add(transaction.idempotency_key);

    try {
      await serverDB.flushNow();
    } catch (error) {
      targetUser.points = previousPoints;
      serverDB.paymentTransactions.delete(transaction.id);
      serverDB.idempotencyKeys.delete(transaction.idempotency_key);
      console.error('Admin coin grant persistence failed:', error);
      res.status(500).json({ error: 'COIN_GRANT_STORAGE_FAILED' });
      return;
    }

    sendToUser(targetUser.id, {
      type: 'wallet:admin_credit',
      points_delta: amount,
      points_balance: pointsBalance,
      transaction,
    });
    res.json({
      ok: true,
      nickname: targetUser.nickname,
      points_delta: amount,
      points_balance: pointsBalance,
    });
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
      if (
        role === 'owner' &&
        (!Number.isFinite(targetUser.points) || targetUser.points < OWNER_MIN_POINTS)
      ) {
        targetUser.points = OWNER_MIN_POINTS;
      }
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
      points: targetUser.points,
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

  app.get('/.well-known/assetlinks.json', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'com.fadfadahnative',
          sha256_cert_fingerprints: [
            '75:50:A0:DA:1D:64:1D:45:B2:8C:87:EE:23:CF:80:8C:E4:F4:C6:64:2B:C0:30:B2:F6:36:7A:7B:14:DB:AC:9B',
          ],
        },
      },
    ]);
  });

  // Support clean /u/:slug share links in both browsers and verified Android App Links.
  app.get('/u/:slug', (req: Request, res: Response) => {
    res.redirect(302, `/?u=${encodeURIComponent(req.params.slug || '')}`);
  });

  // Serve SPA via Vite in dev or static dist/ in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        allowedHosts: ['fadfada.94.237.56.203.nip.io'],
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
