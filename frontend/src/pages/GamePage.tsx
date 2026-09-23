import { useEffect, useRef, useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import {
  createStompClient,
  subscribeToGameState,
  subscribeToChat,
  subscribeToDraw,
  subscribeToWordChoices,
  sendDrawEvent,
  sendGuess,
  sendWordSelection,
} from '../lib/stompClient';
import Canvas from '../components/Canvas/Canvas';
import type { CanvasHandle } from '../components/Canvas/Canvas';
import Toolbar from '../components/Toolbar/Toolbar';
import Chat from '../components/Chat/Chat';
import PlayerList from '../components/PlayerList/PlayerList';
import WordHint from '../components/WordHint/WordHint';
import Timer from '../components/Timer/Timer';
import type { DrawEvent } from '../types/game';
import './GamePage.css';

export default function GamePage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { session, gameState, messages, wordChoices, isConnected, dispatch, stompClientRef } = useGame();

  // Canvas tool state
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(8);
  const [tool, setTool] = useState<'pen' | 'fill'>('pen');
  const canvasRef = useRef<CanvasHandle>(null);

  // Track undo history (list of image data URLs)
  const undoStack = useRef<ImageData[]>([]);

  // Drawer-only: the actual word
  const [myCurrentWord, setMyCurrentWord] = useState<string | null>(null);

  // ── Session guard ───────────────────────────────────────────

  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      navigate('/');
    }
  }, [session, roomCode, navigate]);

  // ── WebSocket connection ────────────────────────────────────

  // setupSubscriptions must be declared BEFORE the useEffect that lists it as a dependency
  const setupSubscriptions = useCallback((client: any) => {
    if (!roomCode || !session) return;

    const sub1 = subscribeToGameState(client, roomCode, (state) => {
      dispatch({ type: 'SET_GAME_STATE', payload: state });
      if (state.phase === 'WAITING') navigate(`/lobby/${roomCode}`);
    });

    const sub2 = subscribeToChat(client, roomCode, (msg) => {
      dispatch({ type: 'ADD_MESSAGE', payload: msg });
    });

    const sub3 = subscribeToDraw(client, roomCode, (event) => {
      canvasRef.current?.applyDrawEvent(event);
    });

    const sub4 = subscribeToWordChoices(client, roomCode, session.playerId, (words) => {
      dispatch({ type: 'SET_WORD_CHOICES', payload: words });
      setMyCurrentWord(null);
    });

    // Fetch initial game state
    fetch(`/api/rooms/${roomCode}/state`)
      .then(r => r.json())
      .then(state => dispatch({ type: 'SET_GAME_STATE', payload: state }))
      .catch(console.error);

    return () => {
      try { sub1.unsubscribe(); } catch { /* ignore */ }
      try { sub2.unsubscribe(); } catch { /* ignore */ }
      try { sub3.unsubscribe(); } catch { /* ignore */ }
      try { sub4.unsubscribe(); } catch { /* ignore */ }
    };
  }, [roomCode, session, navigate, dispatch]);

  useEffect(() => {
    if (!session || !roomCode) return;

    let cleanupSubs: (() => void) | undefined;

    if (!stompClientRef.current?.connected) {
      // No live connection — create a new one (direct page load or refresh)
      const client = createStompClient(
        () => {
          dispatch({ type: 'SET_CONNECTED', payload: true });
          cleanupSubs = setupSubscriptions(client);
        },
        () => dispatch({ type: 'SET_CONNECTED', payload: false })
      );
      stompClientRef.current = client;
      client.activate();
    } else {
      // Reuse existing live connection from Lobby (normal game start flow)
      cleanupSubs = setupSubscriptions(stompClientRef.current);
    }

    return () => {
      if (cleanupSubs) cleanupSubs();
    };
  }, [session, roomCode, setupSubscriptions]);

  // ── Drawing handlers ────────────────────────────────────────

  const handleDrawEvent = useCallback((event: DrawEvent) => {
    if (!stompClientRef.current || !session) return;
    sendDrawEvent(stompClientRef.current, roomCode!, session.playerId, event);
  }, [roomCode, session, stompClientRef]);

  const handleClear = useCallback(() => {
    canvasRef.current?.clearCanvas();
    handleDrawEvent({ type: 'CLEAR', x: 0, y: 0, color: '#ffffff', brushSize: 0 });
  }, [handleDrawEvent]);

  const handleUndo = useCallback(() => {
    // Simple undo: use browser's canvas state
    // For a production app, we'd track stroke history server-side
    canvasRef.current?.clearCanvas();
  }, []);

  // ── Guess handler ────────────────────────────────────────────

  const handleGuess = useCallback((guess: string) => {
    if (!stompClientRef.current || !session) return;
    sendGuess(stompClientRef.current, roomCode!, session.playerId, guess);
  }, [roomCode, session, stompClientRef]);

  // ── Word selection ────────────────────────────────────────────

  const handleWordSelect = useCallback((word: string) => {
    if (!stompClientRef.current || !session) return;
    setMyCurrentWord(word);
    dispatch({ type: 'CLEAR_WORD_CHOICES' });
    sendWordSelection(stompClientRef.current, roomCode!, session.playerId, word);
  }, [roomCode, session, stompClientRef, dispatch]);

  // Safety net: if drawer lands on game page in WORD_SELECTION but has no word choices,
  // ask the backend to re-send them (handles the case where the STOMP message was missed
  // during the Lobby→Game navigation transition).
  useEffect(() => {
    const isDrawingPhase = gameState?.phase === 'WORD_SELECTION';
    const isCurrentDrawer = session?.playerId === gameState?.currentDrawerId;
    const hasNoChoices = wordChoices.length === 0;

    if (isDrawingPhase && isCurrentDrawer && hasNoChoices && roomCode && session) {
      const timer = setTimeout(() => {
        fetch(`/api/rooms/${roomCode}/word-choices/${session.playerId}/resend`, {
          method: 'POST',
        }).catch(console.error);
      }, 500); // 500ms delay to let subscriptions settle first
      return () => clearTimeout(timer);
    }
  }, [gameState?.phase, gameState?.currentDrawerId, wordChoices.length, roomCode, session]);

  // ── Clear canvas on new turn ──────────────────────────────────

  const prevDrawerIdRef = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const newDrawerId = gameState?.currentDrawerId;
    // undefined means gameState not yet loaded — skip
    if (prevDrawerIdRef.current === undefined) {
      prevDrawerIdRef.current = newDrawerId;
      return;
    }
    // Drawer changed → new turn started → clear canvas
    if (newDrawerId !== prevDrawerIdRef.current) {
      canvasRef.current?.clearCanvas();
      undoStack.current = [];
      prevDrawerIdRef.current = newDrawerId;
    }
  }, [gameState?.currentDrawerId]);

  // ── Derived state ─────────────────────────────────────────────

  const isDrawer = session?.playerId === gameState?.currentDrawerId;
  const myPlayer = gameState?.players.find(p => p.id === session?.playerId);
  const phase = gameState?.phase ?? 'WAITING';

  // ── Word selection modal ─────────────────────────────────────

  const showWordSelection = phase === 'WORD_SELECTION' && isDrawer && wordChoices.length > 0;

  // ── Game end ──────────────────────────────────────────────────

  if (phase === 'GAME_END') {
    const sorted = [...(gameState?.players ?? [])].sort((a, b) => b.score - a.score);
    const winner = sorted[0];
    return (
      <div className="game-end-screen">
        <div className="game-end-card animate-bounceIn">
          <div className="trophy">🏆</div>
          <h1>Game Over!</h1>
          <p className="winner-text">
            {winner?.id === session?.playerId ? '🎉 You Won!' : `${winner?.nickname} Wins!`}
          </p>
          <div className="final-scores">
            {sorted.map((p, idx) => (
              <div key={p.id} className={`score-row ${idx === 0 ? 'top' : ''}`}>
                <span className="score-rank">
                  {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                </span>
                <span className="score-name">
                  {p.nickname}
                  {p.id === session?.playerId && ' (You)'}
                </span>
                <span className="score-pts">{p.score} pts</span>
              </div>
            ))}
          </div>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/')}>
            🏠 Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-page">
      {/* Header bar — skribbl.io style */}
      <div className="game-header">
        {/* Rainbow logo */}
        <div className="skribbl-header-logo">
          <span className="l-s">s</span>
          <span className="l-k">k</span>
          <span className="l-r">r</span>
          <span className="l-i">i</span>
          <span className="l-b">b</span>
          <span className="l-b2">b</span>
          <span className="l-l">l</span>
          <span className="l-dot">.</span>
          <span className="l-i2">i</span>
          <span className="l-o">o</span>
          <span className="pencil-icon">✏️</span>
        </div>

        <WordHint
          hint={gameState?.wordHint ?? null}
          wordLength={gameState?.wordLength ?? null}
          isDrawing={isDrawer}
          currentWord={myCurrentWord ?? undefined}
          phase={phase}
          drawerName={gameState?.currentDrawerNickname ?? null}
        />

        <Timer
          timeLeft={gameState?.timeLeft ?? 0}
          totalTime={gameState?.drawTimeSeconds ?? 80}
          phase={phase}
        />

        <div className="round-info">
          <span className="round-label">Round</span>
          <span className="round-value">
            {gameState?.currentRound ?? 0}/{gameState?.totalRounds ?? 0}
          </span>
        </div>
      </div>

      {/* Main game area */}
      <div className="game-body">
        {/* Player list */}
        <div className="game-players">
          <PlayerList
            players={gameState?.players ?? []}
            currentPlayerId={session?.playerId ?? ''}
          />
        </div>

        {/* Canvas area */}
        <div className="game-canvas-area">
          {isDrawer && (
            <Toolbar
              color={color}
              brushSize={brushSize}
              tool={tool}
              onColorChange={setColor}
              onBrushSizeChange={setBrushSize}
              onToolChange={setTool}
              onClear={handleClear}
              onUndo={handleUndo}
              disabled={phase !== 'DRAWING'}
            />
          )}
          <div className="canvas-wrapper">
            <Canvas
              ref={canvasRef}
              isDrawing={isDrawer && phase === 'DRAWING'}
              onDrawEvent={handleDrawEvent}
              color={color}
              brushSize={brushSize}
              tool={tool}
            />

            {/* Round end overlay */}
            {phase === 'ROUND_END' && gameState?.revealedWord && (
              <div className="round-end-overlay animate-fadeIn">
                <div className="round-end-card">
                  <div className="round-end-icon">💡</div>
                  <p className="round-end-label">The word was</p>
                  <p className="round-end-word">{gameState.revealedWord}</p>
                  <p className="round-end-sub">Next turn starting soon...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Chat */}
        <div className="game-chat">
          <Chat
            messages={messages}
            onSendGuess={handleGuess}
            isDrawing={isDrawer}
            hasGuessedCorrectly={myPlayer?.hasGuessedCorrectly ?? false}
            phase={phase}
          />
        </div>
      </div>

      {/* Word selection modal */}
      {showWordSelection && (
        <div className="word-modal-overlay">
          <div className="word-modal animate-bounceIn">
            <h2>🎨 Choose a word to draw!</h2>
            <p>You have 15 seconds to choose...</p>
            <div className="word-choices">
              {wordChoices.map(word => (
                <button
                  key={word}
                  id={`word-choice-${word}`}
                  className="word-choice-btn"
                  onClick={() => handleWordSelect(word)}
                >
                  {word}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
