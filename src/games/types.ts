/**
 * Sohba Chat - Complete 22 Casual Games Type Definitions
 * Based on Sohba Chat Engineering Specification (Sections 2.4 & 6.2)
 */

export type GameCategory = 'card' | 'fast' | 'strategy';

export type GameType =
  // 1) Card Games (9)
  | 'chkobba'
  | 'card-war'
  | 'higher-lower'
  | 'blackjack'
  | 'baccarat'
  | 'go-fish'
  | 'crazy-eights'
  | 'cassino'
  | 'gin-rummy'
  // 2) Fast Games (3)
  | 'rock-paper-scissors'
  | 'guess-number'
  | 'pig-dice'
  // 3) Strategy & Thinking Games (10)
  | 'tic-tac-toe'
  | 'connect-four'
  | 'bulls-cows'
  | 'nim'
  | 'reversi'
  | 'memory-grid'
  | 'battleship'
  | 'ludo'
  | 'checkers'
  | 'chess';

export interface GameMetadata {
  id: GameType;
  category: GameCategory;
  titleAr: string;
  titleEn: string;
  titleFr: string;
  descriptionAr: string;
  descriptionEn: string;
  descriptionFr: string;
  iconName: string;
  badgeAr: string;
}

export type CardSuit = 'hearts' | 'diamonds' | 'clubs' | 'spades';

export interface PlayingCard {
  id: string;
  suit: CardSuit;
  rank: number; // 1 (Ace) to 13 (King)
  label: string; // 'A', '2'-'10', 'J', 'Q', 'K'
  symbol: string; // '♥', '♦', '♣', '♠'
  color: 'red' | 'black';
}

// Checkers Board Types
export type CheckerPiece = null | 'b' | 'w' | 'B' | 'W'; // lowercase = normal, uppercase = king

// Chess Board Types
export type ChessPiece =
  | null
  | 'p' | 'r' | 'n' | 'b' | 'q' | 'k'  // Black pieces (opponent)
  | 'P' | 'R' | 'N' | 'B' | 'Q' | 'K'; // White pieces (self)

// Battleship Cell
export type BattleCell = 'empty' | 'ship' | 'hit' | 'miss';

// Ludo Token
export interface LudoToken {
  id: number;
  position: number; // -1 = yard, 0..51 = track, 100..105 = home path, 999 = finished
  isSafe: boolean;
}
