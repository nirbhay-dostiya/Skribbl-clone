import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGame } from '../context/GameContext';
import type { PlayerSession } from '../types/game';
import './HomePage.css';

export default function HomePage() {
  const navigate = useNavigate();
  const { dispatch } = useGame();

  const [tab, setTab] = useState<'create' | 'join'>('create');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(8);
  const [totalRounds, setTotalRounds] = useState(3);
  const [drawTime, setDrawTime] = useState(80);
  const [wordCount, setWordCount] = useState(3);
  const [hints, setHints] = useState(2);
  const [customWords, setCustomWords] = useState('');
  const [useCustomWordsOnly, setUseCustomWordsOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) { setError('Enter a nickname!'); return; }

    // Parse custom words from textarea
    const parsedCustomWords = customWords
      .split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0 && w.length <= 32);

    // Validate custom-words-only mode
    if (useCustomWordsOnly && parsedCustomWords.length < 3) {
      setError('Add at least 3 custom words to use custom words only mode.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/rooms/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          maxPlayers,
          totalRounds,
          drawTimeSeconds: drawTime,
          wordCount,
          hints,
          customWords: parsedCustomWords,
          useCustomWordsOnly,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.roomCode) {
        setError(data.message || 'Failed to create room');
        return;
      }

      const session: PlayerSession = {
        playerId: data.playerId,
        nickname: data.nickname,
        roomCode: data.roomCode,
        isHost: true,
      };
      dispatch({ type: 'SET_SESSION', payload: session });
      navigate(`/lobby/${data.roomCode}`);
    } catch {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nickname.trim()) { setError('Enter a nickname!'); return; }
    if (!roomCode.trim()) { setError('Enter a room code!'); return; }
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/rooms/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          roomCode: roomCode.trim().toUpperCase(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.roomCode) {
        setError(data.message || 'Failed to join room');
        return;
      }

      const session: PlayerSession = {
        playerId: data.playerId,
        nickname: data.nickname,
        roomCode: data.roomCode,
        isHost: false,
      };
      dispatch({ type: 'SET_SESSION', payload: session });
      navigate(`/lobby/${data.roomCode}`);
    } catch {
      setError('Cannot connect to server. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="home-page">
      {/* Background effects */}
      <div className="home-bg">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
      </div>

      <div className="home-content animate-slideUp">
        {/* Logo — skribbl.io rainbow style */}
        <div className="home-logo">
          <h1 className="logo-title">
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
            <span className="pencil">✏️</span>
          </h1>
          <p className="logo-tagline">Draw · Guess · Win!</p>
        </div>

        {/* Card */}
        <div className="home-card card">
          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab-btn ${tab === 'create' ? 'active' : ''}`}
              onClick={() => { setTab('create'); setError(''); }}
            >
              ✨ Create Room
            </button>
            <button
              className={`tab-btn ${tab === 'join' ? 'active' : ''}`}
              onClick={() => { setTab('join'); setError(''); }}
            >
              🚀 Join Room
            </button>
          </div>

          <form onSubmit={tab === 'create' ? handleCreate : handleJoin}>
            <div className="form-group">
              <label className="form-label">Your Nickname</label>
              <input
                id="nickname-input"
                className="input"
                placeholder="e.g., DoodleMaster"
                value={nickname}
                onChange={e => setNickname(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>

            {tab === 'join' && (
              <div className="form-group">
                <label className="form-label">Room Code</label>
                <input
                  id="room-code-input"
                  className="input code-input"
                  placeholder="e.g., ABC123"
                  value={roomCode}
                  onChange={e => setRoomCode(e.target.value.toUpperCase())}
                  maxLength={6}
                />
              </div>
            )}

            {tab === 'create' && (
              <>
                {/* Settings grid — 2 columns */}
                <div className="settings-grid-2">
                  <div className="form-group">
                    <label className="form-label">👥 Players</label>
                    <select className="input" value={maxPlayers} onChange={e => setMaxPlayers(Number(e.target.value))}>
                      {[2,3,4,5,6,7,8].map(n => <option key={n} value={n}>{n} players</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">⏱️ Draw Time</label>
                    <select className="input" value={drawTime} onChange={e => setDrawTime(Number(e.target.value))}>
                      {[30,45,60,80,100,120].map(n => <option key={n} value={n}>{n}s</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">🔄 Rounds</label>
                    <select className="input" value={totalRounds} onChange={e => setTotalRounds(Number(e.target.value))}>
                      {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} rounds</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">📝 Word Count</label>
                    <select className="input" value={wordCount} onChange={e => setWordCount(Number(e.target.value))}>
                      {[1,2,3].map(n => <option key={n} value={n}>{n} words</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">💡 Hints</label>
                    <select className="input" value={hints} onChange={e => setHints(Number(e.target.value))}>
                      <option value={0}>0 — No hints</option>
                      <option value={1}>1 — One letter revealed</option>
                      <option value={2}>2 — Two letters revealed</option>
                    </select>
                  </div>
                </div>

                {/* Custom Words section */}
                <div className="custom-words-section">
                  <div className="custom-words-header">
                    <label className="form-label" style={{ margin: 0 }}>✏️ Custom Words</label>
                    <label className="toggle-label">
                      <input
                        type="checkbox"
                        className="toggle-input"
                        checked={useCustomWordsOnly}
                        onChange={e => setUseCustomWordsOnly(e.target.checked)}
                      />
                      <span className="toggle-switch" />
                      <span className="toggle-text">Use custom words only</span>
                    </label>
                  </div>
                  <textarea
                    id="custom-words-input"
                    className="custom-words-textarea"
                    placeholder="Enter words separated by commas: cat, spaceship, guitar, pizza..."
                    value={customWords}
                    onChange={e => setCustomWords(e.target.value)}
                    rows={3}
                    maxLength={20000}
                  />
                  <p className="custom-words-hint">
                    {customWords.trim()
                      ? `${customWords.split(',').filter(w => w.trim()).length} word(s) · 1–32 characters each`
                      : 'Optional · Separate words with commas · Max 32 chars each'}
                  </p>
                </div>
              </>
            )}

            {error && <div className="error-msg">{error}</div>}

            <button
              id="submit-btn"
              type="submit"
              className={`btn btn-lg w-full ${tab === 'create' ? 'btn-primary' : 'btn-accent'}`}
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" style={{ width: 20, height: 20 }} /> Loading...</>
              ) : (
                tab === 'create' ? '✨ Create Room' : '🚀 Join Game'
              )}
            </button>
          </form>
        </div>

        <p className="home-footer">
          Open-source Skribbl.io clone • Spring Boot + React
        </p>
      </div>
    </div>
  );
}
