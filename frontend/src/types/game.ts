// ── Shared TypeScript types ──────────────────────────────────────

export type GamePhase =
  | 'WAITING'
  | 'WORD_SELECTION'
  | 'DRAWING'
  | 'ROUND_END'
  | 'GAME_END';

export interface PlayerDto {
  id: string;
  nickname: string;
  score: number;
  isHost: boolean;
  hasGuessedCorrectly: boolean;
  isConnected: boolean;
  isDrawing: boolean;
}

export interface GameStateDto {
  roomCode: string;
  phase: GamePhase;
  players: PlayerDto[];
  currentDrawerId: string | null;
  currentDrawerNickname: string | null;
  wordHint: string | null;
  wordLength: number | null;
  currentRound: number;
  totalRounds: number;
  timeLeft: number;
  drawTimeSeconds: number;
  revealedWord: string | null;
  wordCount: number;
  hintsCount: number;
  customWordsCount: number;
  useCustomWordsOnly: boolean;
}

export type ServerMessageType =
  | 'CHAT'
  | 'CORRECT_GUESS'
  | 'CLOSE_GUESS'
  | 'SYSTEM'
  | 'WORD_REVEAL'
  | 'TURN_START'
  | 'GAME_START'
  | 'GAME_END';

export interface ServerMessage {
  type: ServerMessageType;
  senderId: string | null;
  senderNickname: string | null;
  content: string;
  scoreAwarded: number;
}

export type DrawEventType = 'START' | 'DRAW' | 'END' | 'CLEAR' | 'FILL';

export interface DrawEvent {
  type: DrawEventType;
  x: number;
  y: number;
  color: string;
  brushSize: number;
}

export interface PlayerSession {
  playerId: string;
  nickname: string;
  roomCode: string;
  isHost: boolean;
}
