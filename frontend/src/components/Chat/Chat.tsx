import { useRef, useEffect, useState, useCallback } from 'react';
import type { ServerMessage } from '../../types/game';
import './Chat.css';

interface ChatProps {
  messages: ServerMessage[];
  onSendGuess: (guess: string) => void;
  isDrawing: boolean;
  hasGuessedCorrectly: boolean;
  phase: string;
}

export default function Chat({ messages, onSendGuess, isDrawing, hasGuessedCorrectly, phase }: ChatProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onSendGuess(input.trim());
    setInput('');
  };

  const canGuess = !isDrawing && !hasGuessedCorrectly && phase === 'DRAWING';

  const getMessageClass = (msg: ServerMessage): string => {
    switch (msg.type) {
      case 'CORRECT_GUESS': return 'msg-correct';
      case 'CLOSE_GUESS': return 'msg-close';
      case 'SYSTEM': return 'msg-system';
      case 'WORD_REVEAL': return 'msg-reveal';
      case 'GAME_END': return 'msg-system';
      default: return 'msg-chat';
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <span className="chat-title">💬 Chat & Guesses</span>
      </div>

      <div className="messages-list">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${getMessageClass(msg)} animate-fadeIn`}>
            {msg.type === 'CORRECT_GUESS' && (
              <span className="msg-icon">🎉</span>
            )}
            {msg.type === 'CLOSE_GUESS' && (
              <span className="msg-icon">🔥</span>
            )}
            {msg.type === 'SYSTEM' && (
              <span className="msg-icon">ℹ️</span>
            )}
            {msg.type === 'WORD_REVEAL' && (
              <span className="msg-icon">💡</span>
            )}
            <div className="msg-content">
              {msg.senderNickname && msg.type === 'CHAT' && (
                <span className="msg-sender">{msg.senderNickname}: </span>
              )}
              {msg.senderNickname && msg.type === 'CORRECT_GUESS' && (
                <span className="msg-sender">{msg.senderNickname} </span>
              )}
              <span className="msg-text">{msg.content}</span>
              {msg.scoreAwarded > 0 && (
                <span className="score-badge">+{msg.scoreAwarded}</span>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-form" onSubmit={handleSubmit}>
        {isDrawing ? (
          <div className="chat-status drawing">You are drawing!</div>
        ) : hasGuessedCorrectly ? (
          <div className="chat-status guessed">✅ You guessed it!</div>
        ) : (
          <div className="chat-input-row">
            <input
              id="guess-input"
              className="input chat-input"
              placeholder={phase === 'DRAWING' ? 'Type your guess...' : 'Chat...'}
              value={input}
              onChange={e => setInput(e.target.value)}
              disabled={!canGuess && phase !== 'WAITING'}
              autoComplete="off"
            />
            <button
              type="submit"
              className="btn btn-primary btn-sm"
              disabled={!input.trim()}
            >
              ↗
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
