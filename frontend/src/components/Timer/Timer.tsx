import './Timer.css';

interface TimerProps {
  timeLeft: number;
  totalTime: number;
  phase: string;
}

export default function Timer({ timeLeft, totalTime, phase }: TimerProps) {
  if (phase !== 'DRAWING') return null;

  const pct = totalTime > 0 ? (timeLeft / totalTime) * 100 : 0;
  const isUrgent = timeLeft <= 10;
  const isCritical = timeLeft <= 5;

  return (
    <div className={`timer-container ${isUrgent ? 'urgent' : ''} ${isCritical ? 'critical' : ''}`}>
      <div className="timer-value">{timeLeft}</div>
      <div className="timer-bar-track">
        <div
          className="timer-bar-fill"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
