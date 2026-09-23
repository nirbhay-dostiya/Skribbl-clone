import type { PlayerDto } from '../../types/game';
import './PlayerList.css';

interface PlayerListProps {
  players: PlayerDto[];
  currentPlayerId: string;
}

const AVATAR_COLORS = [
  'linear-gradient(135deg, #7c3aed, #5b21b6)',
  'linear-gradient(135deg, #f59e0b, #d97706)',
  'linear-gradient(135deg, #10b981, #059669)',
  'linear-gradient(135deg, #3b82f6, #1d4ed8)',
  'linear-gradient(135deg, #ef4444, #b91c1c)',
  'linear-gradient(135deg, #8b5cf6, #6d28d9)',
  'linear-gradient(135deg, #06b6d4, #0e7490)',
  'linear-gradient(135deg, #ec4899, #be185d)',
];

export default function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="player-list">
      <div className="player-list-header">🏆 Scoreboard</div>
      {players.map((player, idx) => (
        <div
          key={player.id}
          className={`pl-row ${player.id === currentPlayerId ? 'current-player' : ''} ${!player.isConnected ? 'disconnected' : ''}`}
        >
          <div className="pl-rank">#{idx + 1}</div>
          <div className="pl-avatar" style={{ background: AVATAR_COLORS[idx % AVATAR_COLORS.length] }}>
            {player.nickname[0]?.toUpperCase()}
            {player.isDrawing && <span className="drawing-indicator">✏️</span>}
          </div>
          <div className="pl-info">
            <div className="pl-name">
              {player.nickname}
              {player.id === currentPlayerId && <span className="you-tag"> (You)</span>}
              {player.isHost && <span className="host-crown">👑</span>}
            </div>
            <div className="pl-score">{player.score} pts</div>
          </div>
          <div className="pl-status">
            {player.hasGuessedCorrectly && <span title="Guessed correctly">✅</span>}
            {player.isDrawing && <span title="Drawing">🖌️</span>}
            {!player.isConnected && <span title="Disconnected">💤</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
