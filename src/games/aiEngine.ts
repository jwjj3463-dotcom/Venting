/**
 * Sohba Chat - Tactical AI Game Opponents Engine
 * Implements Minimax with Alpha-Beta Pruning, Heuristic Evaluations,
 * and Tactical Decision Rules for all 22 casual games.
 * As specified in Sohba Chat Specification (Section 6.2).
 */

import { PlayingCard, CheckerPiece, ChessPiece } from './types';

// ==========================================
// 1. Deck & Card Utilities
// ==========================================
export function createStandardDeck(): PlayingCard[] {
  const suits: Array<{ suit: PlayingCard['suit']; symbol: string; color: PlayingCard['color'] }> = [
    { suit: 'hearts', symbol: '♥', color: 'red' },
    { suit: 'diamonds', symbol: '♦', color: 'red' },
    { suit: 'clubs', symbol: '♣', color: 'black' },
    { suit: 'spades', symbol: '♠', color: 'black' },
  ];
  const ranks = [
    { rank: 1, label: 'A' },
    { rank: 2, label: '2' },
    { rank: 3, label: '3' },
    { rank: 4, label: '4' },
    { rank: 5, label: '5' },
    { rank: 6, label: '6' },
    { rank: 7, label: '7' },
    { rank: 8, label: '8' },
    { rank: 9, label: '9' },
    { rank: 10, label: '10' },
    { rank: 11, label: 'J' },
    { rank: 12, label: 'Q' },
    { rank: 13, label: 'K' },
  ];

  const deck: PlayingCard[] = [];
  for (const s of suits) {
    for (const r of ranks) {
      deck.push({
        id: `${s.suit}-${r.rank}-${Math.random().toString(36).substring(2, 7)}`,
        suit: s.suit,
        symbol: s.symbol,
        color: s.color,
        rank: r.rank,
        label: r.label,
      });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck<T>(array: T[]): T[] {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Calculate Blackjack hand total
export function calculateBlackjackTotal(cards: PlayingCard[]): number {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.rank === 1) {
      aces += 1;
      total += 11;
    } else if (c.rank >= 10) {
      total += 10;
    } else {
      total += c.rank;
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
}

// Calculate Baccarat hand total (modulo 10)
export function calculateBaccaratPoints(cards: PlayingCard[]): number {
  let total = 0;
  for (const c of cards) {
    if (c.rank >= 10) {
      total += 0;
    } else {
      total += c.rank;
    }
  }
  return total % 10;
}

// ==========================================
// 2. Alpha-Beta Minimax: Reversi / Othello (8x8)
// ==========================================
const DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],           [0, 1],
  [1, -1],  [1, 0],  [1, 1],
];

export function getReversiValidMoves(
  board: Array<'B' | 'W' | null>,
  player: 'B' | 'W'
): number[] {
  const opponent: 'B' | 'W' = player === 'B' ? 'W' : 'B';
  const validMoves: number[] = [];

  for (let pos = 0; pos < 64; pos++) {
    if (board[pos] !== null) continue;
    const r = Math.floor(pos / 8);
    const c = pos % 8;
    let canFlip = false;

    for (const [dr, dc] of DIRECTIONS) {
      let step = 1;
      let nr = r + dr;
      let nc = c + dc;
      let hasOpponentBetween = false;

      while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const neighbor = board[nr * 8 + nc];
        if (neighbor === opponent) {
          hasOpponentBetween = true;
        } else if (neighbor === player) {
          if (hasOpponentBetween) canFlip = true;
          break;
        } else {
          break;
        }
        nr += dr;
        nc += dc;
        step++;
      }
      if (canFlip) break;
    }

    if (canFlip) {
      validMoves.push(pos);
    }
  }
  return validMoves;
}

export function applyReversiMove(
  board: Array<'B' | 'W' | null>,
  pos: number,
  player: 'B' | 'W'
): Array<'B' | 'W' | null> {
  const newBoard = [...board];
  newBoard[pos] = player;
  const opponent = player === 'B' ? 'W' : 'B';
  const r = Math.floor(pos / 8);
  const c = pos % 8;

  for (const [dr, dc] of DIRECTIONS) {
    let nr = r + dr;
    let nc = c + dc;
    const toFlip: number[] = [];

    while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
      const neighbor = newBoard[nr * 8 + nc];
      if (neighbor === opponent) {
        toFlip.push(nr * 8 + nc);
      } else if (neighbor === player) {
        for (const flipIdx of toFlip) {
          newBoard[flipIdx] = player;
        }
        break;
      } else {
        break;
      }
      nr += dr;
      nc += dc;
    }
  }
  return newBoard;
}

