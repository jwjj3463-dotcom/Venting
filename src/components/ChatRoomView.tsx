import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Ban,
  Flag,
  Send,
  Smile,
  ImagePlus,
  Check,
  CheckCheck,
  ShieldAlert,
  X,
  ShieldCheck,
  Camera,
  Mic,
  Square,
  Film,
  Phone,
  PhoneOff,
  Video,
  Gamepad2,
} from 'lucide-react';
import { FramedAvatar, OfficialBadge } from './FramedAvatar';
import {
  RealmChatRoom,
  RealmMessage,
  RealmUser,
} from '../db/realmLocalDB';
import {
  CallSignalDTO,
  ChatGameDTO,
  ChatGameEventDTO,
  fadfadahClient,
} from '../services/fadfadahNetworkClient';
import { AppLang, TRANSLATIONS } from '../i18n/translations';
import { watchAndroidSafeChatScreenshots } from '../services/androidNative';
import { CasualGameArena } from '../games/components/CasualGameArena';

interface ChatRoomViewProps {
  room: RealmChatRoom;
  selfUser: RealmUser;
  peerUser: RealmUser;
  messages: RealmMessage[];
  lang: AppLang;
  onBack: () => void;
}

const EXPRESSIVE_STICKERS = [
  { id: 'support', labelAr: 'أنا أسمعك', labelEn: 'Here for you', symbol: '💜' },
  { id: 'coffee', labelAr: 'قهوة هادئة', labelEn: 'Warm Coffee', symbol: '☕' },
  { id: 'star', labelAr: 'كلام ملهم', labelEn: 'Inspiring', symbol: '✨' },
  { id: 'peace', labelAr: 'سلام وهدوء', labelEn: 'Peaceful', symbol: '🌿' },
  { id: 'smile', labelAr: 'شكراً جزيلاً', labelEn: 'Thank you', symbol: '🌸' },
];

const MAX_CHAT_IMAGE_SIZE = 2.5 * 1024 * 1024;
const MAX_CHAT_IMAGE_PAYLOAD_SIZE = 650 * 1024;
const MAX_CHAT_AUDIO_PAYLOAD_SIZE = 650 * 1024;
const MAX_CHAT_VIDEO_SIZE = 3 * 1024 * 1024;
const CONNECT_FOUR_ROWS = 6;
const CONNECT_FOUR_COLUMNS = 7;
const TIC_TAC_TOE_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function getTicTacToeWinner(board: Array<'X' | 'O' | null>): 'X' | 'O' | null {
  const line = TIC_TAC_TOE_LINES.find(([a, b, c]) =>
    board[a] !== null && board[a] === board[b] && board[a] === board[c]
  );
  return line ? board[line[0]] : null;
}

function chooseComputerTicTacToeMove(board: Array<'X' | 'O' | null>): number {
  const available = board.flatMap((cell, index) => cell === null ? [index] : []);
  for (const mark of ['O', 'X'] as const) {
    for (const index of available) {
      const candidate = [...board];
      candidate[index] = mark;
      if (getTicTacToeWinner(candidate) === mark) return index;
    }
  }
  return [4, 0, 2, 6, 8, 1, 3, 5, 7].find((index) => board[index] === null) ?? -1;
}

function getConnectFourWinner(board: Array<'X' | 'O' | null>): 'X' | 'O' | null {
  for (let row = 0; row < CONNECT_FOUR_ROWS; row += 1) {
    for (let column = 0; column < CONNECT_FOUR_COLUMNS; column += 1) {
      const mark = board[row * CONNECT_FOUR_COLUMNS + column];
      if (!mark) continue;
      for (const [rowStep, columnStep] of [[0, 1], [1, 0], [1, 1], [1, -1]]) {
        const cells = Array.from({ length: 4 }, (_, offset) => {
          const nextRow = row + rowStep * offset;
          const nextColumn = column + columnStep * offset;
          return nextRow >= 0 && nextRow < CONNECT_FOUR_ROWS &&
            nextColumn >= 0 && nextColumn < CONNECT_FOUR_COLUMNS
            ? board[nextRow * CONNECT_FOUR_COLUMNS + nextColumn]
            : null;
        });
        if (cells.every((cell) => cell === mark)) return mark;
      }
    }
  }
  return null;
}

function dropConnectFourChip(
  board: Array<'X' | 'O' | null>,
  column: number,
  mark: 'X' | 'O'
): Array<'X' | 'O' | null> | null {
  if (!Number.isInteger(column) || column < 0 || column >= CONNECT_FOUR_COLUMNS) return null;
  const nextBoard = [...board];
  for (let row = CONNECT_FOUR_ROWS - 1; row >= 0; row -= 1) {
    const index = row * CONNECT_FOUR_COLUMNS + column;
    if (nextBoard[index] === null) {
      nextBoard[index] = mark;
      return nextBoard;
    }
  }
  return null;
}

function chooseComputerConnectFourMove(board: Array<'X' | 'O' | null>): number {
  const availableColumns = [3, 2, 4, 1, 5, 0, 6].filter(
    (column) => board[column] === null
  );
  for (const mark of ['O', 'X'] as const) {
    for (const column of availableColumns) {
      const nextBoard = dropConnectFourChip(board, column, mark);
      if (nextBoard && getConnectFourWinner(nextBoard) === mark) return column;
    }
  }
  return availableColumns[0] ?? -1;
}

function createSecretCode(): string {
  return Array.from({ length: 10 }, (_, digit) => String(digit))
    .sort(() => Math.random() - 0.5)
    .slice(0, 4)
    .join('');
}

function scoreSecretCode(secret: string, guess: string): { bulls: number; cows: number } {
  const bulls = [...guess].filter((digit, index) => secret[index] === digit).length;
  const matchingDigits = [...guess].filter((digit) => secret.includes(digit)).length;
  return { bulls, cows: matchingDigits - bulls };
}

async function prepareChatImage(file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('UNSUPPORTED_IMAGE_TYPE');
  }

  const bitmap = await createImageBitmap(file);
  try {
    let scale = Math.min(1, 1280 / Math.max(bitmap.width, bitmap.height));
    for (let resizeAttempt = 0; resizeAttempt < 5; resizeAttempt += 1) {
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d');
      if (!context) throw new Error('IMAGE_PROCESSING_FAILED');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      let quality = 0.82;
      for (let qualityAttempt = 0; qualityAttempt < 5; qualityAttempt += 1) {
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, 'image/jpeg', quality)
        );
        if (!blob) throw new Error('IMAGE_PROCESSING_FAILED');
        if (blob.size <= MAX_CHAT_IMAGE_PAYLOAD_SIZE) {
          return await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(new Error('IMAGE_PROCESSING_FAILED'));
            reader.readAsDataURL(blob);
          });
        }
        quality -= 0.1;
      }
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new Error('IMAGE_TOO_LARGE_AFTER_COMPRESSION');
}

