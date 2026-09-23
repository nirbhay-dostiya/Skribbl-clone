import React, { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { Client } from '@stomp/stompjs';
import type { GameStateDto, PlayerSession, ServerMessage } from '../types/game';

// ── State ────────────────────────────────────────────────────────

export interface GameContextState {
  session: PlayerSession | null;
  gameState: GameStateDto | null;
  messages: ServerMessage[];
  wordChoices: string[];
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
}

const initialState: GameContextState = {
  session: null,
  gameState: null,
  messages: [],
  wordChoices: [],
  isConnected: false,
  isConnecting: false,
  error: null,
};

// ── Actions ───────────────────────────────────────────────────────

type Action =
  | { type: 'SET_SESSION'; payload: PlayerSession }
  | { type: 'SET_GAME_STATE'; payload: GameStateDto }
  | { type: 'ADD_MESSAGE'; payload: ServerMessage }
  | { type: 'SET_WORD_CHOICES'; payload: string[] }
  | { type: 'CLEAR_WORD_CHOICES' }
  | { type: 'SET_CONNECTED'; payload: boolean }
  | { type: 'SET_CONNECTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

function reducer(state: GameContextState, action: Action): GameContextState {
  switch (action.type) {
    case 'SET_SESSION':
      return { ...state, session: action.payload };
    case 'SET_GAME_STATE':
      return { ...state, gameState: action.payload };
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages.slice(-100), action.payload] };
    case 'SET_WORD_CHOICES':
      return { ...state, wordChoices: action.payload };
    case 'CLEAR_WORD_CHOICES':
      return { ...state, wordChoices: [] };
    case 'SET_CONNECTED':
      return { ...state, isConnected: action.payload };
    case 'SET_CONNECTING':
      return { ...state, isConnecting: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────

interface GameContextValue extends GameContextState {
  dispatch: React.Dispatch<Action>;
  stompClientRef: React.MutableRefObject<Client | null>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stompClientRef = useRef<Client | null>(null);

  return (
    <GameContext.Provider value={{ ...state, dispatch, stompClientRef }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame(): GameContextValue {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