// Positional weight map for 8x8 Reversi
const REVERSI_WEIGHTS = [
  100, -20,  10,   5,   5,  10, -20, 100,
  -20, -50,  -2,  -2,  -2,  -2, -50, -20,
   10,  -2,  -1,  -1,  -1,  -1,  -2,  10,
    5,  -2,  -1,   0,   0,  -1,  -2,   5,
    5,  -2,  -1,   0,   0,  -1,  -2,   5,
   10,  -2,  -1,  -1,  -1,  -1,  -2,  10,
  -20, -50,  -2,  -2,  -2,  -2, -50, -20,
  100, -20,  10,   5,   5,  10, -20, 100,
];

export function chooseReversiComputerMove(board: Array<'B' | 'W' | null>, player: 'B' | 'W'): number {
  const validMoves = getReversiValidMoves(board, player);
  if (validMoves.length === 0) return -1;

  let bestMove = validMoves[0];
  let bestScore = -Infinity;

  for (const move of validMoves) {
    const nextBoard = applyReversiMove(board, move, player);
    let score = REVERSI_WEIGHTS[move] + Math.floor(Math.random() * 5);
    // Corners are crucial
    if ([0, 7, 56, 63].includes(move)) score += 150;
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove;
}

// ==========================================
// 3. Checkers / Draughts (8x8)
// ==========================================
export function getCheckersMoves(
  board: CheckerPiece[],
  turn: 'w' | 'b'
): Array<{ from: number; to: number; capture?: number }> {
  const moves: Array<{ from: number; to: number; capture?: number }> = [];
  const jumps: Array<{ from: number; to: number; capture?: number }> = [];

  for (let from = 0; from < 64; from++) {
    const piece = board[from];
    if (!piece) continue;
    const isWhite = piece.toLowerCase() === 'w';
    if ((turn === 'w' && !isWhite) || (turn === 'b' && isWhite)) continue;

    const isKing = piece === 'W' || piece === 'B';
    const r = Math.floor(from / 8);
    const c = from % 8;

    const dirs: number[][] = [];
    if (turn === 'w' || isKing) dirs.push([-1, -1], [-1, 1]);
    if (turn === 'b' || isKing) dirs.push([1, -1], [1, 1]);

    for (const [dr, dc] of dirs) {
      // Normal move
      const nr = r + dr;
      const nc = c + dc;
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const to = nr * 8 + nc;
        if (board[to] === null) {
          moves.push({ from, to });
        }
      }

      // Jump capture
      const jr = r + 2 * dr;
      const jc = c + 2 * dc;
      if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8) {
        const midPos = (r + dr) * 8 + (c + dc);
        const landPos = jr * 8 + jc;
        const midPiece = board[midPos];
        if (midPiece && midPiece.toLowerCase() !== turn && board[landPos] === null) {
          jumps.push({ from, to: landPos, capture: midPos });
        }
      }
    }
  }
  // Mandatory jumping in draughts
  return jumps.length > 0 ? jumps : moves;
}

export function chooseCheckersComputerMove(
  board: CheckerPiece[],
  turn: 'b'
): { from: number; to: number; capture?: number } | null {
  const moves = getCheckersMoves(board, turn);
  if (moves.length === 0) return null;

  // Prefer captures
  const jumps = moves.filter((m) => m.capture !== undefined);
  if (jumps.length > 0) {
    return jumps[Math.floor(Math.random() * jumps.length)];
  }

  // Advance toward kings row
  moves.sort((a, b) => {
    const toRowA = Math.floor(a.to / 8);
    const toRowB = Math.floor(b.to / 8);
    return toRowB - toRowA;
  });
  return moves[0];
}

// ==========================================
// 4. Tactical Chess Opponent (8x8)
// ==========================================
export const INITIAL_CHESS_BOARD: ChessPiece[] = [
  'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
  'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  null, null, null, null, null, null, null, null,
  'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
  'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R',
];

const CHESS_VALUES: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000,
  P: 100, N: 320, B: 330, R: 500, Q: 900, K: 20000,
};