export const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  room,
  selfUser,
  peerUser,
  messages,
  lang,
  onBack,
}) => {
  const t = TRANSLATIONS[lang];
  const [inputText, setInputText] = useState('');
  const [showStickers, setShowStickers] = useState(false);
  const [peerTyping, setPeerTyping] = useState(() =>
    fadfadahClient.isPeerTypingInRoom(room.id)
  );
  const [moderationNotice, setModerationNotice] = useState('');
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('إزعاج أو سلوك غير لائق');
  const [submittingReport, setSubmittingReport] = useState(false);
  const [reportFeedback, setReportFeedback] = useState('');
  const [safeChatDuration, setSafeChatDuration] = useState(60);
  const [safeChatBusy, setSafeChatBusy] = useState(false);
  const [safeChatNotice, setSafeChatNotice] = useState('');
  const [safeChatNow, setSafeChatNow] = useState(Date.now());
  const [captureSupported, setCaptureSupported] = useState(false);
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [callBusy, setCallBusy] = useState(false);
  const [activeCall, setActiveCall] = useState<{
    id: string;
    type: 'audio' | 'video';
    status: 'connecting' | 'active';
  } | null>(null);
  const [incomingCall, setIncomingCall] = useState<{
    id: string;
    type: 'audio' | 'video';
    offer?: RTCSessionDescriptionInit;
  } | null>(null);
  const [callNotice, setCallNotice] = useState('');
  const [chatGame, setChatGame] = useState<ChatGameDTO | null>(null);
  const [gameNotice, setGameNotice] = useState('');
  const [gameNumberInput, setGameNumberInput] = useState('');
  const [showGamePicker, setShowGamePicker] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const chatGameRef = useRef<ChatGameDTO | null>(null);
  const computerGuessSecretRef = useRef<number | null>(null);
  const computerCodeSecretRef = useRef<string | null>(null);
  const computerMoveTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioTooLargeRef = useRef(false);
  const recordingCancelledRef = useRef(false);
  const typingTimeoutRef = useRef<number | null>(null);
  const lastScreenshotNoticeRef = useRef(0);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localCallStreamRef = useRef<MediaStream | null>(null);
  const remoteCallStreamRef = useRef<MediaStream | null>(null);
  const localCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteCallAudioRef = useRef<HTMLAudioElement | null>(null);
  const activeCallRef = useRef<{ id: string; type: 'audio' | 'video' } | null>(null);
  const incomingCallRef = useRef<{
    id: string;
    type: 'audio' | 'video';
    offer?: RTCSessionDescriptionInit;
  } | null>(null);
  const pendingIceRef = useRef<RTCIceCandidateInit[]>([]);
  const callBusyRef = useRef(false);

  const setCallInProgress = (inProgress: boolean) => {
    callBusyRef.current = inProgress;
    setCallBusy(inProgress);
  };

  const endCall = (notifyPeer: boolean) => {
    const callId = activeCallRef.current?.id || incomingCallRef.current?.id;
    if (notifyPeer && callId) fadfadahClient.sendCallSignal(room.id, callId, 'end');
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    localCallStreamRef.current?.getTracks().forEach((track) => track.stop());
    localCallStreamRef.current = null;
    remoteCallStreamRef.current = null;
    activeCallRef.current = null;
    incomingCallRef.current = null;
    pendingIceRef.current = [];
    setActiveCall(null);
    setIncomingCall(null);
    setCallInProgress(false);
  };

  const createCallPeerConnection = async (
    callId: string,
    stream: MediaStream,
    iceServers: RTCIceServer[]
  ): Promise<RTCPeerConnection> => {
    const connection = new RTCPeerConnection({ iceServers });
    peerConnectionRef.current = connection;
    stream.getTracks().forEach((track) => connection.addTrack(track, stream));
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        fadfadahClient.sendCallSignal(room.id, callId, 'ice', event.candidate.toJSON());
      }
    };
    connection.ontrack = (event) => {
      const remote = event.streams[0];
      if (!remote) return;
      remoteCallStreamRef.current = remote;
      setActiveCall((current) => current ? { ...current, status: 'active' } : current);
    };
    connection.onconnectionstatechange = () => {
      if (connection.connectionState === 'connected') {
        setActiveCall((current) => current ? { ...current, status: 'active' } : current);
      } else if (connection.connectionState === 'failed') {
        setCallNotice(
          lang === 'ar'
            ? 'تعذر إنشاء اتصال آمن. تحقق من إعدادات TURN وحاول مجددًا.'
            : lang === 'fr'
              ? 'Connexion impossible. Vérifiez la configuration TURN et réessayez.'
              : 'Could not establish a connection. Check TURN configuration and try again.'
        );
        endCall(true);
      }
    };
    return connection;
  };

  const flushPendingIce = async (connection: RTCPeerConnection) => {
    const candidates = pendingIceRef.current;
    pendingIceRef.current = [];
    for (const candidate of candidates) {
      await connection.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const handleCallSignal = async (signal: CallSignalDTO) => {
    if (signal.roomId !== room.id || signal.fromUserId === selfUser.id) return;
    if (signal.signalKind === 'start') {
      if (activeCallRef.current || incomingCallRef.current) {
        fadfadahClient.sendCallSignal(room.id, signal.callId, 'end');
        return;
      }
      const incoming = {
        id: signal.callId,
        type: signal.callType === 'video' ? 'video' as const : 'audio' as const,
      };
      incomingCallRef.current = incoming;
      setIncomingCall(incoming);
      setCallNotice('');
      return;
    }
    if (signal.signalKind === 'offer' && signal.signal && 'type' in signal.signal) {
      const current = incomingCallRef.current;
      if (current?.id === signal.callId) {
        const updated = { ...current, offer: signal.signal as RTCSessionDescriptionInit };
        incomingCallRef.current = updated;
        setIncomingCall(updated);
      }
      return;
    }
    if (signal.signalKind === 'answer' && signal.signal && 'type' in signal.signal) {
      const connection = peerConnectionRef.current;
      if (activeCallRef.current?.id === signal.callId && connection) {
        await connection.setRemoteDescription(
          new RTCSessionDescription(signal.signal as RTCSessionDescriptionInit)
        );
        await flushPendingIce(connection);
      }
      return;
    }
    if (signal.signalKind === 'ice' && signal.signal && 'candidate' in signal.signal) {
      const candidate = signal.signal as RTCIceCandidateInit;
      if (
        activeCallRef.current?.id !== signal.callId &&
        incomingCallRef.current?.id !== signal.callId
      ) return;
      const connection = peerConnectionRef.current;
      if (activeCallRef.current?.id === signal.callId && connection?.remoteDescription) {
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
      } else if (!connection?.remoteDescription) {
        pendingIceRef.current.push(candidate);
      }
      return;
    }
    if (signal.signalKind === 'end') {
      endCall(false);
    }
  };

  const handleChatGameEvent = (event: ChatGameEventDTO) => {
    if (event.game.roomId !== room.id) return;
    if (event.type === 'game:end') {
      chatGameRef.current = null;
      computerGuessSecretRef.current = null;
      computerCodeSecretRef.current = null;
      setChatGame(null);
      setGameNumberInput('');
      setGameNotice(
        event.reason === 'declined'
          ? lang === 'ar' ? 'رفض الطرف الآخر دعوة اللعبة.' : lang === 'fr' ? 'Votre partenaire a refusé la partie.' : 'The other user declined the game.'
          : event.reason === 'expired'
            ? lang === 'ar' ? 'انتهت صلاحية دعوة اللعبة لعدم الرد.' : lang === 'fr' ? 'L’invitation a expiré sans réponse.' : 'The game invitation expired without a response.'
          : event.reason === 'disconnected'
            ? lang === 'ar' ? 'انتهت اللعبة لانقطاع اتصال أحد اللاعبين.' : lang === 'fr' ? 'La partie a pris fin après une déconnexion.' : 'The game ended because a player disconnected.'
            : ''
      );
      return;
    }
    chatGameRef.current = event.game;
    setGameNotice('');
    setChatGame(event.game);
  };

  const inviteToGame = (gameType: ChatGameDTO['gameType']) => {
    const sent = fadfadahClient.inviteToChatGame(room.id, crypto.randomUUID(), gameType);
    setShowGamePicker(false);
    setGameNotice(
      sent
        ? ''
        : lang === 'ar' ? 'تعذر إرسال الدعوة؛ تحقق من اتصال المحادثة.' : lang === 'fr' ? 'Impossible d’envoyer l’invitation. Vérifiez la connexion.' : 'Could not send the invitation. Check the chat connection.'
    );
  };

  const startComputerGame = (gameType: ChatGameDTO['gameType']) => {
    const game: ChatGameDTO = {
      id: crypto.randomUUID(),
      roomId: room.id,
      createdAt: Date.now(),
      gameType,
      inviterId: selfUser.id,
      opponentId: 'computer',
      status: 'active',
      board: gameType === 'guess-number'
        || gameType === 'bulls-cows'
        || gameType === 'pig-dice'
        || gameType === 'nim'
        ? []
        : Array(gameType === 'connect-four' ? CONNECT_FOUR_ROWS * CONNECT_FOUR_COLUMNS : 9).fill(null),
      turnUserId: selfUser.id,
      winner: null,
      round: gameType === 'rock-paper-scissors' ? 1 : undefined,
      roundWinners: gameType === 'rock-paper-scissors' ? [] : undefined,
      ...(gameType === 'guess-number' || gameType === 'bulls-cows' ? { secretReady: true } : {}),
      ...(gameType === 'pig-dice'
        ? { scores: { [selfUser.id]: 0, computer: 0 }, turnPoints: 0 }
        : {}),
      ...(gameType === 'nim' ? { nimHeaps: [3, 4, 5] } : {}),
      computerMode: true,
    };
    computerGuessSecretRef.current =
      gameType === 'guess-number' ? Math.floor(Math.random() * 100) + 1 : null;
    computerCodeSecretRef.current = gameType === 'bulls-cows' ? createSecretCode() : null;
    chatGameRef.current = game;
    setChatGame(game);
    setGameNumberInput('');
    setShowGamePicker(false);
    setGameNotice('');
  };

  const submitNumberSecret = () => {
    const game = chatGameRef.current;
    const secret = game?.gameType === 'bulls-cows' ? gameNumberInput : Number(gameNumberInput);
    const isValidSecret = game?.gameType === 'bulls-cows'
      ? /^\d{4}$/.test(String(secret)) && new Set(String(secret)).size === 4
      : Number.isInteger(secret) && Number(secret) >= 1 && Number(secret) <= 100;
    if (
      !game ||
      !['guess-number', 'bulls-cows'].includes(game.gameType) ||
      game.computerMode ||
      game.inviterId !== selfUser.id ||
      !isValidSecret
    ) {
      setGameNotice(
        game?.gameType === 'bulls-cows'
          ? lang === 'ar'
            ? 'اختر رمزًا من 4 أرقام مختلفة.'
            : lang === 'fr'
              ? 'Choisissez un code de 4 chiffres différents.'
              : 'Choose a 4-digit code with unique digits.'
          : lang === 'ar'
            ? 'اختر رقمًا صحيحًا من 1 إلى 100.'
            : lang === 'fr'
              ? 'Choisissez un nombre entier de 1 à 100.'
              : 'Choose a whole number from 1 to 100.'
      );
      return;
    }
    if (!fadfadahClient.setChatGameSecret(game.id, secret)) {
      setGameNotice(
        lang === 'ar'
          ? 'تعذر إرسال الرقم السري؛ تحقق من الاتصال.'
          : lang === 'fr'
            ? 'Impossible d’envoyer le nombre secret. Vérifiez la connexion.'
            : 'Could not submit the secret number. Check the connection.'
      );
      return;
    }
    setGameNumberInput('');
    setGameNotice('');
  };

  const updateComputerGame = (update: (game: ChatGameDTO) => ChatGameDTO) => {
    const current = chatGameRef.current;
    if (!current) return;
    const next = update(current);
    chatGameRef.current = next;
    setChatGame(next);
  };

  const runComputerPigTurn = (gameId: string): void => {
    computerMoveTimerRef.current = window.setTimeout(() => {
      computerMoveTimerRef.current = null;
      const current = chatGameRef.current;
      if (
        !current ||
        current.id !== gameId ||
        current.status !== 'active' ||
        current.turnUserId !== 'computer'
      ) return;
      const roll = Math.floor(Math.random() * 6) + 1;
      if (roll === 1) {
        updateComputerGame((latest) => ({
          ...latest,
          turnPoints: 0,
          lastDieRoll: roll,
          turnUserId: selfUser.id,
        }));
        return;
      }

      const turnPoints = (current.turnPoints ?? 0) + roll;
      const shouldHold = Math.random() < 0.35;
      updateComputerGame((latest) => ({
        ...latest,
        turnPoints: shouldHold ? 0 : turnPoints,
        scores: shouldHold
          ? { ...latest.scores, computer: (latest.scores?.computer ?? 0) + turnPoints }
          : latest.scores,
        lastDieRoll: roll,
        turnUserId: shouldHold ? selfUser.id : 'computer',
      }));
      if (!shouldHold) runComputerPigTurn(gameId);
    }, 450);
  };

  const runComputerNimTurn = (gameId: string): void => {
    computerMoveTimerRef.current = window.setTimeout(() => {
      computerMoveTimerRef.current = null;
      const current = chatGameRef.current;
      if (
        !current ||
        current.id !== gameId ||
        current.gameType !== 'nim' ||
        current.status !== 'active' ||
        current.turnUserId !== 'computer'
      ) return;
      const heaps = [...(current.nimHeaps ?? [])];
      const availableHeaps = heaps.flatMap((size, index) => size > 0 ? [index] : []);
      if (availableHeaps.length === 0) return;
      const heapIndex = availableHeaps[Math.floor(Math.random() * availableHeaps.length)];
      heaps[heapIndex] -= Math.floor(Math.random() * heaps[heapIndex]) + 1;
      const isLastMove = heaps.every((size) => size === 0);
      updateComputerGame((latest) => ({
        ...latest,
        nimHeaps: heaps,
        turnUserId: selfUser.id,
        status: isLastMove ? 'finished' : 'active',
        winner: isLastMove ? 'X' : null,
      }));
    }, 450);
  };

  const makeGameMove = (
    move:
      | number
      | { choice: 'rock' | 'paper' | 'scissors' }
      | { guess: number }
      | { codeGuess: string }
      | { action: 'roll' | 'hold' }
      | { heapIndex: number; count: number }
  ) => {
    const game = chatGameRef.current;
    if (!game || game.status !== 'active') return;
    if (!game.computerMode) {
      if (!fadfadahClient.makeChatGameMove(game.id, move)) {
        setGameNotice(lang === 'ar' ? 'تعذر إرسال النقلة؛ تحقق من الاتصال.' : 'Could not send your move. Check the connection.');
      }
      return;
    }

    if (game.gameType === 'pig-dice' && typeof move === 'object' && 'action' in move) {
      if (move.action === 'hold') {
        updateComputerGame((current) => ({
          ...current,
          scores: {
            ...current.scores,
            [selfUser.id]: (current.scores?.[selfUser.id] ?? 0) + (current.turnPoints ?? 0),
          },
          turnPoints: 0,
          turnUserId: 'computer',
          lastDieRoll: undefined,
        }));
        runComputerPigTurn(game.id);
        return;
      }

      const roll = Math.floor(Math.random() * 6) + 1;
      if (roll === 1) {
        updateComputerGame((current) => ({
          ...current,
          turnPoints: 0,
          lastDieRoll: roll,
          turnUserId: 'computer',
        }));
        runComputerPigTurn(game.id);
        return;
      }
      updateComputerGame((current) => ({
        ...current,
        turnPoints: (current.turnPoints ?? 0) + roll,
        lastDieRoll: roll,
      }));
      return;
    }

    if (
      game.gameType === 'nim' &&
      typeof move === 'object' &&
      'heapIndex' in move &&
      Number.isInteger(move.heapIndex) &&
      Number.isInteger(move.count)
    ) {
      const heaps = [...(game.nimHeaps ?? [])];
      if (
        game.turnUserId !== selfUser.id ||
        move.heapIndex < 0 ||
        move.heapIndex >= heaps.length ||
        move.count < 1 ||
        move.count > heaps[move.heapIndex]
      ) return;
      heaps[move.heapIndex] -= move.count;
      const isLastMove = heaps.every((size) => size === 0);
      if (isLastMove) {
        updateComputerGame((current) => ({
          ...current,
          nimHeaps: heaps,
          status: 'finished',
          winner: 'O',
        }));
        return;
      }
      updateComputerGame((current) => ({
        ...current,
        nimHeaps: heaps,
        turnUserId: 'computer',
      }));
      runComputerNimTurn(game.id);
      return;
    }

    if (
      game.gameType === 'guess-number' &&
      typeof move === 'object' &&
      'guess' in move &&
      Number.isInteger(move.guess) &&
      move.guess >= 1 &&
      move.guess <= 100
    ) {
      const secret = computerGuessSecretRef.current;
      if (secret === null) return;
      const isCorrect = move.guess === secret;
      updateComputerGame((current) => ({
        ...current,
        lastGuess: move.guess,
        guessHint: isCorrect ? 'correct' : move.guess < secret ? 'higher' : 'lower',
        status: isCorrect ? 'finished' : 'active',
        winner: isCorrect ? 'X' : null,
      }));
      return;
    }

    if (
      game.gameType === 'bulls-cows' &&
      typeof move === 'object' &&
      'codeGuess' in move &&
      /^\d{4}$/.test(move.codeGuess) &&
      new Set(move.codeGuess).size === 4
    ) {
      const secret = computerCodeSecretRef.current;
      if (!secret) return;
      const score = scoreSecretCode(secret, move.codeGuess);
      const isCorrect = score.bulls === 4;
      updateComputerGame((current) => ({
        ...current,
        lastCodeGuess: move.codeGuess,
        ...score,
        status: isCorrect ? 'finished' : 'active',
        winner: isCorrect ? 'X' : null,
      }));
      return;
    }

    if (
      game.gameType === 'rock-paper-scissors' &&
      typeof move === 'object' &&
      'choice' in move
    ) {
      const computerChoice = (['rock', 'paper', 'scissors'] as const)[Math.floor(Math.random() * 3)];
      const result: 'X' | 'O' | 'DRAW' =
        move.choice === computerChoice
          ? 'DRAW'
          : (
              (move.choice === 'rock' && computerChoice === 'scissors') ||
              (move.choice === 'paper' && computerChoice === 'rock') ||
              (move.choice === 'scissors' && computerChoice === 'paper')
            )
            ? 'X'
            : 'O';
      const roundWinners = [...(game.roundWinners ?? []), result];
      const isLastRound = (game.round ?? 1) >= 3;
      const userWins = roundWinners.filter((winner) => winner === 'X').length;
      const computerWins = roundWinners.filter((winner) => winner === 'O').length;
      updateComputerGame((current) => ({
        ...current,
        roundWinners,
        round: isLastRound ? current.round : (current.round ?? 1) + 1,
        pendingMove: null,
        status: isLastRound ? 'finished' : 'active',
        winner: isLastRound
          ? userWins === computerWins ? 'DRAW' : userWins > computerWins ? 'X' : 'O'
          : null,
      }));
      return;
    }

    if (game.gameType === 'connect-four' && typeof move === 'number') {
      const board = dropConnectFourChip(game.board, move, 'X');
      if (!board) return;
      const playerWinner = getConnectFourWinner(board);
      if (playerWinner || board.every((cell) => cell !== null)) {
        updateComputerGame((current) => ({
          ...current,
          board,
          status: 'finished',
          winner: playerWinner ?? 'DRAW',
        }));
        return;
      }
      updateComputerGame((current) => ({ ...current, board, turnUserId: 'computer' }));
      computerMoveTimerRef.current = window.setTimeout(() => {
        computerMoveTimerRef.current = null;
        const current = chatGameRef.current;
        if (
          !current ||
          current.id !== game.id ||
          current.status !== 'active' ||
          current.turnUserId !== 'computer'
        ) return;
        const column = chooseComputerConnectFourMove(current.board);
        const nextBoard = dropConnectFourChip(current.board, column, 'O');
        if (!nextBoard) return;
        const winner = getConnectFourWinner(nextBoard);
        updateComputerGame((latest) => ({
          ...latest,
          board: nextBoard,
          turnUserId: selfUser.id,
          status: winner || nextBoard.every((cell) => cell !== null) ? 'finished' : 'active',
          winner: winner ?? (nextBoard.every((cell) => cell !== null) ? 'DRAW' : null),
        }));
      }, 350);
      return;
    }

    if (game.gameType !== 'tic-tac-toe' || typeof move !== 'number') return;
    if (!Number.isInteger(move) || move < 0 || move >= game.board.length || game.board[move] !== null) return;
    const board = [...game.board];
    board[move] = 'X';
    const playerWinner = getTicTacToeWinner(board);
    if (playerWinner || board.every((cell) => cell !== null)) {
      updateComputerGame((current) => ({
        ...current,
        board,
        status: 'finished',
        winner: playerWinner ?? 'DRAW',
      }));
      return;
    }

    updateComputerGame((current) => ({ ...current, board, turnUserId: 'computer' }));
    computerMoveTimerRef.current = window.setTimeout(() => {
      computerMoveTimerRef.current = null;
      const current = chatGameRef.current;
      if (
        !current ||
        current.id !== game.id ||
        current.status !== 'active' ||
        current.turnUserId !== 'computer'
      ) return;
      const computerMove = chooseComputerTicTacToeMove(current.board);
      if (computerMove < 0) return;
      const nextBoard = [...current.board];
      nextBoard[computerMove] = 'O';
      const winner = getTicTacToeWinner(nextBoard);
      updateComputerGame((latest) => ({
        ...latest,
        board: nextBoard,
        turnUserId: selfUser.id,
        status: winner || nextBoard.every((cell) => cell !== null) ? 'finished' : 'active',
        winner: winner ?? (nextBoard.every((cell) => cell !== null) ? 'DRAW' : null),
      }));
    }, 350);
  };

  const startCall = async (type: 'audio' | 'video') => {
    if (
      room.status !== 'ACCEPTED' ||
      activeCallRef.current ||
      incomingCallRef.current ||
      callBusyRef.current
    ) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
      setCallNotice(
        lang === 'ar'
          ? 'المكالمات غير مدعومة على هذا الجهاز أو المتصفح.'
          : lang === 'fr'
            ? 'Les appels ne sont pas pris en charge sur cet appareil.'
            : 'Calls are not supported on this device or browser.'
      );
      return;
    }
    setCallNotice('');
    const callId = crypto.randomUUID();
    activeCallRef.current = { id: callId, type };
    setActiveCall({ id: callId, type, status: 'connecting' });
    setCallInProgress(true);
    try {
      const iceServers = await fadfadahClient.getCallIceServers(room.id);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video',
      });
      localCallStreamRef.current = stream;
      const connection = await createCallPeerConnection(callId, stream, iceServers);
      if (!fadfadahClient.startCallSignal(room.id, callId, type)) {
        throw new Error('CALL_SIGNALING_OFFLINE');
      }
      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      if (!fadfadahClient.sendCallSignal(room.id, callId, 'offer', offer)) {
        throw new Error('CALL_SIGNALING_OFFLINE');
      }
    } catch (error) {
      console.error('Could not start WebRTC call:', error);
      endCall(true);
      setCallNotice(
        error instanceof Error && error.message === 'CALL_TURN_NOT_CONFIGURED'
          ? lang === 'ar'
            ? 'المكالمات غير مفعّلة بعد: لم يُضبط خادم TURN.'
            : lang === 'fr'
              ? 'Appels indisponibles : le serveur TURN n’est pas configuré.'
              : 'Calls are unavailable because the TURN server is not configured.'
          : lang === 'ar'
            ? 'تعذر بدء المكالمة. تحقق من أذونات الميكروفون والكاميرا والاتصال.'
            : lang === 'fr'
              ? 'Impossible de démarrer l’appel. Vérifiez les autorisations et la connexion.'
              : 'Could not start the call. Check camera/microphone permissions and connectivity.'
      );
    } finally {
      setCallInProgress(false);
    }
  };

  const acceptCall = async () => {
    const incoming = incomingCallRef.current;
    if (!incoming?.offer || callBusyRef.current) return;
    setCallInProgress(true);
    try {
      const iceServers = await fadfadahClient.getCallIceServers(room.id);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incoming.type === 'video',
      });
      localCallStreamRef.current = stream;
      const connection = await createCallPeerConnection(incoming.id, stream, iceServers);
      await connection.setRemoteDescription(new RTCSessionDescription(incoming.offer));
      await flushPendingIce(connection);
      incomingCallRef.current = null;
      setIncomingCall(null);
      activeCallRef.current = { id: incoming.id, type: incoming.type };
      setActiveCall({ id: incoming.id, type: incoming.type, status: 'connecting' });
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      if (!fadfadahClient.sendCallSignal(room.id, incoming.id, 'answer', answer)) {
        throw new Error('CALL_SIGNALING_OFFLINE');
      }
    } catch (error) {
      console.error('Could not accept WebRTC call:', error);
      endCall(true);
      setCallNotice(
        error instanceof Error && error.message === 'CALL_TURN_NOT_CONFIGURED'
          ? lang === 'ar'
            ? 'المكالمات غير مفعّلة بعد: لم يُضبط خادم TURN.'
            : lang === 'fr'
              ? 'Appels indisponibles : le serveur TURN n’est pas configuré.'
              : 'Calls are unavailable because the TURN server is not configured.'
          : lang === 'ar'
            ? 'تعذر قبول المكالمة. تحقق من أذونات الجهاز والاتصال.'
            : lang === 'fr'
              ? 'Impossible d’accepter l’appel. Vérifiez les autorisations et la connexion.'
              : 'Could not accept the call. Check device permissions and connectivity.'
      );
    } finally {
      setCallInProgress(false);
    }
  };

  useEffect(() => fadfadahClient.subscribeCallSignals((signal) => {
    void handleCallSignal(signal).catch((error: unknown) => {
      console.error('WebRTC signaling failed:', error);
      endCall(true);
      setCallNotice(
        lang === 'ar'
          ? 'تعذر إكمال إعداد المكالمة.'
          : lang === 'fr'
            ? 'Impossible de configurer l’appel.'
            : 'Could not complete call setup.'
      );
    });
  }), [lang, room.id, selfUser.id]);

  useEffect(
    () => fadfadahClient.subscribeChatGames(handleChatGameEvent),
    [lang, room.id]
  );

  useEffect(() => () => {
    const game = chatGameRef.current;
    computerGuessSecretRef.current = null;
    computerCodeSecretRef.current = null;
    if (computerMoveTimerRef.current !== null) {
      window.clearTimeout(computerMoveTimerRef.current);
    }
    if (game && !game.computerMode && game.status !== 'finished') {
      fadfadahClient.endChatGame(game.id);
    }
  }, []);

  useEffect(() => {
    if (localCallVideoRef.current) {
      localCallVideoRef.current.srcObject = localCallStreamRef.current;
    }
    if (remoteCallVideoRef.current) {
      remoteCallVideoRef.current.srcObject = remoteCallStreamRef.current;
    }
    if (remoteCallAudioRef.current) {
      remoteCallAudioRef.current.srcObject = remoteCallStreamRef.current;
    }
  }, [activeCall, incomingCall]);

  useEffect(() => () => endCall(true), [room.id]);

  // Subscribe to real WebSocket typing updates from the other device
  useEffect(() => {
    lastScreenshotNoticeRef.current =
      fadfadahClient.getSafeChatScreenshotNotice(room.id)?.createdAt ?? 0;
    const unsub = fadfadahClient.subscribe(() => {
      setPeerTyping(fadfadahClient.isPeerTypingInRoom(room.id));
      const notice = fadfadahClient.getSafeChatScreenshotNotice(room.id);
      if (notice && notice.createdAt > lastScreenshotNoticeRef.current) {
        lastScreenshotNoticeRef.current = notice.createdAt;
        setSafeChatNotice(
          lang === 'ar'
            ? `أبلغ ${notice.nickname || 'الطرف الآخر'} عن التقاط الشاشة أثناء وضع المحادثة الآمنة.`
            : `${notice.nickname || 'The other participant'} reported a screenshot during Safe Chat.`
        );
      }
    });
    return () => {
      unsub();
      fadfadahClient.sendTypingIndicator(room.id, false);
    };
  }, [lang, room.id]);

  useEffect(() => {
    if (room.safe_chat_status !== 'ACTIVE') return;
    const timer = window.setInterval(() => setSafeChatNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [room.safe_chat_status, room.safe_chat_expires_at]);

  useEffect(
    () => () => {
      recordingCancelledRef.current = true;
      if (mediaRecorderRef.current?.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    },
    []
  );

  useEffect(() => {
    if (room.safe_chat_status !== 'ACTIVE') {
      setCaptureSupported(false);
      return;
    }

    return watchAndroidSafeChatScreenshots(
      () => {
        void fadfadahClient.reportSafeChatScreenshot(room.id).catch((error: unknown) => {
          console.error('Could not report a Safe Chat screenshot:', error);
          setSafeChatNotice(
            lang === 'ar'
              ? 'تعذر إرسال تنبيه التقاط الشاشة للطرف الآخر.'
              : 'Could not notify the other participant about the screenshot.'
          );
        });
      },
      setCaptureSupported
    );
  }, [lang, room.id, room.safe_chat_status]);

  const updateSafeChat = async (
    action: 'REQUEST' | 'ACCEPT' | 'DISABLE',
    durationSeconds?: number
  ) => {
    setSafeChatBusy(true);
    setSafeChatNotice('');
    try {
      const result = await fadfadahClient.updateSafeChat(room.id, action, durationSeconds);
      if (!result.ok) {
        setSafeChatNotice(result.error || (lang === 'ar' ? 'تعذر تحديث وضع المحادثة الآمنة.' : 'Could not update Safe Chat.'));
      }
    } catch (error) {
      console.error('Could not update Safe Chat:', error);
      setSafeChatNotice(
        lang === 'ar' ? 'تعذر الاتصال لتحديث وضع المحادثة الآمنة.' : 'Could not connect to update Safe Chat.'
      );
    } finally {
      setSafeChatBusy(false);
    }
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, peerTyping]);

  // Mark incoming messages as READ (✓✓) on the real server
  useEffect(() => {
    const hasUnread =
      room.unread_count > 0 ||
      messages.some((m) => m.sender_id !== selfUser.id && m.status !== 'READ');
    if (hasUnread) {
      fadfadahClient.markRoomRead(room.id);
    }
  }, [room.id, room.unread_count, messages.length, selfUser.id]);

  const formatTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString(lang === 'ar' ? 'ar-EG' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleInputChange = (val: string) => {
    setInputText(val);
    fadfadahClient.sendTypingIndicator(room.id, val.trim().length > 0);
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
    }
    typingTimeoutRef.current = window.setTimeout(() => {
      fadfadahClient.sendTypingIndicator(room.id, false);
    }, 2200);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = inputText.trim();
    if (!clean) return;

    setInputText('');
    setModerationNotice('');
    fadfadahClient.sendTypingIndicator(room.id, false);

    const res = await fadfadahClient.sendMessage(room.id, {
      content: clean,
      media_type: 'text',
    });

    if (res.isFrozen || !res.ok) {
      setModerationNotice(
        res.reason ||
          (lang === 'ar'
            ? 'تم تجميد الرسالة لمخالفتها إرشادات السلامة.'
            : 'Message blocked by safety moderation.')
      );
    }
  };

  const handleSendSticker = async (sticker: (typeof EXPRESSIVE_STICKERS)[number]) => {
    setShowStickers(false);
    const label = lang === 'ar' ? sticker.labelAr : sticker.labelEn;
    await fadfadahClient.sendMessage(room.id, {
      content: `${sticker.symbol} ${label}`,
      media_url: sticker.id,
      media_type: 'sticker',
    });
  };

  const handleImageAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    if (file.size > MAX_CHAT_IMAGE_SIZE) {
      setModerationNotice(
        lang === 'ar' ? 'حجم الصورة يتجاوز الحد المسموح (2.5 ميجابايت).' : 'Image exceeds 2.5MB limit.'
      );
      return;
    }

    try {
      const dataUrl = await prepareChatImage(file);
      setModerationNotice(
        lang === 'ar' ? 'جارٍ فحص وإرسال الصورة...' : 'Scanning & sending image...'
      );
      const res = await fadfadahClient.sendMessage(room.id, {
        content: lang === 'ar' ? 'صورة مرفقة' : 'Attached Photo',
        media_url: dataUrl,
        media_type: 'image',
      });
      setModerationNotice('');
      if (res.isFrozen || !res.ok) {
        setModerationNotice(
          res.reason === 'INVALID_IMAGE_ATTACHMENT'
            ? lang === 'ar'
              ? 'الصورة غير صالحة أو يتجاوز حجمها الحد الآمن للإرسال.'
              : 'The image is invalid or exceeds the safe sending size.'
            : res.reason ||
                (lang === 'ar' ? 'تم رفض الصورة المرفقة لمعايير الأمان.' : 'Image rejected by moderation.')
        );
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : '';
      setModerationNotice(
        reason === 'UNSUPPORTED_IMAGE_TYPE'
            ? lang === 'ar'
              ? 'صيغة الصورة غير مدعومة. استخدم JPG أو PNG أو WebP.'
              : 'Unsupported image format. Use JPG, PNG, or WebP.'
            : reason === 'IMAGE_TOO_LARGE_AFTER_COMPRESSION'
              ? lang === 'ar'
                ? 'تعذر تجهيز الصورة بالحجم المناسب للإرسال.'
                : 'The image could not be reduced enough to send.'
              : lang === 'ar'
                ? 'تعذرت معالجة الصورة أو إرسالها.'
                : 'Could not process or send the image.'
      );
    }
  };

  const handleVideoAttach = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    const videoType = file.type.split(';')[0].toLowerCase();
    if (!['video/mp4', 'video/webm'].includes(videoType)) {
      setModerationNotice(
        lang === 'ar'
          ? 'صيغة الفيديو غير مدعومة. استخدم MP4 أو WebM.'
          : lang === 'fr'
            ? 'Format vidéo non pris en charge. Utilisez MP4 ou WebM.'
            : 'Unsupported video format. Use MP4 or WebM.'
      );
      return;
    }
    if (file.size > MAX_CHAT_VIDEO_SIZE) {
      setModerationNotice(
        lang === 'ar'
          ? 'حجم الفيديو يتجاوز الحد المسموح (3 ميجابايت).'
          : lang === 'fr'
            ? 'La vidéo dépasse la taille maximale autorisée (3 Mo).'
            : 'Video exceeds the 3MB size limit.'
      );
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const mediaUrl = String(reader.result || '');
      if (!mediaUrl.startsWith(`data:${videoType};base64,`)) {
        setModerationNotice(
          lang === 'ar'
            ? 'تعذرت معالجة مقطع الفيديو.'
            : lang === 'fr'
              ? 'Impossible de traiter la vidéo.'
              : 'Could not process the video.'
        );
        return;
      }
      setModerationNotice(
        lang === 'ar'
          ? 'جارٍ إرسال مقطع الفيديو...'
          : lang === 'fr'
            ? 'Envoi de la vidéo...'
            : 'Sending video...'
      );
      try {
        const result = await fadfadahClient.sendMessage(room.id, {
          content:
            lang === 'ar' ? 'مقطع فيديو' : lang === 'fr' ? 'Clip vidéo' : 'Video clip',
          media_url: mediaUrl,
          media_type: 'video',
        });
        setModerationNotice(
          result.isFrozen || !result.ok
            ? result.reason ||
                (lang === 'ar'
                  ? 'تم رفض مقطع الفيديو لمعايير الأمان.'
                  : lang === 'fr'
                    ? 'La vidéo a été refusée par le contrôle de sécurité.'
                    : 'The video was rejected by safety moderation.')
            : ''
        );
      } catch {
        setModerationNotice(
          lang === 'ar'
            ? 'تعذر إرسال مقطع الفيديو.'
            : lang === 'fr'
              ? 'Impossible d’envoyer la vidéo.'
              : 'Could not send the video.'
        );
      }
    };
    reader.onerror = () => {
      setModerationNotice(
        lang === 'ar'
          ? 'تعذرت معالجة مقطع الفيديو.'
          : lang === 'fr'
            ? 'Impossible de traiter la vidéo.'
            : 'Could not process the video.'
      );
    };
    reader.readAsDataURL(file);
  };

  const handleVoiceMessage = async () => {
    if (recordingVoice) {
      mediaRecorderRef.current?.stop();
      return;
    }
    if (
      typeof MediaRecorder === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setModerationNotice(
        lang === 'ar'
          ? 'تسجيل الصوت غير مدعوم على هذا الجهاز أو المتصفح.'
          : 'Voice recording is not supported on this device or browser.'
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const supportedTypes = ['audio/webm', 'audio/mp4', 'audio/ogg', 'audio/wav', 'audio/mpeg'];
      const mimeType = supportedTypes.find((type) => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];
      audioTooLargeRef.current = false;
      recordingCancelledRef.current = false;
      setModerationNotice('');

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
        const totalSize = audioChunksRef.current.reduce((total, chunk) => total + chunk.size, 0);
        if (totalSize > MAX_CHAT_AUDIO_PAYLOAD_SIZE) {
          audioTooLargeRef.current = true;
          if (recorder.state === 'recording') recorder.stop();
        }
      };
      recorder.onerror = () => {
        setModerationNotice(
          lang === 'ar' ? 'تعذر تسجيل الرسالة الصوتية.' : 'Could not record the voice message.'
        );
        if (recorder.state === 'recording') recorder.stop();
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        mediaRecorderRef.current = null;
        setRecordingVoice(false);
        const audioBlob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType.split(';')[0] || 'audio/webm',
        });
        audioChunksRef.current = [];
        if (recordingCancelledRef.current) return;
        if (audioTooLargeRef.current || audioBlob.size > MAX_CHAT_AUDIO_PAYLOAD_SIZE) {
          setModerationNotice(
            lang === 'ar'
              ? 'تجاوز التسجيل الحد الآمن للإرسال.'
              : 'The recording exceeded the safe sending size.'
          );
          return;
        }

        const audioType = audioBlob.type.split(';')[0].toLowerCase();
        if (!supportedTypes.includes(audioType)) {
          setModerationNotice(
            lang === 'ar'
              ? 'صيغة التسجيل الصوتي غير مدعومة.'
              : 'The recorded audio format is not supported.'
          );
          return;
        }

        const reader = new FileReader();
        reader.onload = async () => {
          const encodedAudio = String(reader.result || '').split(',')[1];
          if (!encodedAudio) {
            setModerationNotice(
              lang === 'ar' ? 'تعذرت معالجة التسجيل الصوتي.' : 'Could not process the recording.'
            );
            return;
          }
          setModerationNotice(
            lang === 'ar' ? 'جارٍ فحص وإرسال الرسالة الصوتية...' : 'Checking and sending audio...'
          );
          try {
            const result = await fadfadahClient.sendMessage(room.id, {
              content: lang === 'ar' ? 'رسالة صوتية' : 'Voice message',
              media_url: `data:${audioType};base64,${encodedAudio}`,
              media_type: 'audio',
            });
            setModerationNotice(
              result.isFrozen || !result.ok
                ? result.reason ||
                    (lang === 'ar'
                      ? 'تم رفض الرسالة الصوتية لمعايير الأمان.'
                      : 'The voice message was rejected by safety moderation.')
                : ''
            );
          } catch {
            setModerationNotice(
              lang === 'ar' ? 'تعذر إرسال الرسالة الصوتية.' : 'Could not send the voice message.'
            );
          }
        };
        reader.onerror = () => {
          setModerationNotice(
            lang === 'ar' ? 'تعذرت معالجة التسجيل الصوتي.' : 'Could not process the recording.'
          );
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start(5000);
      setRecordingVoice(true);
    } catch (error) {
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      setRecordingVoice(false);
      setModerationNotice(
        error instanceof DOMException && error.name === 'NotAllowedError'
          ? lang === 'ar'
            ? 'اسمح باستخدام الميكروفون لتسجيل رسالة صوتية.'
            : 'Allow microphone access to record a voice message.'
          : lang === 'ar'
            ? 'تعذر بدء تسجيل الصوت.'
            : 'Could not start voice recording.'
      );
    }
  };

  const handleConfirmBlock = async () => {
    await fadfadahClient.blockPeer(room.id);
    setShowBlockModal(false);
    onBack();
  };

  const handleConfirmReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmittingReport(true);
    const res = await fadfadahClient.submitReport({
      roomId: room.id,
      reportedUserId: peerUser.id,
      target_type: 'user',
      reason: reportReason,
      details: `بلاغ إشرافي مباشر من داخل المحادثة ضد ${peerUser.nickname}`,
    });
    setSubmittingReport(false);
    setReportFeedback(res.summary);
  };

  return (
    <div className="flex flex-col h-full bg-[#F8F9FA] dark:bg-[#151221]">
      {/* Native Android Chat App Bar */}
      <header className="px-3 pt-safe min-h-[60px] shrink-0 bg-[#2D1B69] text-white flex items-center justify-between gap-2 border-b border-white/10">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back"
            className="lg:hidden min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 flex items-center justify-center transition-colors shrink-0"
          >
            {lang === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
          </button>
          <FramedAvatar
            avatarUrl={peerUser.avatar_url}
            frameId={peerUser.frame_id}
            nickname={peerUser.nickname}
            size="sm"
          />
          <div className="min-w-0">
            <h2 className="flex items-center gap-1 text-sm font-bold truncate">
              <span className="truncate">{peerUser.nickname}</span>
              <OfficialBadge role={peerUser.role} />
            </h2>
            <p className="text-[11px] text-purple-200/85 truncate">
              {peerTyping
                ? t.typingNow
                : `${
                    peerUser.is_online
                      ? lang === 'ar'
                        ? 'متصل الآن'
                        : 'Online'
                      : lang === 'ar'
                      ? 'غير متصل حالياً'
                      : 'Offline'
                  } · ${
                    room.type === 'LINK_BASED'
                      ? lang === 'ar'
                        ? 'رسالة رابط'
                        : 'Link Chat'
                      : lang === 'ar'
                      ? 'مطابقة عشوائية'
                      : 'Random Chat'
                  }`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {room.status === 'ACCEPTED' && !activeCall && !incomingCall && (
            <>
              {!chatGame && (
                <button
                  type="button"
                  onClick={() => setShowGamePicker((open) => !open)}
                  title={lang === 'ar' ? 'الألعاب' : lang === 'fr' ? 'Jeux' : 'Games'}
                  aria-label={lang === 'ar' ? 'الألعاب' : lang === 'fr' ? 'Jeux' : 'Games'}
                  className="min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 text-amber-200 flex items-center justify-center"
                >
                  <Gamepad2 className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => void startCall('audio')}
                title={lang === 'ar' ? 'مكالمة صوتية' : lang === 'fr' ? 'Appel audio' : 'Voice call'}
                aria-label={lang === 'ar' ? 'مكالمة صوتية' : lang === 'fr' ? 'Appel audio' : 'Voice call'}
                className="min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 text-emerald-200 flex items-center justify-center"
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void startCall('video')}
                title={lang === 'ar' ? 'مكالمة مرئية' : lang === 'fr' ? 'Appel vidéo' : 'Video call'}
                aria-label={lang === 'ar' ? 'مكالمة مرئية' : lang === 'fr' ? 'Appel vidéo' : 'Video call'}
                className="min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 text-sky-200 flex items-center justify-center"
              >
                <Video className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => {
              setReportFeedback('');
              setShowReportModal(true);
            }}
            title={t.reportUser}
            className="min-h-[44px] min-w-[44px] rounded-full active:bg-white/15 text-amber-300 flex items-center justify-center transition-colors"
          >
            <Flag className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setShowBlockModal(true)}
            title={t.blockUser}
            className="min-h-[44px] min-w-[44px] rounded-full active:bg-rose-500/25 text-rose-300 flex items-center justify-center transition-colors"
          >
            <Ban className="w-4 h-4" />
          </button>
        </div>
      </header>

      {showGamePicker && room.status === 'ACCEPTED' && (
        <CasualGameArena
          opponentName={peerUser?.nickname || 'الصديق'}
          opponentId={peerUser?.id}
          lang={lang}
          onClose={() => setShowGamePicker(false)}
          onSendChallenge={(gameType) => {
            setShowGamePicker(false);
            if (['tic-tac-toe', 'rock-paper-scissors', 'connect-four', 'guess-number', 'bulls-cows', 'pig-dice', 'nim'].includes(gameType)) {
              inviteToGame(gameType as any);
            } else {
              setGameNotice(lang === 'ar' ? 'تم فتح التحدي داخل ساحة الألعاب!' : 'Challenge opened in game arena!');
            }
          }}
        />
      )}

      {callNotice && (
        <p role="status" className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {callNotice}
        </p>
      )}
      {gameNotice && (
        <p role="status" className="shrink-0 bg-amber-50 px-4 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
          {gameNotice}
        </p>
      )}
      {chatGame?.status === 'invited' && (
        <section className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-400/20 dark:bg-amber-950/25">
          <p className="text-sm font-bold">
            {chatGame.inviterId === selfUser.id
              ? lang === 'ar' ? `أرسلت دعوة ${chatGame.gameType === 'tic-tac-toe' ? 'إكس-أو' : chatGame.gameType === 'connect-four' ? 'أربعة على التوالي' : chatGame.gameType === 'guess-number' ? 'تخمين الرقم' : chatGame.gameType === 'bulls-cows' ? 'الأرقام السرية' : 'حجر ورقة مقص'} إلى ${peerUser.nickname}.` : lang === 'fr' ? `Invitation envoyée à ${peerUser.nickname}.` : `Game invitation sent to ${peerUser.nickname}.`
              : lang === 'ar' ? `${peerUser.nickname} يدعوك للعب ${chatGame.gameType === 'tic-tac-toe' ? 'إكس-أو' : chatGame.gameType === 'connect-four' ? 'أربعة على التوالي' : chatGame.gameType === 'guess-number' ? 'تخمين الرقم' : chatGame.gameType === 'bulls-cows' ? 'الأرقام السرية' : 'حجر ورقة مقص'}.` : lang === 'fr' ? `${peerUser.nickname} vous invite à jouer.` : `${peerUser.nickname} invited you to play.`}
          </p>
          {chatGame.opponentId === selfUser.id && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  if (!fadfadahClient.respondToChatGame(chatGame.id, true)) {
                    setGameNotice(lang === 'ar' ? 'تعذر قبول الدعوة؛ تحقق من الاتصال.' : 'Could not accept the invitation. Check the connection.');
                  }
                }}
                className="min-h-10 rounded-xl bg-emerald-600 px-4 text-xs font-bold text-white"
              >
                {lang === 'ar' ? 'قبول' : lang === 'fr' ? 'Accepter' : 'Accept'}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!fadfadahClient.respondToChatGame(chatGame.id, false)) {
                    setGameNotice(lang === 'ar' ? 'تعذر رفض الدعوة؛ تحقق من الاتصال.' : 'Could not decline the invitation. Check the connection.');
                  }
                }}
                className="min-h-10 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200"
              >
                {lang === 'ar' ? 'رفض' : lang === 'fr' ? 'Refuser' : 'Decline'}
              </button>
            </div>
          )}
          {chatGame.inviterId === selfUser.id && (
            <button
              type="button"
              onClick={() => {
                if (!fadfadahClient.endChatGame(chatGame.id)) {
                  setGameNotice(lang === 'ar' ? 'تعذر إلغاء الدعوة؛ تحقق من الاتصال.' : 'Could not cancel the invitation. Check the connection.');
                  return;
                }
                chatGameRef.current = null;
                computerGuessSecretRef.current = null;
                computerCodeSecretRef.current = null;
                setChatGame(null);
                setGameNumberInput('');
              }}
              className="min-h-10 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200"
            >
              {lang === 'ar' ? 'إلغاء الدعوة' : lang === 'fr' ? 'Annuler' : 'Cancel invitation'}
            </button>
          )}
        </section>
      )}
      {incomingCall && (
        <section className="shrink-0 flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/20 dark:bg-emerald-950/25">
          <p className="text-sm font-bold">
            {lang === 'ar'
              ? `${peerUser.nickname} يتصل بك ${incomingCall.type === 'video' ? 'مرئيًا' : 'صوتيًا'}`
              : lang === 'fr'
                ? `${peerUser.nickname} vous appelle ${incomingCall.type === 'video' ? 'en vidéo' : 'en audio'}`
                : `${peerUser.nickname} is calling ${incomingCall.type === 'video' ? 'by video' : 'by voice'}`}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!incomingCall.offer || callBusy}
              onClick={() => void acceptCall()}
              className="min-h-10 rounded-xl bg-emerald-700 px-4 text-xs font-bold text-white disabled:opacity-50"
            >
              {lang === 'ar' ? 'قبول' : lang === 'fr' ? 'Accepter' : 'Accept'}
            </button>
            <button
              type="button"
              onClick={() => endCall(true)}
              className="min-h-10 rounded-xl bg-rose-700 px-4 text-xs font-bold text-white"
            >
              {lang === 'ar' ? 'رفض' : lang === 'fr' ? 'Refuser' : 'Decline'}
            </button>
          </div>
        </section>
      )}
      {activeCall && (
        <section className="relative shrink-0 space-y-3 border-b border-slate-200 bg-slate-950 p-3 text-white dark:border-white/10">
          {activeCall.type === 'video' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <video
                ref={remoteCallVideoRef}
                autoPlay
                playsInline
                muted
                className="max-h-56 min-h-36 w-full rounded-xl bg-black object-cover"
              />
              <video
                ref={localCallVideoRef}
                autoPlay
                playsInline
                muted
                className="max-h-56 min-h-36 w-full rounded-xl bg-black object-cover"
              />
            </div>
          ) : (
            <>
              <audio ref={remoteCallAudioRef} autoPlay />
              <p className="text-center text-sm font-bold">
                {lang === 'ar' ? 'مكالمة صوتية مباشرة' : lang === 'fr' ? 'Appel audio en cours' : 'Voice call in progress'}
              </p>
            </>
          )}
          {activeCall.type === 'video' && <audio ref={remoteCallAudioRef} autoPlay />}
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-300">
              {activeCall.status === 'active'
                ? lang === 'ar' ? 'متصل' : lang === 'fr' ? 'Connecté' : 'Connected'
                : lang === 'ar' ? 'جارٍ الاتصال...' : lang === 'fr' ? 'Connexion...' : 'Connecting...'}
            </span>
            <button
              type="button"
              onClick={() => endCall(true)}
              aria-label={lang === 'ar' ? 'إنهاء المكالمة' : lang === 'fr' ? 'Terminer l’appel' : 'End call'}
              className="flex min-h-11 items-center gap-2 rounded-full bg-rose-600 px-5 text-xs font-bold"
            >
              <PhoneOff className="h-4 w-4" />
              {lang === 'ar' ? 'إنهاء' : lang === 'fr' ? 'Terminer' : 'End call'}
            </button>
          </div>
        </section>
      )}

      {room.status === 'ACCEPTED' && (
        <section className="shrink-0 border-b border-violet-200/70 bg-violet-50 px-4 py-3 dark:border-violet-400/15 dark:bg-[#211b36]">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-700 dark:bg-violet-400/15 dark:text-violet-200">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {lang === 'ar' ? 'المحادثة الآمنة' : 'Safe Chat'}
                </h3>
                {room.safe_chat_status === 'ACTIVE' && (
                  <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold tabular-nums text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200">
                    {lang === 'ar' ? 'متبقٍ ' : 'Remaining '}
                    {Math.max(
                      0,
                      Math.ceil(((room.safe_chat_expires_at ?? 0) - safeChatNow) / 1000)
                    )}
                    {lang === 'ar' ? ' ث' : 's'}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
                {room.safe_chat_status === 'ACTIVE'
                  ? lang === 'ar'
                    ? 'سيُحذف سجل رسائل هذه المحادثة عند انتهاء المؤقت، ويُعاد ضبطه مع كل رسالة. قد لا تتوفر إشعارات التقاط الشاشة على كل الأجهزة.'
                    : 'This room’s messages will be deleted when the timer expires and the timer resets with each message. Screenshot alerts are not available on every device.'
                  : room.safe_chat_status === 'PENDING'
                    ? room.safe_chat_requested_by === selfUser.id
                      ? lang === 'ar'
                        ? 'أرسلت طلبًا لتفعيل الحذف التلقائي؛ بانتظار موافقة الطرف الآخر.'
                        : 'Your auto-delete request is waiting for the other participant.'
                      : lang === 'ar'
                        ? 'الطرف الآخر يطلب تفعيل الحذف التلقائي للرسائل.'
                        : 'The other participant requested automatic message deletion.'
                    : lang === 'ar'
                      ? 'فعّلوا الوضع بموافقة الطرفين. يبدأ الحذف بعد مدة خمول تختارونها.'
                      : 'Both participants must agree. Choose how long messages remain after inactivity.'}
              </p>

              {room.safe_chat_status === 'OFF' ? (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  <select
                    value={safeChatDuration}
                    onChange={(event) => setSafeChatDuration(Number(event.target.value))}
                    aria-label={lang === 'ar' ? 'مدة الحذف التلقائي' : 'Auto-delete duration'}
                    className="min-h-10 rounded-xl border border-violet-200 bg-white px-3 text-xs font-semibold text-slate-800 dark:border-white/10 dark:bg-[#151221] dark:text-white"
                  >
                    <option value={60}>{lang === 'ar' ? 'دقيقة' : '1 minute'}</option>
                    <option value={300}>{lang === 'ar' ? '5 دقائق' : '5 minutes'}</option>
                    <option value={900}>{lang === 'ar' ? '15 دقيقة' : '15 minutes'}</option>
                  </select>
                  <button
                    type="button"
                    disabled={safeChatBusy}
                    onClick={() => void updateSafeChat('REQUEST', safeChatDuration)}
                    className="min-h-10 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'طلب التفعيل' : 'Request Safe Chat'}
                  </button>
                </div>
              ) : room.safe_chat_status === 'PENDING' ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {room.safe_chat_requested_by !== selfUser.id && (
                    <button
                      type="button"
                      disabled={safeChatBusy}
                      onClick={() => void updateSafeChat('ACCEPT')}
                      className="min-h-10 rounded-xl bg-violet-700 px-4 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {lang === 'ar' ? 'موافقة وبدء' : 'Accept & start'}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={safeChatBusy}
                    onClick={() => void updateSafeChat('DISABLE')}
                    className="min-h-10 rounded-xl border border-slate-300 px-4 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200 disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'رفض / إلغاء' : 'Decline / cancel'}
                  </button>
                </div>
              ) : (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {captureSupported && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <Camera className="h-3.5 w-3.5" />
                      {lang === 'ar' ? 'تنبيه الالتقاط مدعوم على هذا الجهاز' : 'Screenshot alerts supported on this device'}
                    </span>
                  )}
                  <button
                    type="button"
                    disabled={safeChatBusy}
                    onClick={() => void updateSafeChat('DISABLE')}
                    className="min-h-9 rounded-xl border border-slate-300 px-3 text-xs font-bold text-slate-700 dark:border-white/15 dark:text-slate-200 disabled:opacity-50"
                  >
                    {lang === 'ar' ? 'إيقاف الوضع' : 'Turn off'}
                  </button>
                </div>
              )}
              {safeChatNotice && (
                <p role="status" className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                  {safeChatNotice}
                </p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Real-Time Message Stream */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {chatGame && chatGame.status !== 'invited' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm">
          <section role="dialog" aria-modal="true" aria-labelledby="chat-game-title" className="w-full max-w-sm rounded-2xl border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-400/20 dark:bg-[#1E1B2E]">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 id="chat-game-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  {chatGame.gameType === 'tic-tac-toe'
                    ? lang === 'ar' ? 'إكس-أو' : lang === 'fr' ? 'Morpion' : 'Tic-tac-toe'
                    : chatGame.gameType === 'connect-four'
                      ? lang === 'ar' ? 'أربعة على التوالي' : lang === 'fr' ? 'Puissance 4' : 'Connect Four'
                      : chatGame.gameType === 'guess-number'
                        ? lang === 'ar' ? 'خمن الرقم (1–100)' : lang === 'fr' ? 'Devinez le nombre (1–100)' : 'Guess the number (1–100)'
                        : chatGame.gameType === 'bulls-cows'
                          ? lang === 'ar' ? 'الأرقام السرية' : lang === 'fr' ? 'Bulls et vaches' : 'Bulls & Cows'
                          : chatGame.gameType === 'pig-dice'
                            ? lang === 'ar' ? 'الخنزير / النرد' : lang === 'fr' ? 'Jeu du cochon' : 'Pig (dice game)'
                            : chatGame.gameType === 'nim'
                              ? lang === 'ar' ? 'نيم: سحب العيدان' : lang === 'fr' ? 'Nim : retrait des bâtons' : 'Nim: take-away'
                          : lang === 'ar' ? 'حجر ورقة مقص' : lang === 'fr' ? 'Pierre-feuille-ciseaux' : 'Rock paper scissors'}
                </h3>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {chatGame.gameType === 'guess-number' && chatGame.status === 'active'
                    ? !chatGame.secretReady
                      ? chatGame.inviterId === selfUser.id
                        ? lang === 'ar' ? 'اختر رقمًا سريًا من 1 إلى 100.' : lang === 'fr' ? 'Choisissez un nombre secret de 1 à 100.' : 'Choose a secret number from 1 to 100.'
                        : lang === 'ar' ? 'بانتظار اختيار الرقم السري.' : lang === 'fr' ? 'En attente du nombre secret.' : 'Waiting for the secret number.'
                      : chatGame.guessHint === 'higher'
                        ? lang === 'ar' ? `الرقم ${chatGame.lastGuess} أصغر؛ جرّب رقمًا أعلى.` : lang === 'fr' ? `${chatGame.lastGuess} est trop petit. Essayez plus haut.` : `${chatGame.lastGuess} is too low. Guess higher.`
                        : chatGame.guessHint === 'lower'
                          ? lang === 'ar' ? `الرقم ${chatGame.lastGuess} أكبر؛ جرّب رقمًا أقل.` : lang === 'fr' ? `${chatGame.lastGuess} est trop grand. Essayez plus bas.` : `${chatGame.lastGuess} is too high. Guess lower.`
                          : chatGame.turnUserId === selfUser.id
                            ? lang === 'ar' ? 'خمن الرقم من 1 إلى 100.' : lang === 'fr' ? 'Devinez le nombre de 1 à 100.' : 'Guess the number from 1 to 100.'
                            : lang === 'ar' ? `دور ${peerUser.nickname} في التخمين.` : lang === 'fr' ? `Au tour de ${peerUser.nickname}.` : `${peerUser.nickname} is guessing.`
                    : chatGame.gameType === 'bulls-cows' && chatGame.status === 'active'
                      ? !chatGame.secretReady
                        ? chatGame.inviterId === selfUser.id
                          ? lang === 'ar' ? 'اختر رمزًا من أربعة أرقام مختلفة.' : lang === 'fr' ? 'Choisissez un code de quatre chiffres différents.' : 'Choose a 4-digit code with unique digits.'
                          : lang === 'ar' ? 'بانتظار اختيار الرمز السري.' : lang === 'fr' ? 'En attente du code secret.' : 'Waiting for the secret code.'
                        : chatGame.lastCodeGuess
                          ? lang === 'ar'
                            ? `${chatGame.lastCodeGuess}: ${chatGame.bulls ?? 0} في المكان الصحيح، ${chatGame.cows ?? 0} في مكان مختلف.`
                            : lang === 'fr'
                              ? `${chatGame.lastCodeGuess} : ${chatGame.bulls ?? 0} bien placés, ${chatGame.cows ?? 0} mal placés.`
                              : `${chatGame.lastCodeGuess}: ${chatGame.bulls ?? 0} bulls, ${chatGame.cows ?? 0} cows.`
                          : chatGame.turnUserId === selfUser.id
                            ? lang === 'ar' ? 'خمن الرمز من أربعة أرقام مختلفة.' : lang === 'fr' ? 'Devinez le code de quatre chiffres différents.' : 'Guess the 4-digit code with unique digits.'
                            : lang === 'ar' ? `دور ${peerUser.nickname} في التخمين.` : lang === 'fr' ? `Au tour de ${peerUser.nickname}.` : `${peerUser.nickname} is guessing.`
                    : chatGame.gameType === 'nim' && chatGame.status === 'active'
                      ? lang === 'ar'
                        ? `من يسحب آخر عود يخسر · ${chatGame.turnUserId === selfUser.id ? 'دورك الآن' : chatGame.turnUserId === 'computer' ? 'دور الحاسوب...' : `دور ${peerUser.nickname}`}`
                        : chatGame.turnUserId === selfUser.id ? 'Taking the last stick loses · Your turn' : chatGame.turnUserId === 'computer' ? 'Taking the last stick loses · Computer’s turn' : `Taking the last stick loses · ${peerUser.nickname}’s turn`
                    : chatGame.gameType === 'pig-dice' && chatGame.status === 'active'
                      ? chatGame.lastDieRoll
                        ? lang === 'ar'
                          ? `ظهر النرد ${chatGame.lastDieRoll} · نقاط الجولة ${chatGame.turnPoints ?? 0}`
                          : lang === 'fr'
                            ? `Dé ${chatGame.lastDieRoll} · points du tour ${chatGame.turnPoints ?? 0}`
                            : `Rolled ${chatGame.lastDieRoll} · turn points ${chatGame.turnPoints ?? 0}`
                        : lang === 'ar'
                          ? `نقاط الجولة ${chatGame.turnPoints ?? 0}`
                          : lang === 'fr'
                            ? `Points du tour ${chatGame.turnPoints ?? 0}`
                            : `Turn points ${chatGame.turnPoints ?? 0}`
                    : chatGame.gameType === 'rock-paper-scissors' && chatGame.status === 'active'
                    ? chatGame.pendingMove
                      ? lang === 'ar' ? `أرسلت اختيارك للجولة ${chatGame.round}؛ بانتظار الطرف الآخر.` : lang === 'fr' ? `Choix envoyé pour la manche ${chatGame.round}. En attente.` : `Choice submitted for round ${chatGame.round}; waiting for the other player.`
                      : lang === 'ar' ? `الجولة ${chatGame.round} من 3 · النتيجة ${chatGame.roundWinners?.filter((winner) => winner === (chatGame.inviterId === selfUser.id ? 'X' : 'O')).length ?? 0} - ${chatGame.roundWinners?.filter((winner) => winner === (chatGame.inviterId === selfUser.id ? 'O' : 'X')).length ?? 0}` : lang === 'fr' ? `Manche ${chatGame.round} sur 3` : `Round ${chatGame.round} of 3`
                    : chatGame.status === 'finished'
                    ? chatGame.winner === 'DRAW'
                      ? lang === 'ar' ? 'تعادل!' : lang === 'fr' ? 'Match nul !' : 'It’s a draw!'
                      : chatGame.winner === (chatGame.inviterId === selfUser.id ? 'X' : 'O')
                        ? lang === 'ar' ? 'فزت!' : lang === 'fr' ? 'Vous avez gagné !' : 'You won!'
                        : chatGame.computerMode
                          ? lang === 'ar' ? 'فاز الحاسوب.' : lang === 'fr' ? 'L’ordinateur a gagné.' : 'The computer won.'
                          : lang === 'ar' ? `${peerUser.nickname} فاز.` : lang === 'fr' ? `${peerUser.nickname} a gagné.` : `${peerUser.nickname} won.`
                    : chatGame.turnUserId === selfUser.id
                        ? lang === 'ar' ? 'دورك الآن' : lang === 'fr' ? 'À vous de jouer' : 'Your turn'
                        : chatGame.computerMode
                          ? lang === 'ar' ? 'دور الحاسوب...' : lang === 'fr' ? 'Au tour de l’ordinateur…' : 'Computer’s turn…'
                          : lang === 'ar' ? `دور ${peerUser.nickname}` : lang === 'fr' ? `Au tour de ${peerUser.nickname}` : `${peerUser.nickname}’s turn`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (
                    !chatGame.computerMode &&
                    chatGame.status === 'active' &&
                    !fadfadahClient.endChatGame(chatGame.id)
                  ) {
                    setGameNotice(lang === 'ar' ? 'تعذر إنهاء اللعبة؛ تحقق من الاتصال.' : 'Could not end the game. Check the connection.');
                    return;
                  }
                  if (computerMoveTimerRef.current !== null) {
                    window.clearTimeout(computerMoveTimerRef.current);
                    computerMoveTimerRef.current = null;
                  }
                  chatGameRef.current = null;
                  setChatGame(null);
                }}
                className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-600 dark:border-white/15 dark:text-slate-300"
              >
                {lang === 'ar' ? 'إنهاء' : lang === 'fr' ? 'Terminer' : 'End'}
              </button>
            </div>
            {chatGame.gameType === 'nim' ? (
              <div className="space-y-4">
                <p className="rounded-xl bg-violet-50 p-3 text-center text-xs font-semibold text-violet-800 dark:bg-violet-400/10 dark:text-violet-200">
                  {lang === 'ar'
                    ? 'اسحب عددًا من العيدان من كومة واحدة في كل دور. من يسحب آخر عود يخسر.'
                    : lang === 'fr'
                      ? 'Retirez des bâtons d’une seule pile à chaque tour. Le joueur qui prend le dernier bâton perd.'
                      : 'Take any number of sticks from one pile each turn. The player who takes the last stick loses.'}
                </p>
                <div className="space-y-3">
                  {(chatGame.nimHeaps ?? []).map((size, heapIndex) => (
                    <div key={heapIndex} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
                      <p className="mb-2 text-center text-xs font-bold text-slate-600 dark:text-slate-300">
                        {lang === 'ar' ? `الكومة ${heapIndex + 1} · ${size} عيدان` : lang === 'fr' ? `Pile ${heapIndex + 1} · ${size} bâtons` : `Pile ${heapIndex + 1} · ${size} sticks`}
                      </p>
                      <div className="flex flex-wrap justify-center gap-2">
                        {Array.from({ length: size }, (_, index) => (
                          <span key={index} aria-hidden="true" className="h-2 w-7 rounded-full bg-amber-500" />
                        ))}
                      </div>
                      {chatGame.status === 'active' && chatGame.turnUserId === selfUser.id && (
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {Array.from({ length: size }, (_, index) => index + 1).map((count) => (
                            <button
                              key={count}
                              type="button"
                              onClick={() => makeGameMove({ heapIndex, count })}
                              className="min-h-10 rounded-lg bg-violet-600 px-3 text-xs font-bold text-white"
                            >
                              {lang === 'ar' ? `اسحب ${count}` : lang === 'fr' ? `Prendre ${count}` : `Take ${count}`}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ) : chatGame.gameType === 'pig-dice' ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="rounded-xl bg-violet-50 p-3 dark:bg-violet-400/10">
                    <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {lang === 'ar' ? 'أنت' : lang === 'fr' ? 'Vous' : 'You'}
                    </p>
                    <p className="mt-1 text-2xl font-black text-violet-700 dark:text-violet-200">
                      {chatGame.scores?.[selfUser.id] ?? 0}
                    </p>
                  </div>
                  <div className="rounded-xl bg-amber-50 p-3 dark:bg-amber-400/10">
                    <p className="truncate text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      {chatGame.computerMode
                        ? lang === 'ar' ? 'الحاسوب' : lang === 'fr' ? 'Ordinateur' : 'Computer'
                        : peerUser.nickname}
                    </p>
                    <p className="mt-1 text-2xl font-black text-amber-700 dark:text-amber-200">
                      {chatGame.scores?.[chatGame.computerMode ? 'computer' : chatGame.opponentId] ?? 0}
                    </p>
                  </div>
                </div>
                {chatGame.status === 'active' && (
                  <p role="status" className="text-center text-xs font-semibold text-violet-700 dark:text-violet-200">
                    {chatGame.turnUserId === selfUser.id
                      ? lang === 'ar' ? 'دورك الآن' : lang === 'fr' ? 'À vous de jouer' : 'Your turn'
                      : chatGame.turnUserId === 'computer'
                        ? lang === 'ar' ? 'دور الحاسوب...' : lang === 'fr' ? 'Au tour de l’ordinateur…' : 'Computer’s turn…'
                        : lang === 'ar' ? `دور ${peerUser.nickname}` : lang === 'fr' ? `Au tour de ${peerUser.nickname}` : `${peerUser.nickname}’s turn`}
                  </p>
                )}
                <div className="rounded-xl border border-slate-200 p-3 text-center dark:border-white/10">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'ar' ? 'نقاط الجولة غير المحفوظة' : lang === 'fr' ? 'Points non conservés du tour' : 'Unbanked turn points'}
                  </span>
                  <strong className="ms-2 text-lg font-black text-slate-900 dark:text-white">
                    {chatGame.turnPoints ?? 0}
                  </strong>
                </div>
                {chatGame.status === 'active' && chatGame.turnUserId === selfUser.id && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => makeGameMove({ action: 'roll' })}
                      className="min-h-12 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white"
                    >
                      {lang === 'ar' ? 'ارمِ النرد' : lang === 'fr' ? 'Lancer le dé' : 'Roll die'}
                    </button>
                    <button
                      type="button"
                      disabled={(chatGame.turnPoints ?? 0) <= 0}
                      onClick={() => makeGameMove({ action: 'hold' })}
                      className="min-h-12 rounded-xl border border-violet-300 px-4 text-sm font-bold text-violet-800 disabled:opacity-40 dark:border-violet-400/30 dark:text-violet-200"
                    >
                      {lang === 'ar' ? 'احفظ نقاطك' : lang === 'fr' ? 'Garder les points' : 'Bank points'}
                    </button>
                  </div>
                )}
              </div>
            ) : chatGame.gameType === 'guess-number' || chatGame.gameType === 'bulls-cows' ? (
              <div className="space-y-3">
                {(() => {
                  const isCodeGame = chatGame.gameType === 'bulls-cows';
                  const rangeHint = isCodeGame ? '0000' : '1–100';
                  return (
                    <>
                {!chatGame.computerMode &&
                  !chatGame.secretReady &&
                  chatGame.inviterId === selfUser.id &&
                  chatGame.status === 'active' && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        submitNumberSecret();
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type={isCodeGame ? 'text' : 'number'}
                        inputMode={isCodeGame ? 'numeric' : 'decimal'}
                        min={isCodeGame ? undefined : 1}
                        max={isCodeGame ? undefined : 100}
                        maxLength={isCodeGame ? 4 : undefined}
                        step={isCodeGame ? undefined : 1}
                        required
                        value={gameNumberInput}
                        onChange={(event) => setGameNumberInput(event.target.value)}
                        aria-label={isCodeGame ? (lang === 'ar' ? 'الرمز السري' : 'Secret code') : (lang === 'ar' ? 'الرقم السري' : 'Secret number')}
                        placeholder={rangeHint}
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#151221] dark:text-white"
                      />
                      <button type="submit" className="min-h-11 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white">
                        {lang === 'ar' ? 'إرسال سريًا' : lang === 'fr' ? 'Envoyer en privé' : 'Set secret'}
                      </button>
                    </form>
                  )}
                {chatGame.secretReady &&
                  chatGame.turnUserId === selfUser.id &&
                  chatGame.status === 'active' && (
                    <form
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (isCodeGame) {
                          if (!/^\d{4}$/.test(gameNumberInput) || new Set(gameNumberInput).size !== 4) {
                            setGameNotice(
                              lang === 'ar'
                                ? 'أدخل أربعة أرقام مختلفة.'
                                : lang === 'fr'
                                  ? 'Entrez quatre chiffres différents.'
                                  : 'Enter four unique digits.'
                            );
                            return;
                          }
                          makeGameMove({ codeGuess: gameNumberInput });
                        } else {
                          const guess = Number(gameNumberInput);
                          if (!Number.isInteger(guess) || guess < 1 || guess > 100) {
                            setGameNotice(lang === 'ar' ? 'أدخل رقمًا صحيحًا من 1 إلى 100.' : 'Enter a whole number from 1 to 100.');
                            return;
                          }
                          makeGameMove({ guess });
                        }
                        setGameNumberInput('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type={isCodeGame ? 'text' : 'number'}
                        inputMode={isCodeGame ? 'numeric' : 'decimal'}
                        min={isCodeGame ? undefined : 1}
                        max={isCodeGame ? undefined : 100}
                        maxLength={isCodeGame ? 4 : undefined}
                        step={isCodeGame ? undefined : 1}
                        required
                        value={gameNumberInput}
                        onChange={(event) => setGameNumberInput(event.target.value)}
                        aria-label={isCodeGame ? (lang === 'ar' ? 'تخمين الرمز' : 'Guess the code') : (lang === 'ar' ? 'تخمين الرقم' : 'Guess the number')}
                        placeholder={rangeHint}
                        className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 dark:border-white/10 dark:bg-[#151221] dark:text-white"
                      />
                      <button type="submit" className="min-h-11 rounded-xl bg-violet-600 px-4 text-xs font-bold text-white">
                        {isCodeGame
                          ? lang === 'ar' ? 'إرسال التخمين' : lang === 'fr' ? 'Proposer' : 'Submit guess'
                          : lang === 'ar' ? 'تخمين' : lang === 'fr' ? 'Deviner' : 'Guess'}
                      </button>
                    </form>
                  )}
                    </>
                  );
                })()}
              </div>
            ) : chatGame.gameType === 'tic-tac-toe' ? (
              <div className="mx-auto grid max-w-[264px] grid-cols-3 gap-2" role="grid" aria-label="Tic-tac-toe board">
                {chatGame.board.map((cell, index) => (
                  <button
                    key={index}
                    type="button"
                    disabled={chatGame.status !== 'active' || chatGame.turnUserId !== selfUser.id || cell !== null}
                    onClick={() => {
                      makeGameMove(index);
                    }}
                    aria-label={`${lang === 'ar' ? 'الخانة' : 'Cell'} ${index + 1}${cell ? ` ${cell}` : ''}`}
                    className="flex aspect-square items-center justify-center rounded-xl bg-violet-50 text-3xl font-black text-violet-700 disabled:cursor-default dark:bg-violet-400/10 dark:text-violet-200"
                  >
                    {cell}
                  </button>
                ))}
              </div>
            ) : chatGame.gameType === 'connect-four' ? (
              <div className="mx-auto grid max-w-[312px] grid-cols-7 gap-1 rounded-xl bg-blue-700 p-2" role="grid" aria-label="Connect Four board">
                {chatGame.board.map((cell, index) => {
                  const column = index % CONNECT_FOUR_COLUMNS;
                  return (
                    <button
                      key={index}
                      type="button"
                      disabled={
                        chatGame.status !== 'active' ||
                        chatGame.turnUserId !== selfUser.id ||
                        chatGame.board[column] !== null
                      }
                      onClick={() => makeGameMove(column)}
                      aria-label={`${lang === 'ar' ? 'الصف' : 'Row'} ${Math.floor(index / CONNECT_FOUR_COLUMNS) + 1}, ${lang === 'ar' ? 'العمود' : 'column'} ${column + 1}${cell ? ` ${cell}` : ''}`}
                      className={`aspect-square rounded-full text-sm font-black disabled:cursor-default ${
                        cell === 'X'
                          ? 'bg-rose-400 text-rose-950'
                          : cell === 'O'
                            ? 'bg-amber-300 text-amber-950'
                            : 'bg-white/90 text-transparent'
                      }`}
                    >
                      {cell ?? ''}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['rock', lang === 'ar' ? 'حجر' : lang === 'fr' ? 'Pierre' : 'Rock', '✊'],
                  ['paper', lang === 'ar' ? 'ورقة' : lang === 'fr' ? 'Feuille' : 'Paper', '✋'],
                  ['scissors', lang === 'ar' ? 'مقص' : lang === 'fr' ? 'Ciseaux' : 'Scissors', '✌️'],
                ] as const).map(([choice, label, symbol]) => (
                  <button
                    key={choice}
                    type="button"
                    disabled={chatGame.status !== 'active' || Boolean(chatGame.pendingMove)}
                    onClick={() => {
                      makeGameMove({ choice });
                    }}
                    className="flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl bg-violet-50 text-sm font-bold text-violet-700 disabled:opacity-50 dark:bg-violet-400/10 dark:text-violet-200"
                  >
                    <span className="text-2xl">{symbol}</span>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <p className="mt-3 text-center text-[11px] text-slate-500 dark:text-slate-400">
              {lang === 'ar' ? 'لعبة مجانية بلا رهانات أو نقاط مالية.' : lang === 'fr' ? 'Jeu gratuit, sans mise ni valeur monétaire.' : 'Free play; no wagers or monetary points.'}
            </p>
          </section>
          </div>
        )}
        {room.status === 'PENDING' && (
          <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/35 border border-amber-200 dark:border-amber-800/50 text-center text-xs text-amber-800 dark:text-amber-200">
            {lang === 'ar'
              ? 'بانتظار قبول الطرف الآخر لطلب المحادثة لبدء الدردشة المباشرة.'
              : 'Waiting for the other user to accept the chat request.'}
          </div>
        )}

        {messages.map((msg) => {
          const isMe = msg.sender_id === selfUser.id;
          return (
            <div key={msg.id} className={`flex flex-col ${isMe ? 'items-start' : 'items-end'}`}>
              <div
                className={`max-w-[82%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed selectable-text ${
                  msg.is_frozen
                    ? 'bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300'
                    : isMe
                    ? 'bg-[#8B5CF6] text-white rounded-br-sm shadow-sm'
                    : 'bg-white dark:bg-[#1E1B2E] text-slate-900 dark:text-slate-100 border border-slate-200/80 dark:border-white/10 rounded-bl-sm'
                }`}
              >
                {msg.is_frozen ? (
                  <div className="flex items-start gap-2 text-xs">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>
                      {msg.ai_flag_reason ||
                        (lang === 'ar'
                          ? 'تم تجميد الرسالة بواسطة نظام الحماية'
                          : 'Message frozen by safety moderation')}
                    </span>
                  </div>
                ) : msg.message_type === 'INTRO_CARD' && msg.introduction ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2.5">
                      <FramedAvatar
                        avatarUrl={msg.introduction.avatar_url}
                        frameId={msg.introduction.frame_id}
                        nickname={msg.introduction.nickname}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 text-xs font-bold">
                          <span className="truncate">
                            {msg.introduction.is_anonymous
                              ? lang === 'ar'
                                ? 'زائر مجهول'
                                : 'Anonymous visitor'
                              : msg.introduction.nickname}
                          </span>
                          {!msg.introduction.is_anonymous && (
                            <OfficialBadge
                              role={(isMe ? selfUser.role : peerUser.role)}
                            />
                          )}
                        </p>
                        <p className="text-[10px] opacity-70">
                          {lang === 'ar' ? 'بطاقة تعارف' : 'Introduction card'}
                          {msg.introduction.age ? ` · ${msg.introduction.age}` : ''}
                        </p>
                      </div>
                    </div>
                    {msg.introduction.bio && (
                      <p className="text-xs leading-relaxed opacity-90">{msg.introduction.bio}</p>
                    )}
                    {msg.introduction.interests.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {msg.introduction.interests.map((interest) => (
                          <span
                            key={interest}
                            className={`rounded-full px-2 py-1 text-[10px] ${
                              isMe
                                ? 'bg-white/15 text-white'
                                : 'bg-[#8B5CF6]/10 text-[#6D28D9] dark:text-purple-200'
                            }`}
                          >
                            {interest}
                          </span>
                        ))}
                      </div>
                    )}
                    <p className="whitespace-pre-wrap break-words border-t border-current/10 pt-2 text-sm font-medium leading-relaxed">
                      {msg.content}
                    </p>
                  </div>
                ) : msg.media_type === 'image' && msg.media_url ? (
                  <div className="space-y-1.5">
                    <img
                      src={msg.media_url}
                      alt={msg.content}
                      referrerPolicy="no-referrer"
                      className="rounded-xl max-h-60 w-auto object-cover"
                    />
                    <p className="text-xs opacity-90">{msg.content}</p>
                  </div>
                ) : msg.media_type === 'audio' && msg.media_url ? (
                  <div className="space-y-1.5">
                    <audio
                      controls
                      preload="metadata"
                      src={msg.media_url}
                      className="max-w-full"
                    />
                    <p className="text-xs opacity-90">{msg.content}</p>
                  </div>
                ) : msg.media_type === 'video' && msg.media_url ? (
                  <div className="space-y-1.5">
                    <video
                      controls
                      playsInline
                      preload="metadata"
                      src={msg.media_url}
                      className="max-h-72 max-w-full rounded-xl"
                    />
                    <p className="text-xs opacity-90">{msg.content}</p>
                  </div>
                ) : msg.media_type === 'sticker' ? (
                  <p className="text-base font-semibold py-0.5">{msg.content}</p>
                ) : (
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                )}

                <div
                  className={`flex items-center justify-end gap-1 mt-1 text-[11px] font-mono-num ${
                    msg.is_frozen
                      ? 'text-rose-500'
                      : isMe
                      ? 'text-purple-100/85'
                      : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <span>{formatTime(msg.created_at)}</span>
                  {isMe &&
                    !msg.is_frozen &&
                    (msg.status === 'READ' ? (
                      <CheckCheck className="w-3.5 h-3.5 text-white" />
                    ) : (
                      <Check className="w-3.5 h-3.5 text-purple-200" />
                    ))}
                </div>
              </div>
            </div>
          );
        })}

        {peerTyping && (
          <div className="flex justify-end">
            <div className="rounded-2xl px-4 py-2 bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 text-xs text-slate-500 dark:text-slate-400">
              {peerUser.nickname} {t.typingNow}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {moderationNotice && (
        <div className="mx-3 mb-2 px-3.5 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
          <span>{moderationNotice}</span>
          <button
            type="button"
            onClick={() => setModerationNotice('')}
            className="min-h-[32px] min-w-[32px] flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showStickers && (
        <div className="px-3 py-2.5 bg-white dark:bg-[#1E1B2E] border-t border-slate-200 dark:border-white/10 flex items-center gap-2 overflow-x-auto">
          {EXPRESSIVE_STICKERS.map((st) => (
            <button
              key={st.id}
              type="button"
              onClick={() => handleSendSticker(st)}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#28243D] active:bg-[#8B5CF6]/20 text-xs font-medium text-slate-800 dark:text-slate-200 flex items-center gap-1.5 whitespace-nowrap shrink-0"
            >
              <span>{st.symbol}</span>
              <span>{lang === 'ar' ? st.labelAr : st.labelEn}</span>
            </button>
          ))}
        </div>
      )}

      {/* Native Android Input Action Toolbar */}
      <form
        onSubmit={handleSendMessage}
        className="px-3 pt-2 pb-safe min-h-[60px] bg-white dark:bg-[#1E1B2E] border-t border-slate-200 dark:border-white/10 flex items-center gap-1.5 shrink-0"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleImageAttach}
          className="hidden"
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm"
          onChange={handleVideoAttach}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          title={lang === 'ar' ? 'إرفاق صورة' : 'Attach image'}
          className="min-h-[44px] min-w-[44px] rounded-full text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-white/10 flex items-center justify-center shrink-0"
        >
          <ImagePlus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => videoInputRef.current?.click()}
          title={
            lang === 'ar'
              ? 'إرفاق مقطع فيديو'
              : lang === 'fr'
                ? 'Joindre une vidéo'
                : 'Attach video'
          }
          aria-label={
            lang === 'ar'
              ? 'إرفاق مقطع فيديو'
              : lang === 'fr'
                ? 'Joindre une vidéo'
                : 'Attach video'
          }
          className="min-h-[44px] min-w-[44px] rounded-full text-slate-500 dark:text-slate-400 active:bg-slate-100 dark:active:bg-white/10 flex items-center justify-center shrink-0"
        >
          <Film className="w-5 h-5" />
        </button>

        <button
          type="button"
          onClick={() => void handleVoiceMessage()}
          title={
            recordingVoice
              ? lang === 'ar'
                ? 'إيقاف التسجيل'
                : 'Stop recording'
              : lang === 'ar'
                ? 'تسجيل رسالة صوتية'
                : 'Record voice message'
          }
          aria-label={
            recordingVoice
              ? lang === 'ar'
                ? 'إيقاف التسجيل الصوتي'
                : 'Stop voice recording'
              : lang === 'ar'
                ? 'تسجيل رسالة صوتية'
                : 'Record voice message'
          }
          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 ${
            recordingVoice
              ? 'text-rose-600 bg-rose-100 dark:bg-rose-500/15'
              : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {recordingVoice ? <Square className="w-4 h-4 fill-current" /> : <Mic className="w-5 h-5" />}
        </button>

        <button
          type="button"
          onClick={() => setShowStickers((v) => !v)}
          title={lang === 'ar' ? 'ملصقات' : 'Stickers'}
          className={`min-h-[44px] min-w-[44px] rounded-full flex items-center justify-center shrink-0 ${
            showStickers ? 'text-[#8B5CF6] bg-[#8B5CF6]/15' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <Smile className="w-5 h-5" />
        </button>

        <input
          type="text"
          value={inputText}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder={t.writeMessage}
          className="flex-1 h-11 px-4 rounded-full bg-slate-100 dark:bg-[#151221] border border-slate-200/80 dark:border-white/10 text-sm text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#8B5CF6]"
        />

        <button
          type="submit"
          disabled={!inputText.trim()}
          aria-label={t.send}
          className="min-h-[44px] min-w-[44px] rounded-full bg-[#8B5CF6] active:scale-95 disabled:opacity-45 text-white flex items-center justify-center transition-transform shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>

      {showBlockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {lang === 'ar' ? `حظر ${peerUser.nickname} نهائياً؟` : `Block ${peerUser.nickname}?`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {lang === 'ar'
                ? 'سيتم إغلاق المحادثة على الجهازين ومنع هذا المستخدم من التواصل معك نهائياً.'
                : 'This room will close on both devices and block further messages.'}
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowBlockModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmBlock}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-rose-600 text-xs font-semibold text-white"
              >
                {t.blockUser}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl bg-white dark:bg-[#1E1B2E] border border-slate-200 dark:border-white/10 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {lang === 'ar' ? 'إبلاغ إشرافي للسيرفر' : 'Submit Moderation Report'}
              </h3>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="min-h-[44px] min-w-[44px] -mx-2 flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {reportFeedback ? (
              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-xs text-emerald-800 dark:text-emerald-200 space-y-1.5">
                  <p className="font-bold">
                    {lang === 'ar' ? 'تم توثيق البلاغ على السيرفر:' : 'Report saved on server:'}
                  </p>
                  <p className="leading-relaxed">{reportFeedback}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReportModal(false)}
                  className="w-full min-h-[44px] rounded-xl bg-[#8B5CF6] text-white text-sm font-semibold"
                >
                  {lang === 'ar' ? 'تم' : 'Done'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleConfirmReport} className="space-y-4">
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full h-11 px-3 rounded-xl bg-slate-50 dark:bg-[#151221] border border-slate-200 dark:border-white/10 text-sm text-slate-900 dark:text-white"
                >
                  <option value="إزعاج أو سلوك غير لائق">إزعاج أو سلوك غير لائق</option>
                  <option value="ألفاظ مسيئة أو تنمر">ألفاظ مسيئة أو تنمر</option>
                  <option value="طلب بيانات شخصية حساسة">طلب بيانات شخصية حساسة</option>
                  <option value="محتوى مزعج (Spam)">محتوى مزعج (Spam)</option>
                </select>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowReportModal(false)}
                    className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/10 text-xs font-semibold text-slate-700 dark:text-slate-200"
                  >
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReport}
                    className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-600 text-xs font-semibold text-white"
                  >
                    {submittingReport
                      ? lang === 'ar'
                        ? 'جارٍ الإرسال...'
                        : 'Sending...'
                      : lang === 'ar'
                      ? 'تأكيد البلاغ'
                      : 'Submit'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
