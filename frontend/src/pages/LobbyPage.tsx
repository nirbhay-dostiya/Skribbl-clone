import { useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Client } from '@stomp/stompjs';
import { useGame } from '../context/GameContext';
import {
  createStompClient,
  subscribeToGameState,
  subscribeToChat,
  subscribeToWordChoices,
  sendStartGame,
} from '../lib/stompClient';
import './LobbyPage.css';

export default function LobbyPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { session, gameState, messages, isConnected, dispatch, stompClientRef } = useGame();

  // Redirect if no session
  useEffect(() => {
    if (!session || session.roomCode !== roomCode) {
      navigate('/');
    }
  }, [session, roomCode, navigate]);

  // Connect WebSocket
  useEffect(() => {
    if (!session || !roomCode) return;

    // If already connected, just set up subscriptions (handles page re-renders)
    if (stompClientRef.current?.connected) {
      let cleanupSubs: (() => void) | undefined;

      const sub1 = subscribeToGameState(stompClientRef.current, roomCode, (state) => {
        dispatch({ type: 'SET_GAME_STATE', payload: state });
        if (state.phase !== 'WAITING') {
          navigate(`/game/${roomCode}`);
        }
      });
      const sub2 = subscribeToChat(stompClientRef.current, roomCode, (msg) => {
        dispatch({ type: 'ADD_MESSAGE', payload: msg });
      });
      const sub3 = subscribeToWordChoices(stompClientRef.current, roomCode, session.playerId, (words) => {
        dispatch({ type: 'SET_WORD_CHOICES', payload: words });
      });

      cleanupSubs = () => {
        try { sub1.unsubscribe(); } catch { /* ignore */ }
        try { sub2.unsubscribe(); } catch { /* ignore */ }
        try { sub3.unsubscribe(); } catch { /* ignore */ }
      };

      fetch(`/api/rooms/${roomCode}/state`)
        .then(r => r.json())
        .then(state => {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
          if (state.phase && state.phase !== 'WAITING') {
            navigate(`/game/${roomCode}`);
          }
        })
        .catch(console.error);

      return () => { if (cleanupSubs) cleanupSubs(); };
    }

    // Fresh connection
    dispatch({ type: 'SET_CONNECTING', payload: true });
    let cleanupSubs: (() => void) | undefined;

    const client = createStompClient(
      () => {
        dispatch({ type: 'SET_CONNECTED', payload: true });
        dispatch({ type: 'SET_CONNECTING', payload: false });

        const sub1 = subscribeToGameState(client, roomCode, (state) => {
          dispatch({ type: 'SET_GAME_STATE', payload: state });
          if (state.phase !== 'WAITING') {
            navigate(`/game/${roomCode}`);
          }
        });
        const sub2 = subscribeToChat(client, roomCode, (msg) => {
          dispatch({ type: 'ADD_MESSAGE', payload: msg });
        });
        const sub3 = subscribeToWordChoices(client, roomCode, session.playerId, (words) => {
          dispatch({ type: 'SET_WORD_CHOICES', payload: words });
        });

        cleanupSubs = () => {
          try { sub1.unsubscribe(); } catch { /* ignore */ }
          try { sub2.unsubscribe(); } catch { /* ignore */ }
          try { sub3.unsubscribe(); } catch { /* ignore */ }
        };

        fetch(`/api/rooms/${roomCode}/state`)
          .then(r => r.json())
          .then(state => {
            dispatch({ type: 'SET_GAME_STATE', payload: state });
            if (state.phase && state.phase !== 'WAITING') {
              navigate(`/game/${roomCode}`);
            }
          })
          .catch(console.error);
      },
      () => {
        dispatch({ type: 'SET_CONNECTED', payload: false });
      }
    );

    stompClientRef.current = client;
    client.activate();

    // Only unsubscribe on cleanup — do NOT deactivate the client.
    // The GamePage will reuse this live connection, and word-choices
    // STOMP messages must not be lost during Lobby→Game navigation.
    return () => {
      if (cleanupSubs) cleanupSubs();
    };
  }, [session, roomCode, navigate, dispatch, stompClientRef]);

  const handleStartGame = () => {
    if (!stompClientRef.current || !session) return;
    sendStartGame(stompClientRef.current, roomCode!, session.playerId);
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
  };

  const players = gameState?.players ?? [];
  const canStart = session?.isHost && players.length >= 2;

  return (
    <div className="lobby-page">
      <div className="lobby-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
      </div>

      <div className="lobby-content animate-fadeIn">
        {/* Header */}
        <div className="lobby-header">
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>
            ← Back
          </button>
          <div className="room-code-display">
            <span className="room-code-label">Room Code</span>
            <div className="room-code-value" onClick={copyRoomCode} title="Click to copy">
              {roomCode}
              <span className="copy-icon">📋</span>
            </div>
          </div>
          <div className="connection-status">
            <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
            {isConnected ? 'Connected' : 'Connecting...'}
          </div>
        </div>

        <div className="lobby-body">
          {/* Players list */}
          <div className="card players-card">
            <h2 className="card-title">
              Players
              <span className="badge badge-primary">{players.length}/{gameState?.totalRounds ? '8' : '...'}</span>
            </h2>

            <div className="players-list">
              {players.map((player, idx) => (
                <div key={player.id} className="player-row animate-fadeIn">
                  <div className="player-avatar" style={{ background: getAvatarColor(idx) }}>
                    {player.nickname[0]?.toUpperCase()}
                  </div>
                  <div className="player-info">
                    <span className="player-name">
                      {player.nickname}
                      {player.id === session?.playerId && ' (You)'}
                    </span>
                    {player.isHost && <span className="badge badge-accent">👑 Host</span>}
                  </div>
                  <div className="player-status">
                    <span className={`status-dot ${player.isConnected ? 'connected' : 'disconnected'}`} />
                  </div>
                </div>
              ))}

              {/* Empty slots */}
              {Array.from({ length: Math.max(0, 2 - players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="player-row empty">
                  <div className="player-avatar empty-avatar">?</div>
                  <span className="player-name" style={{ color: 'var(--text-muted)' }}>
                    Waiting for player...
                  </span>
                </div>
              ))}
            </div>

            {/* Start button */}
            {session?.isHost ? (
              <button
                id="start-game-btn"
                className="btn btn-success btn-lg w-full"
                onClick={handleStartGame}
                disabled={!canStart || !isConnected}
                style={{ marginTop: 24 }}
              >
                {players.length < 2
                  ? '⏳ Waiting for players...'
                  : '🎮 Start Game!'}
              </button>
            ) : (
              <div className="waiting-host">
                <div className="spinner" />
                <span>Waiting for the host to start...</span>
              </div>
            )}
          </div>

          {/* Game settings */}
          <div className="card settings-card">
            <h2 className="card-title">Game Settings</h2>
            <div className="settings-list">
              <div className="setting-item">
                <span className="setting-label">🔄 Rounds</span>
                <span className="setting-value">{gameState?.totalRounds ?? '...'}</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">⏱️ Draw Time</span>
                <span className="setting-value">{gameState?.drawTimeSeconds ?? '...'}s</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">👥 Max Players</span>
                <span className="setting-value">{players.length} joined</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">📝 Word Count</span>
                <span className="setting-value">{gameState?.wordCount ?? 3} choices</span>
              </div>
              <div className="setting-item">
                <span className="setting-label">💡 Hints</span>
                <span className="setting-value">{gameState?.hintsCount ?? 2}</span>
              </div>
              {(gameState?.customWordsCount ?? 0) > 0 && (
                <div className="setting-item">
                  <span className="setting-label">✏️ Custom Words</span>
                  <span className="setting-value">
                    {gameState?.customWordsCount}
                    {gameState?.useCustomWordsOnly ? ' (only)' : ' + default'}
                  </span>
                </div>
              )}
            </div>

            <div className="invite-section">
              <p className="invite-text">Share this code with friends:</p>
              <div className="invite-code" onClick={copyRoomCode}>
                {roomCode}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getAvatarColor(index: number): string {
  const colors = [
    'linear-gradient(135deg, #7c3aed, #5b21b6)',
    'linear-gradient(135deg, #f59e0b, #d97706)',
    'linear-gradient(135deg, #10b981, #059669)',
    'linear-gradient(135deg, #3b82f6, #1d4ed8)',
    'linear-gradient(135deg, #ef4444, #b91c1c)',
    'linear-gradient(135deg, #8b5cf6, #6d28d9)',
    'linear-gradient(135deg, #06b6d4, #0e7490)',
    'linear-gradient(135deg, #ec4899, #be185d)',
  ];
  return colors[index % colors.length];
}