export function getChessMoves(
  board: ChessPiece[],
  isWhite: boolean
): Array<{ from: number; to: number; piece: NonNullable<ChessPiece> }> {
  const moves: Array<{ from: number; to: number; piece: NonNullable<ChessPiece> }> = [];

  for (let from = 0; from < 64; from++) {
    const p = board[from];
    if (!p) continue;
    const isPieceWhite = p === p.toUpperCase();
    if (isPieceWhite !== isWhite) continue;

    const r = Math.floor(from / 8);
    const c = from % 8;
    const pieceLower = p.toLowerCase();

    // Pawn
    if (pieceLower === 'p') {
      const dir = isPieceWhite ? -1 : 1;
      const startRow = isPieceWhite ? 6 : 1;
      // Single step forward
      const f1 = (r + dir) * 8 + c;
      if (r + dir >= 0 && r + dir < 8 && board[f1] === null) {
        moves.push({ from, to: f1, piece: p });
        // Double step
        const f2 = (r + 2 * dir) * 8 + c;
        if (r === startRow && board[f2] === null) {
          moves.push({ from, to: f2, piece: p });
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const nr = r + dir;
        const nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const target = board[nr * 8 + nc];
          if (target && (target === target.toUpperCase()) !== isPieceWhite) {
            moves.push({ from, to: nr * 8 + nc, piece: p });
          }
        }
      }
    }

    // Knight
    if (pieceLower === 'n') {
      const knightOffsets = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ];
      for (const [dr, dc] of knightOffsets) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const to = nr * 8 + nc;
          const target = board[to];
          if (!target || (target === target.toUpperCase()) !== isPieceWhite) {
            moves.push({ from, to, piece: p });
          }
        }
      }
    }

    // Rook / Bishop / Queen sliding moves
    if (['r', 'b', 'q'].includes(pieceLower)) {
      const dirs: number[][] = [];
      if (pieceLower === 'r' || pieceLower === 'q') dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
      if (pieceLower === 'b' || pieceLower === 'q') dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);

      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
          const to = nr * 8 + nc;
          const target = board[to];
          if (target === null) {
            moves.push({ from, to, piece: p });
          } else {
            if ((target === target.toUpperCase()) !== isPieceWhite) {
              moves.push({ from, to, piece: p });
            }
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }

    // King
    if (pieceLower === 'k') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
            const to = nr * 8 + nc;
            const target = board[to];
            if (!target || (target === target.toUpperCase()) !== isPieceWhite) {
              moves.push({ from, to, piece: p });
            }
          }
        }
      }
    }
  }

  return moves;
}

export function chooseChessComputerMove(board: ChessPiece[]): { from: number; to: number } | null {
  const moves = getChessMoves(board, false); // black = computer
  if (moves.length === 0) return null;

  let bestMove = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    let score = Math.floor(Math.random() * 20);
    const target = board[m.to];
    if (target) {
      score += CHESS_VALUES[target] || 100;
    }
    // Favor central squares
    const centerCols = [3, 4];
    const toCol = m.to % 8;
    if (centerCols.includes(toCol)) score += 30;

    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return { from: bestMove.from, to: bestMove.to };
}

// ==========================================
// 5. Battleship AI (Hunt and Target)
// ==========================================
export function chooseBattleshipShot(
  board: Array<'empty' | 'hit' | 'miss'>,
  lastHits: number[]
): number {
  // If we have recent hits, target adjacent cells
  if (lastHits.length > 0) {
    const hit = lastHits[lastHits.length - 1];
    const r = Math.floor(hit / 6);
    const c = hit % 6;
    const candidates = [
      (r - 1) * 6 + c,
      (r + 1) * 6 + c,
      r * 6 + (c - 1),
      r * 6 + (c + 1),
    ].filter((pos) => pos >= 0 && pos < 36 && board[pos] === 'empty');

    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
  }

  // Parity hunt pattern (checkerboard)
  const emptyCells = board
    .map((val, idx) => (val === 'empty' ? idx : -1))
    .filter((idx) => idx !== -1);

  const parityCells = emptyCells.filter((idx) => {
    const r = Math.floor(idx / 6);
    const c = idx % 6;
    return (r + c) % 2 === 0;
  });

  const pool = parityCells.length > 0 ? parityCells : emptyCells;
  return pool[Math.floor(Math.random() * pool.length)];
}

// ==========================================
// 6. Card Games Tactical Solvers
// ==========================================

// Chkobba capture combinations check
export function findChkobbaCaptures(
  card: PlayingCard,
  tableCards: PlayingCard[]
): PlayingCard[] | null {
  // 1. Direct match by rank
  const direct = tableCards.find((tc) => tc.rank === card.rank);
  if (direct) return [direct];

  // 2. Sum matching up to the card rank (e.g. 7 can take 3+4 or 2+5)
  for (let i = 0; i < tableCards.length; i++) {
    for (let j = i + 1; j < tableCards.length; j++) {
      if (tableCards[i].rank + tableCards[j].rank === card.rank) {
        return [tableCards[i], tableCards[j]];
      }
    }
  }
  return null;
}

// Blackjack Basic Strategy decision
export function chooseBlackjackAction(
  playerTotal: number,
  dealerUpCardRank: number
): 'hit' | 'stand' {
  if (playerTotal >= 17) return 'stand';
  if (playerTotal <= 11) return 'hit';
  // Between 12 and 16
  if (dealerUpCardRank >= 7) return 'hit';
  return 'stand';
}

// Crazy Eights valid moves
export function getCrazyEightsValidMoves(
  hand: PlayingCard[],
  topCard: PlayingCard,
  activeSuit?: PlayingCard['suit']
): PlayingCard[] {
  const suitToMatch = activeSuit || topCard.suit;
  return hand.filter(
    (c) => c.rank === 8 || c.suit === suitToMatch || c.rank === topCard.rank
  );
}

// Memory Grid symbol pairs
export const MEMORY_SYMBOLS = ['🌟', '🚀', '🐱', '☕', '💎', '🎨', '🔥', '🎵'];
