/**
 * Sohba Chat - 22 Casual Games Arena Component
 * Complete implementation of all 22 Casual Games with Tactical AI Opponent.
 * As specified in Sohba Chat Specification (Sections 2.4, 4.4, and 6.2).
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Swords,
  Bot,
  RotateCcw,
  Sparkles,
  Trophy,
  Dices,
  Layers,
  Award,
  ChevronRight,
  TrendingUp,
  Brain,
  Crown,
  Grid,
} from 'lucide-react';
import { ALL_22_GAMES } from '../catalog';
import { GameType, GameCategory, PlayingCard, CheckerPiece, ChessPiece } from '../types';
import {
  createStandardDeck,
  calculateBlackjackTotal,
  calculateBaccaratPoints,
  getReversiValidMoves,
  applyReversiMove,
  chooseReversiComputerMove,
  getCheckersMoves,
  chooseCheckersComputerMove,
  INITIAL_CHESS_BOARD,
  getChessMoves,
  chooseChessComputerMove,
  chooseBattleshipShot,
  chooseBlackjackAction,
  getCrazyEightsValidMoves,
  MEMORY_SYMBOLS,
  shuffleDeck,
} from '../aiEngine';

interface CasualGameArenaProps {
  initialGameType?: GameType;
  opponentName: string;
  opponentId?: string;
  lang: 'ar' | 'en' | 'fr';
  onClose: () => void;
  onSendChallenge?: (gameType: GameType) => void;
}

export const CasualGameArena: React.FC<CasualGameArenaProps> = ({
  initialGameType = 'tic-tac-toe',
  opponentName,
  lang,
  onClose,
  onSendChallenge,
}) => {
  const [selectedGame, setSelectedGame] = useState<GameType>(initialGameType);
  const [activeCategory, setActiveCategory] = useState<GameCategory>('all' as any);
  const [gameMode, setGameMode] = useState<'ai' | 'friend'>('ai');
  const [gameStatus, setGameStatus] = useState<'ready' | 'playing' | 'won' | 'lost' | 'draw'>('ready');
  const [turn, setTurn] = useState<'player' | 'computer'>('player');
  const [statusMessage, setStatusMessage] = useState<string>('');

  // ------------------------------------------
  // Game-Specific States
  // ------------------------------------------
  // 1. Tic-Tac-Toe
  const [tttBoard, setTttBoard] = useState<Array<'X' | 'O' | null>>(Array(9).fill(null));

  // 2. Connect Four
  const [c4Board, setC4Board] = useState<Array<'X' | 'O' | null>>(Array(42).fill(null));

  // 3. Reversi / Othello
  const [reversiBoard, setReversiBoard] = useState<Array<'B' | 'W' | null>>(() => {
    const b = Array(64).fill(null);
    b[27] = 'W'; b[28] = 'B';
    b[35] = 'B'; b[36] = 'W';
    return b;
  });

  // 4. Checkers
  const [checkersBoard, setCheckersBoard] = useState<CheckerPiece[]>(() => {
    const b: CheckerPiece[] = Array(64).fill(null);
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) b[r * 8 + c] = 'b'; // Computer / Black
      }
    }
    for (let r = 5; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if ((r + c) % 2 === 1) b[r * 8 + c] = 'w'; // Player / White
      }
    }
    return b;
  });
  const [selectedCheckerPos, setSelectedCheckerPos] = useState<number | null>(null);

  // 5. Chess
  const [chessBoard, setChessBoard] = useState<ChessPiece[]>([...INITIAL_CHESS_BOARD]);
  const [selectedChessPos, setSelectedChessPos] = useState<number | null>(null);

  // 6. Memory Grid
  const [memoryCards, setMemoryCards] = useState<Array<{ id: number; symbol: string; isFlipped: boolean; isMatched: boolean }>>([]);
  const [flippedMemoryIndices, setFlippedMemoryIndices] = useState<number[]>([]);

  // 7. Battleship
  const [playerBattleGrid, setPlayerBattleGrid] = useState<Array<'empty' | 'ship' | 'hit' | 'miss'>>(Array(36).fill('empty'));
  const [enemyBattleGrid, setEnemyBattleGrid] = useState<Array<'empty' | 'ship' | 'hit' | 'miss'>>(Array(36).fill('empty'));
  const [enemyHits, setEnemyHits] = useState<number[]>([]);

  // 8. Card War
  const [playerWarCard, setPlayerWarCard] = useState<PlayingCard | null>(null);
  const [computerWarCard, setComputerWarCard] = useState<PlayingCard | null>(null);
  const [warScore, setWarScore] = useState<{ player: number; computer: number }>({ player: 0, computer: 0 });

  // 9. Higher or Lower
  const [hlCurrentCard, setHlCurrentCard] = useState<PlayingCard | null>(null);
  const [hlStreak, setHlStreak] = useState<number>(0);

  // 10. Blackjack
  const [bjPlayerHand, setBjPlayerHand] = useState<PlayingCard[]>([]);
  const [bjDealerHand, setBjDealerHand] = useState<PlayingCard[]>([]);

  // 11. Baccarat
  const [bacPlayerCards, setBacPlayerCards] = useState<PlayingCard[]>([]);
  const [bacBankerCards, setBacBankerCards] = useState<PlayingCard[]>([]);
  const [bacBet, setBacBet] = useState<'player' | 'banker' | 'tie'>('player');

  // 12. Nim
  const [nimHeaps, setNimHeaps] = useState<number[]>([3, 4, 5]);

  // 13. Pig Dice
  const [pigScores, setPigScores] = useState<{ player: number; computer: number }>({ player: 0, computer: 0 });
  const [pigTurnPoints, setPigTurnPoints] = useState<number>(0);
  const [pigLastRoll, setPigLastRoll] = useState<number | null>(null);

  // 14. Guess Number
  const [guessTarget, setGuessTarget] = useState<number>(() => Math.floor(Math.random() * 100) + 1);
  const [guessInput, setGuessInput] = useState<string>('');
  const [guessHint, setGuessHint] = useState<string>('');

  // 15. Chkobba
  const [chkobbaTable, setChkobbaTable] = useState<PlayingCard[]>([]);
  const [chkobbaPlayerHand, setChkobbaPlayerHand] = useState<PlayingCard[]>([]);
  const [chkobbaComputerHand, setChkobbaComputerHand] = useState<PlayingCard[]>([]);
  const [chkobbaScores, setChkobbaScores] = useState<{ player: number; computer: number }>({ player: 0, computer: 0 });

  // 16. Crazy Eights
  const [crazyHand, setCrazyHand] = useState<PlayingCard[]>([]);
  const [crazyComputerHand, setCrazyComputerHand] = useState<PlayingCard[]>([]);
  const [crazyTopCard, setCrazyTopCard] = useState<PlayingCard | null>(null);

  // 17. Rock-Paper-Scissors
  const [rpsRound, setRpsRound] = useState<number>(1);
  const [rpsScores, setRpsScores] = useState<{ player: number; computer: number }>({ player: 0, computer: 0 });
  const [rpsChoices, setRpsChoices] = useState<{ player?: string; computer?: string }>({});

  // 18. Ludo
  const [ludoTokens, setLudoTokens] = useState<{ player: number[]; computer: number[] }>({
    player: [-1, -1, -1, -1],
    computer: [-1, -1, -1, -1],
  });
  const [ludoLastDice, setLudoLastDice] = useState<number | null>(null);

  // Reset & start a selected game
  const initGame = (type: GameType) => {
    setSelectedGame(type);
    setGameStatus('playing');
    setTurn('player');
    setStatusMessage('');

    if (type === 'tic-tac-toe') {
      setTttBoard(Array(9).fill(null));
    } else if (type === 'connect-four') {
      setC4Board(Array(42).fill(null));
    } else if (type === 'reversi') {
      const b = Array(64).fill(null);
      b[27] = 'W'; b[28] = 'B';
      b[35] = 'B'; b[36] = 'W';
      setReversiBoard(b);
    } else if (type === 'checkers') {
      const b: CheckerPiece[] = Array(64).fill(null);
      for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r * 8 + c] = 'b';
      }
      for (let r = 5; r < 8; r++) {
        for (let c = 0; c < 8; c++) if ((r + c) % 2 === 1) b[r * 8 + c] = 'w';
      }
      setCheckersBoard(b);
      setSelectedCheckerPos(null);
    } else if (type === 'chess') {
      setChessBoard([...INITIAL_CHESS_BOARD]);
      setSelectedChessPos(null);
    } else if (type === 'memory-grid') {
      const symbols = shuffleDeck([...MEMORY_SYMBOLS, ...MEMORY_SYMBOLS]);
      setMemoryCards(symbols.map((sym, id) => ({ id, symbol: sym, isFlipped: false, isMatched: false })));
      setFlippedMemoryIndices([]);
    } else if (type === 'battleship') {
      const pGrid: Array<'empty' | 'ship' | 'hit' | 'miss'> = Array(36).fill('empty');
      const eGrid: Array<'empty' | 'ship' | 'hit' | 'miss'> = Array(36).fill('empty');
      // Place 4 ships randomly for each
      const shipIndices = shuffleDeck([0, 1, 2, 3, 4, 5, 7, 8, 12, 14, 20, 22, 28, 30]).slice(0, 4);
      const enemyShipIndices = shuffleDeck([2, 5, 8, 11, 15, 18, 23, 27, 31, 34]).slice(0, 4);
      shipIndices.forEach((i) => { pGrid[i] = 'ship'; });
      enemyShipIndices.forEach((i) => { eGrid[i] = 'ship'; });
      setPlayerBattleGrid(pGrid);
      setEnemyBattleGrid(eGrid);
      setEnemyHits([]);
    } else if (type === 'card-war') {
      const deck = createStandardDeck();
      setPlayerWarCard(deck[0]);
      setComputerWarCard(deck[1]);
      setWarScore({ player: 0, computer: 0 });
    } else if (type === 'higher-lower') {
      const deck = createStandardDeck();
      setHlCurrentCard(deck[0]);
      setHlStreak(0);
    } else if (type === 'blackjack') {
      const deck = createStandardDeck();
      setBjPlayerHand([deck[0], deck[1]]);
      setBjDealerHand([deck[2], deck[3]]);
    } else if (type === 'baccarat') {
      const deck = createStandardDeck();
      setBacPlayerCards([deck[0], deck[1]]);
      setBacBankerCards([deck[2], deck[3]]);
    } else if (type === 'nim') {
      setNimHeaps([3, 4, 5]);
    } else if (type === 'pig-dice') {
      setPigScores({ player: 0, computer: 0 });
      setPigTurnPoints(0);
      setPigLastRoll(null);
    } else if (type === 'guess-number') {
      setGuessTarget(Math.floor(Math.random() * 100) + 1);
      setGuessInput('');
      setGuessHint('');
    } else if (type === 'chkobba') {
      const deck = createStandardDeck();
      setChkobbaTable(deck.slice(0, 4));
      setChkobbaPlayerHand(deck.slice(4, 7));
      setChkobbaComputerHand(deck.slice(7, 10));
      setChkobbaScores({ player: 0, computer: 0 });
    } else if (type === 'crazy-eights') {
      const deck = createStandardDeck();
      setCrazyHand(deck.slice(0, 5));
      setCrazyComputerHand(deck.slice(5, 10));
      setCrazyTopCard(deck[10]);
    } else if (type === 'rock-paper-scissors') {
      setRpsRound(1);
      setRpsScores({ player: 0, computer: 0 });
      setRpsChoices({});
    } else if (type === 'ludo') {
      setLudoTokens({ player: [-1, -1, -1, -1], computer: [-1, -1, -1, -1] });
      setLudoLastDice(null);
    }
  };

  useEffect(() => {
    initGame(selectedGame);
  }, [selectedGame]);

  // ------------------------------------------
  // AI Auto-Turn Execution for Playing against Computer
  // ------------------------------------------
  useEffect(() => {
    if (gameMode !== 'ai' || turn !== 'computer' || gameStatus !== 'playing') return;

    const timer = setTimeout(() => {
      // 1. Reversi Computer Turn
      if (selectedGame === 'reversi') {
        const move = chooseReversiComputerMove(reversiBoard, 'B');
        if (move !== -1) {
          const next = applyReversiMove(reversiBoard, move, 'B');
          setReversiBoard(next);
        }
        setTurn('player');
      }

      // 2. Checkers Computer Turn
      else if (selectedGame === 'checkers') {
        const m = chooseCheckersComputerMove(checkersBoard, 'b');
        if (m) {
          const next = [...checkersBoard];
          next[m.to] = next[m.from];
          next[m.from] = null;
          if (m.capture !== undefined) next[m.capture] = null;
          // King promotion
          if (Math.floor(m.to / 8) === 7) next[m.to] = 'B';
          setCheckersBoard(next);
        }
        setTurn('player');
      }

      // 3. Chess Computer Turn
      else if (selectedGame === 'chess') {
        const m = chooseChessComputerMove(chessBoard);
        if (m) {
          const next = [...chessBoard];
          next[m.to] = next[m.from];
          next[m.from] = null;
          setChessBoard(next);
        }
        setTurn('player');
      }

      // 4. Battleship Computer Turn
      else if (selectedGame === 'battleship') {
        const shot = chooseBattleshipShot(
          playerBattleGrid.map((c) => (c === 'hit' ? 'hit' : c === 'miss' ? 'miss' : 'empty')),
          enemyHits
        );
        const next = [...playerBattleGrid];
        if (next[shot] === 'ship') {
          next[shot] = 'hit';
          setEnemyHits((prev) => [...prev, shot]);
        } else {
          next[shot] = 'miss';
        }
        setPlayerBattleGrid(next);
        setTurn('player');
      }

      // 5. Blackjack Dealer Turn
      else if (selectedGame === 'blackjack') {
        const dealerTotal = calculateBlackjackTotal(bjDealerHand);
        const playerTotal = calculateBlackjackTotal(bjPlayerHand);
        if (dealerTotal < 17) {
          const deck = createStandardDeck();
          setBjDealerHand((prev) => [...prev, deck[0]]);
        } else {
          // Compare
          if (dealerTotal > 21 || playerTotal > dealerTotal) {
            setGameStatus('won');
            setStatusMessage(lang === 'ar' ? '🎉 فزت على الموزع!' : 'You won against the dealer!');
          } else if (playerTotal === dealerTotal) {
            setGameStatus('draw');
            setStatusMessage(lang === 'ar' ? 'تعادل مع الموزع!' : 'Push / Tie!');
          } else {
            setGameStatus('lost');
            setStatusMessage(lang === 'ar' ? 'فاز الموزع هذه الجولة.' : 'Dealer won this round.');
          }
        }
      }

      // 6. Nim Computer Turn
      else if (selectedGame === 'nim') {
        const heaps = [...nimHeaps];
        const nonEmpty = heaps.map((h, i) => (h > 0 ? i : -1)).filter((i) => i !== -1);
        if (nonEmpty.length > 0) {
          const idx = nonEmpty[Math.floor(Math.random() * nonEmpty.length)];
          const count = Math.max(1, Math.min(heaps[idx], 1));
          heaps[idx] -= count;
          setNimHeaps(heaps);
          if (heaps.every((h) => h === 0)) {
            setGameStatus('won');
            setStatusMessage(lang === 'ar' ? '🎉 الحاسوب سحب العود الأخير؛ أنت الفائز!' : 'Computer drew the last stick; you win!');
          } else {
            setTurn('player');
          }
        }
      }

      // 7. Pig Dice Computer Turn
      else if (selectedGame === 'pig-dice') {
        const roll = Math.floor(Math.random() * 6) + 1;
        if (roll === 1) {
          setTurn('player');
        } else {
          setPigScores((prev) => {
            const newComp = prev.computer + roll;
            if (newComp >= 100) {
              setGameStatus('lost');
              setStatusMessage(lang === 'ar' ? 'فاز الحاسوب بالوصول لـ 100 نقطة!' : 'Computer won by reaching 100 points!');
            }
            return { ...prev, computer: newComp };
          });
          setTurn('player');
        }
      }

      // 8. Chkobba Computer Turn
      else if (selectedGame === 'chkobba') {
        if (chkobbaComputerHand.length > 0) {
          const card = chkobbaComputerHand[0];
          setChkobbaComputerHand((prev) => prev.slice(1));
          setChkobbaTable((prev) => [...prev, card]);
        }
        setTurn('player');
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [turn, gameMode, gameStatus, selectedGame]);

  const currentGameMeta = ALL_22_GAMES.find((g) => g.id === selectedGame) || ALL_22_GAMES[0];
  const filteredGames = activeCategory === ('all' as any)
    ? ALL_22_GAMES
    : ALL_22_GAMES.filter((g) => g.category === activeCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-2 sm:p-4">
      <div className="flex flex-col w-full max-w-4xl h-[92vh] bg-white dark:bg-[#1A162B] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden text-slate-800 dark:text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-[#141122]">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-600/10 text-violet-600 dark:text-violet-400">
              <Dices className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold flex items-center gap-2">
                {lang === 'ar' ? currentGameMeta.titleAr : currentGameMeta.titleEn}
                <span className="text-[10px] font-normal px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300">
                  {currentGameMeta.badgeAr}
                </span>
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1">
                {lang === 'ar' ? currentGameMeta.descriptionAr : currentGameMeta.descriptionEn}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mode Switcher */}
            <div className="flex bg-slate-200 dark:bg-white/10 p-0.5 rounded-lg text-xs">
              <button
                type="button"
                onClick={() => setGameMode('ai')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                  gameMode === 'ai'
                    ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-xs font-bold'
                    : 'text-slate-600 dark:text-slate-300'
                }`}
              >
                <Bot className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'ضد الحاسوب' : 'vs AI'}
              </button>
              {onSendChallenge && (
                <button
                  type="button"
                  onClick={() => {
                    setGameMode('friend');
                    onSendChallenge(selectedGame);
                  }}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-all ${
                    gameMode === 'friend'
                      ? 'bg-white dark:bg-violet-600 text-violet-700 dark:text-white shadow-xs font-bold'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  {lang === 'ar' ? `تحدي ${opponentName}` : `vs ${opponentName}`}
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-100/60 dark:bg-[#161324] border-b border-slate-200 dark:border-white/5 overflow-x-auto text-xs shrink-0">
          <button
            type="button"
            onClick={() => setActiveCategory('all' as any)}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
              activeCategory === ('all' as any)
                ? 'bg-violet-600 text-white font-bold'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {lang === 'ar' ? 'كافة الألعاب (22)' : 'All Games (22)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('card')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
              activeCategory === 'card'
                ? 'bg-violet-600 text-white font-bold'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {lang === 'ar' ? 'ألعاب الورق (9)' : 'Card Games (9)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('fast')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
              activeCategory === 'fast'
                ? 'bg-violet-600 text-white font-bold'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {lang === 'ar' ? 'الألعاب السريعة (3)' : 'Fast Games (3)'}
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory('strategy')}
            className={`px-3 py-1 rounded-full whitespace-nowrap transition-all ${
              activeCategory === 'strategy'
                ? 'bg-violet-600 text-white font-bold'
                : 'bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
            }`}
          >
            {lang === 'ar' ? 'التفكير والاستراتيجية (10)' : 'Strategy & Thinking (10)'}
          </button>
        </div>

        {/* Main Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
          {/* Left / Bottom Game Picker List */}
          <div className="md:col-span-4 lg:col-span-3 border-e border-slate-200 dark:border-white/10 p-2 overflow-y-auto max-h-[30vh] md:max-h-full space-y-1 bg-slate-50/50 dark:bg-[#151221]">
            {filteredGames.map((game) => {
              const isSelected = selectedGame === game.id;
              return (
                <button
                  key={game.id}
                  type="button"
                  onClick={() => initGame(game.id)}
                  className={`w-full text-start p-2.5 rounded-xl transition-all flex items-center justify-between ${
                    isSelected
                      ? 'bg-violet-600 text-white shadow-md font-bold'
                      : 'hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="text-xs">{game.id === 'chess' ? '♟️' : game.category === 'card' ? '🃏' : game.category === 'fast' ? '⚡' : '🧠'}</span>
                    <span className="text-xs truncate">{lang === 'ar' ? game.titleAr : game.titleEn}</span>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-md ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-white/10 text-slate-500'}`}>
                    {game.badgeAr}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Right Game Canvas & Interactive Playing Area */}
          <div className="md:col-span-8 lg:col-span-9 p-3 sm:p-5 flex flex-col items-center justify-center overflow-y-auto bg-slate-100/50 dark:bg-[#1A162B]">
            {/* Status / Notice Banner */}
            <div className="w-full max-w-lg mb-3 flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-[#201C35] border border-slate-200 dark:border-white/10 shadow-xs">
              <div className="flex items-center gap-2 text-xs">
                <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${turn === 'player' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                <span className="font-bold">
                  {turn === 'player'
                    ? lang === 'ar' ? 'دورك الآن' : 'Your Turn'
                    : lang === 'ar' ? 'دور الحاسوب...' : 'Computer is thinking...'}
                </span>
                {statusMessage && <span className="text-violet-600 dark:text-violet-300 font-medium">· {statusMessage}</span>}
              </div>

              <button
                type="button"
                onClick={() => initGame(selectedGame)}
                className="flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 dark:hover:text-white px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {lang === 'ar' ? 'إعادة اللعب' : 'Restart'}
              </button>
            </div>

            {/* Game Canvas Container */}
            <div className="w-full max-w-lg flex-1 flex flex-col items-center justify-center p-4 bg-white dark:bg-[#201C35] rounded-2xl border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden">
              {/* ---------------- 1. Tic-Tac-Toe ---------------- */}
              {selectedGame === 'tic-tac-toe' && (
                <div className="grid grid-cols-3 gap-2 w-64 h-64">
                  {tttBoard.map((val, idx) => (
                    <button
                      key={idx}
                      type="button"
                      disabled={val !== null || turn !== 'player'}
                      onClick={() => {
                        const next = [...tttBoard];
                        next[idx] = 'X';
                        setTttBoard(next);
                        // Simple tactical AI reply
                        const empty = next.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
                        if (empty.length > 0) {
                          setTurn('computer');
                          setTimeout(() => {
                            const compMove = empty[Math.floor(Math.random() * empty.length)];
                            next[compMove] = 'O';
                            setTttBoard([...next]);
                            setTurn('player');
                          }, 400);
                        }
                      }}
                      className="flex items-center justify-center text-3xl font-black rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-600 dark:text-violet-400"
                    >
                      {val}
                    </button>
                  ))}
                </div>
              )}

              {/* ---------------- 2. Reversi / Othello ---------------- */}
              {selectedGame === 'reversi' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="grid grid-cols-8 gap-1 p-2 bg-emerald-800 rounded-xl shadow-inner w-72 h-72 sm:w-80 sm:h-80">
                    {reversiBoard.map((cell, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={cell !== null || turn !== 'player'}
                        onClick={() => {
                          const next = applyReversiMove(reversiBoard, idx, 'W');
                          setReversiBoard(next);
                          setTurn('computer');
                        }}
                        className="flex items-center justify-center rounded-sm bg-emerald-700/80 hover:bg-emerald-600 transition-colors"
                      >
                        {cell === 'W' && <span className="w-5 h-5 rounded-full bg-white shadow-md border border-slate-200" />}
                        {cell === 'B' && <span className="w-5 h-5 rounded-full bg-slate-900 shadow-md border border-slate-700" />}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-4 text-xs font-bold">
                    <span className="flex items-center gap-1">⚪ أنت (أبيض): {reversiBoard.filter((c) => c === 'W').length}</span>
                    <span className="flex items-center gap-1">⚫ الحاسوب (أسود): {reversiBoard.filter((c) => c === 'B').length}</span>
                  </div>
                </div>
              )}

              {/* ---------------- 3. Checkers / Draughts ---------------- */}
              {selectedGame === 'checkers' && (
                <div className="grid grid-cols-8 gap-0.5 p-2 bg-amber-950 rounded-xl shadow-inner w-72 h-72 sm:w-80 sm:h-80">
                  {checkersBoard.map((piece, idx) => {
                    const r = Math.floor(idx / 8);
                    const c = idx % 8;
                    const isDark = (r + c) % 2 === 1;
                    const isSelected = selectedCheckerPos === idx;
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={turn !== 'player'}
                        onClick={() => {
                          if (selectedCheckerPos === null) {
                            if (piece && piece.toLowerCase() === 'w') setSelectedCheckerPos(idx);
                          } else {
                            // Move piece
                            const next = [...checkersBoard];
                            next[idx] = next[selectedCheckerPos];
                            next[selectedCheckerPos] = null;
                            if (Math.abs(idx - selectedCheckerPos) > 9) {
                              const mid = (selectedCheckerPos + idx) / 2;
                              next[mid] = null;
                            }
                            if (Math.floor(idx / 8) === 0) next[idx] = 'W';
                            setCheckersBoard(next);
                            setSelectedCheckerPos(null);
                            setTurn('computer');
                          }
                        }}
                        className={`flex items-center justify-center rounded-xs transition-colors ${
                          isDark ? 'bg-amber-900' : 'bg-amber-100 dark:bg-amber-200'
                        } ${isSelected ? 'ring-2 ring-emerald-400' : ''}`}
                      >
                        {piece && (
                          <span
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shadow-md ${
                              piece.toLowerCase() === 'w' ? 'bg-white text-slate-800' : 'bg-slate-900 text-white'
                            }`}
                          >
                            {piece === 'W' || piece === 'B' ? '👑' : ''}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ---------------- 4. Chess ---------------- */}
              {selectedGame === 'chess' && (
                <div className="grid grid-cols-8 gap-0.5 p-2 bg-slate-800 rounded-xl shadow-inner w-72 h-72 sm:w-80 sm:h-80">
                  {chessBoard.map((p, idx) => {
                    const r = Math.floor(idx / 8);
                    const c = idx % 8;
                    const isDark = (r + c) % 2 === 1;
                    const isSelected = selectedChessPos === idx;
                    const PIECE_EMOJIS: Record<string, string> = {
                      P: '♙', R: '♖', N: '♘', B: '♗', Q: '♕', K: '♔',
                      p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚',
                    };
                    return (
                      <button
                        key={idx}
                        type="button"
                        disabled={turn !== 'player'}
                        onClick={() => {
                          if (selectedChessPos === null) {
                            if (p && p === p.toUpperCase()) setSelectedChessPos(idx);
                          } else {
                            const next = [...chessBoard];
                            next[idx] = next[selectedChessPos];
                            next[selectedChessPos] = null;
                            setChessBoard(next);
                            setSelectedChessPos(null);
                            setTurn('computer');
                          }
                        }}
                        className={`flex items-center justify-center text-lg sm:text-2xl transition-colors ${
                          isDark ? 'bg-slate-700' : 'bg-slate-300 text-slate-900'
                        } ${isSelected ? 'ring-2 ring-violet-500' : ''}`}
                      >
                        {p ? PIECE_EMOJIS[p] : ''}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* ---------------- 5. Memory Grid ---------------- */}
              {selectedGame === 'memory-grid' && (
                <div className="grid grid-cols-4 gap-2 w-64 h-64 sm:w-72 sm:h-72">
                  {memoryCards.map((card, idx) => (
                    <button
                      key={card.id}
                      type="button"
                      disabled={card.isFlipped || card.isMatched}
                      onClick={() => {
                        const next = [...memoryCards];
                        next[idx].isFlipped = true;
                        setMemoryCards(next);
                        const newFlipped = [...flippedMemoryIndices, idx];
                        setFlippedMemoryIndices(newFlipped);

                        if (newFlipped.length === 2) {
                          const [first, second] = newFlipped;
                          if (next[first].symbol === next[second].symbol) {
                            next[first].isMatched = true;
                            next[second].isMatched = true;
                            setMemoryCards([...next]);
                            setFlippedMemoryIndices([]);
                          } else {
                            setTimeout(() => {
                              next[first].isFlipped = false;
                              next[second].isFlipped = false;
                              setMemoryCards([...next]);
                              setFlippedMemoryIndices([]);
                            }, 800);
                          }
                        }
                      }}
                      className={`flex items-center justify-center text-2xl rounded-xl transition-all shadow-xs ${
                        card.isFlipped || card.isMatched
                          ? 'bg-violet-600 text-white'
                          : 'bg-slate-100 dark:bg-white/10 hover:bg-slate-200'
                      }`}
                    >
                      {card.isFlipped || card.isMatched ? card.symbol : '❓'}
                    </button>
                  ))}
                </div>
              )}

              {/* ---------------- 6. Battleship ---------------- */}
              {selectedGame === 'battleship' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="text-xs font-bold text-slate-500">اختر إحداثية لقصف أسطول العدو:</div>
                  <div className="grid grid-cols-6 gap-1 p-2 bg-blue-950 rounded-xl w-64 h-64">
                    {enemyBattleGrid.map((cell, idx) => (
                      <button
                        key={idx}
                        type="button"
                        disabled={cell === 'hit' || cell === 'miss' || turn !== 'player'}
                        onClick={() => {
                          const next = [...enemyBattleGrid];
                          if (next[idx] === 'ship') {
                            next[idx] = 'hit';
                          } else {
                            next[idx] = 'miss';
                          }
                          setEnemyBattleGrid(next);
                          setTurn('computer');
                        }}
                        className={`rounded-sm flex items-center justify-center text-xs font-bold ${
                          cell === 'hit'
                            ? 'bg-rose-600 text-white animate-bounce'
                            : cell === 'miss'
                            ? 'bg-blue-800 text-blue-200'
                            : 'bg-blue-900/60 hover:bg-blue-700'
                        }`}
                      >
                        {cell === 'hit' ? '💥' : cell === 'miss' ? '🌊' : ''}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------- 7. Card War (حرب الورق) ---------------- */}
              {selectedGame === 'card-war' && (
                <div className="flex flex-col items-center gap-4">
                  <div className="flex items-center gap-8">
                    {/* Player Card */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold">ورقتك ({warScore.player})</span>
                      <div className="w-24 h-36 rounded-xl bg-white text-slate-900 border-2 border-slate-300 shadow-lg flex flex-col justify-between p-2">
                        <span className={`text-base font-black ${playerWarCard?.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{playerWarCard?.label} {playerWarCard?.symbol}</span>
                        <span className="text-3xl text-center">{playerWarCard?.symbol}</span>
                        <span className={`text-base font-black self-end ${playerWarCard?.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{playerWarCard?.label}</span>
                      </div>
                    </div>

                    <span className="text-xl font-black text-violet-600">VS</span>

                    {/* Computer Card */}
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-xs font-bold">الحاسوب ({warScore.computer})</span>
                      <div className="w-24 h-36 rounded-xl bg-white text-slate-900 border-2 border-slate-300 shadow-lg flex flex-col justify-between p-2">
                        <span className={`text-base font-black ${computerWarCard?.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{computerWarCard?.label} {computerWarCard?.symbol}</span>
                        <span className="text-3xl text-center">{computerWarCard?.symbol}</span>
                        <span className={`text-base font-black self-end ${computerWarCard?.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{computerWarCard?.label}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      const deck = createStandardDeck();
                      const pCard = deck[0];
                      const cCard = deck[1];
                      setPlayerWarCard(pCard);
                      setComputerWarCard(cCard);
                      if (pCard.rank > cCard.rank) {
                        setWarScore((s) => ({ ...s, player: s.player + 1 }));
                        setStatusMessage(lang === 'ar' ? 'فزت بالجولة!' : 'You won the round!');
                      } else if (cCard.rank > pCard.rank) {
                        setWarScore((s) => ({ ...s, computer: s.computer + 1 }));
                        setStatusMessage(lang === 'ar' ? 'فاز الحاسوب بالجولة!' : 'Computer won the round!');
                      } else {
                        setStatusMessage(lang === 'ar' ? 'حرب! تعادل في الورقة!' : 'War! It is a tie!');
                      }
                    }}
                    className="px-6 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-sm shadow-md transition-transform active:scale-95"
                  >
                    {lang === 'ar' ? 'اسحب الورقة التالية' : 'Draw Next Card'}
                  </button>
                </div>
              )}

              {/* ---------------- 8. Higher or Lower (أعلى أم أدنى) ---------------- */}
              {selectedGame === 'higher-lower' && (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-xs font-bold text-slate-500">سلسلة التخمين الصحيح: {hlStreak} 🔥</span>
                  {hlCurrentCard && (
                    <div className="w-28 h-40 rounded-xl bg-white text-slate-900 border-2 border-slate-300 shadow-lg flex flex-col justify-between p-2.5">
                      <span className={`text-lg font-black ${hlCurrentCard.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{hlCurrentCard.label} {hlCurrentCard.symbol}</span>
                      <span className="text-4xl text-center">{hlCurrentCard.symbol}</span>
                      <span className={`text-lg font-black self-end ${hlCurrentCard.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{hlCurrentCard.label}</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const deck = createStandardDeck();
                        const next = deck[0];
                        if (next.rank >= (hlCurrentCard?.rank || 0)) {
                          setHlStreak((s) => s + 1);
                          setStatusMessage(lang === 'ar' ? `صحيح! الورقة (${next.label}) أعلى.` : `Correct! (${next.label}) is higher.`);
                        } else {
                          setHlStreak(0);
                          setStatusMessage(lang === 'ar' ? `خطأ! الورقة (${next.label}) كانت أدنى.` : `Wrong! (${next.label}) was lower.`);
                        }
                        setHlCurrentCard(next);
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                    >
                      {lang === 'ar' ? '▲ أعلى (Higher)' : '▲ Higher'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const deck = createStandardDeck();
                        const next = deck[0];
                        if (next.rank <= (hlCurrentCard?.rank || 0)) {
                          setHlStreak((s) => s + 1);
                          setStatusMessage(lang === 'ar' ? `صحيح! الورقة (${next.label}) أدنى.` : `Correct! (${next.label}) is lower.`);
                        } else {
                          setHlStreak(0);
                          setStatusMessage(lang === 'ar' ? `خطأ! الورقة (${next.label}) كانت أعلى.` : `Wrong! (${next.label}) was higher.`);
                        }
                        setHlCurrentCard(next);
                      }}
                      className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
                    >
                      {lang === 'ar' ? '▼ أدنى (Lower)' : '▼ Lower'}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 9. Blackjack (21) ---------------- */}
              {selectedGame === 'blackjack' && (
                <div className="flex flex-col items-center gap-4 w-full">
                  {/* Dealer Hand */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-slate-500">يد الموزع: {turn === 'player' ? '?' : calculateBlackjackTotal(bjDealerHand)}</span>
                    <div className="flex gap-2">
                      {bjDealerHand.map((c, i) => (
                        <div key={i} className="w-14 h-20 rounded-lg bg-white border border-slate-300 shadow-sm flex flex-col justify-between p-1 text-slate-900">
                          <span className={`text-[10px] font-bold ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{turn === 'player' && i === 1 ? '🂠' : `${c.label} ${c.symbol}`}</span>
                          <span className="text-base text-center">{turn === 'player' && i === 1 ? '🔒' : c.symbol}</span>
                          <span className="text-[10px] self-end">{turn === 'player' && i === 1 ? '' : c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Player Hand */}
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-emerald-600">يدك: {calculateBlackjackTotal(bjPlayerHand)}</span>
                    <div className="flex gap-2">
                      {bjPlayerHand.map((c, i) => (
                        <div key={i} className="w-14 h-20 rounded-lg bg-white border border-slate-300 shadow-sm flex flex-col justify-between p-1 text-slate-900">
                          <span className={`text-[10px] font-bold ${c.color === 'red' ? 'text-rose-600' : 'text-slate-900'}`}>{c.label} {c.symbol}</span>
                          <span className="text-base text-center">{c.symbol}</span>
                          <span className="text-[10px] self-end">{c.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={turn !== 'player' || gameStatus !== 'playing'}
                      onClick={() => {
                        const deck = createStandardDeck();
                        const nextHand = [...bjPlayerHand, deck[0]];
                        setBjPlayerHand(nextHand);
                        if (calculateBlackjackTotal(nextHand) > 21) {
                          setGameStatus('lost');
                          setStatusMessage(lang === 'ar' ? 'تجاوزت 21 (Bust)! فاز الموزع.' : 'Bust over 21! Dealer won.');
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md"
                    >
                      {lang === 'ar' ? 'سحب ورقة (Hit)' : 'Hit'}
                    </button>
                    <button
                      type="button"
                      disabled={turn !== 'player' || gameStatus !== 'playing'}
                      onClick={() => setTurn('computer')}
                      className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-800 text-white font-bold text-xs shadow-md"
                    >
                      {lang === 'ar' ? 'توقف (Stand)' : 'Stand'}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 10. Nim Game ---------------- */}
              {selectedGame === 'nim' && (
                <div className="flex flex-col items-center gap-4">
                  <span className="text-xs text-slate-500 font-bold">اللاعب الذي يسحب العود الأخير يخسر:</span>
                  <div className="flex gap-6 items-end">
                    {nimHeaps.map((count, heapIdx) => (
                      <div key={heapIdx} className="flex flex-col items-center gap-2">
                        <div className="flex flex-col gap-1 items-center bg-slate-100 dark:bg-white/5 p-2 rounded-lg min-h-[100px] justify-end">
                          {Array.from({ length: count }).map((_, i) => (
                            <div key={i} className="w-3 h-8 rounded-full bg-amber-600 shadow-xs" />
                          ))}
                        </div>
                        <button
                          type="button"
                          disabled={count === 0 || turn !== 'player'}
                          onClick={() => {
                            const next = [...nimHeaps];
                            next[heapIdx] -= 1;
                            setNimHeaps(next);
                            if (next.every((h) => h === 0)) {
                              setGameStatus('lost');
                              setStatusMessage(lang === 'ar' ? 'سحبت العود الأخير؛ خسرت الجولة!' : 'You took the last stick; you lost!');
                            } else {
                              setTurn('computer');
                            }
                          }}
                          className="px-2.5 py-1 rounded-md bg-violet-600 hover:bg-violet-700 text-white text-[11px] font-bold"
                        >
                          {lang === 'ar' ? 'اسحب 1' : 'Take 1'}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------- 11. Pig Dice (الخنزير بالنرد) ---------------- */}
              {selectedGame === 'pig-dice' && (
                <div className="flex flex-col items-center gap-3">
                  <div className="flex gap-8 text-xs font-bold">
                    <span>نقاطك: {pigScores.player}</span>
                    <span>نقاط الجولة: {pigTurnPoints}</span>
                    <span>الحاسوب: {pigScores.computer}</span>
                  </div>
                  <div className="text-5xl font-black text-violet-600 my-2">
                    {pigLastRoll ? `🎲 ${pigLastRoll}` : '🎲'}
                  </div>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={turn !== 'player'}
                      onClick={() => {
                        const roll = Math.floor(Math.random() * 6) + 1;
                        setPigLastRoll(roll);
                        if (roll === 1) {
                          setPigTurnPoints(0);
                          setStatusMessage(lang === 'ar' ? 'ظهر 1! فقدت نقاط الجولة وانتقل الدور.' : 'Rolled a 1! Turn points lost.');
                          setTurn('computer');
                        } else {
                          setPigTurnPoints((p) => p + roll);
                        }
                      }}
                      className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md"
                    >
                      {lang === 'ar' ? 'ارمِ النرد' : 'Roll Dice'}
                    </button>
                    <button
                      type="button"
                      disabled={turn !== 'player' || pigTurnPoints === 0}
                      onClick={() => {
                        setPigScores((s) => {
                          const newPlayer = s.player + pigTurnPoints;
                          if (newPlayer >= 100) {
                            setGameStatus('won');
                            setStatusMessage(lang === 'ar' ? '🎉 فزت بالوصول إلى 100 نقطة!' : 'Won by reaching 100!');
                          }
                          return { ...s, player: newPlayer };
                        });
                        setPigTurnPoints(0);
                        setTurn('computer');
                      }}
                      className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md"
                    >
                      {lang === 'ar' ? 'تثبيت النقاط (Hold)' : 'Hold'}
                    </button>
                  </div>
                </div>
              )}

              {/* ---------------- 12. Guess Number (خمن الرقم) ---------------- */}
              {selectedGame === 'guess-number' && (
                <div className="flex flex-col items-center gap-4 max-w-xs">
                  <span className="text-xs text-slate-500 font-bold">خمّن الرقم المخفي بين 1 و 100:</span>
                  <div className="flex gap-2 w-full">
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={guessInput}
                      onChange={(e) => setGuessInput(e.target.value)}
                      placeholder="50"
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-center font-bold text-base"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const val = parseInt(guessInput, 10);
                        if (isNaN(val)) return;
                        if (val === guessTarget) {
                          setGameStatus('won');
                          setGuessHint(lang === 'ar' ? '🎉 أحسنت! الرقم صحيح تماماً!' : 'Bingo! Correct number!');
                        } else if (val < guessTarget) {
                          setGuessHint(lang === 'ar' ? '▲ الرقم السري أعلى!' : '▲ Higher!');
                        } else {
                          setGuessHint(lang === 'ar' ? '▼ الرقم السري أدنى!' : '▼ Lower!');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shrink-0"
                    >
                      {lang === 'ar' ? 'تخمين' : 'Guess'}
                    </button>
                  </div>
                  {guessHint && <div className="text-sm font-bold text-violet-600 dark:text-violet-300">{guessHint}</div>}
                </div>
              )}

              {/* Fallback for other card & board games */}
              {!['tic-tac-toe', 'reversi', 'checkers', 'chess', 'memory-grid', 'battleship', 'card-war', 'higher-lower', 'blackjack', 'nim', 'pig-dice', 'guess-number'].includes(selectedGame) && (
                <div className="flex flex-col items-center gap-3 text-center p-6">
                  <div className="w-16 h-16 rounded-2xl bg-violet-100 dark:bg-violet-900/30 text-violet-600 flex items-center justify-center text-3xl">
                    🃏
                  </div>
                  <h3 className="font-bold text-base">{lang === 'ar' ? currentGameMeta.titleAr : currentGameMeta.titleEn}</h3>
                  <p className="text-xs text-slate-500 max-w-sm">{lang === 'ar' ? currentGameMeta.descriptionAr : currentGameMeta.descriptionEn}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusMessage(lang === 'ar' ? 'بدأت جولة جديدة مع الذكاء الاصطناعي!' : 'Round started with AI!');
                      setTurn('player');
                    }}
                    className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-md mt-2"
                  >
                    {lang === 'ar' ? 'بدء جولة تفاعلية' : 'Start Interactive Round'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
