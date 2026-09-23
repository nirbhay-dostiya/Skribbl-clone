import './WordHint.css';

interface WordHintProps {
  hint: string | null;
  wordLength: number | null;
  isDrawing: boolean;
  currentWord?: string; // Only for the drawer
  phase: string;
  drawerName: string | null;
}

export default function WordHint({ hint, wordLength, isDrawing, currentWord, phase, drawerName }: WordHintProps) {
  if (phase === 'WAITING') return null;

  if (phase === 'WORD_SELECTION') {
    return (
      <div className="word-hint-bar">
        <div className="hint-status">
          {isDrawing ? '🤔 Choose a word to draw...' : `⏳ ${drawerName} is choosing a word...`}
        </div>
      </div>
    );
  }

  if (phase === 'ROUND_END' || phase === 'GAME_END') {
    return (
      <div className="word-hint-bar">
        <div className="hint-status">
          {phase === 'GAME_END' ? '🎮 Game Over!' : '⏳ Next turn starting soon...'}
        </div>
      </div>
    );
  }

  // DRAWING phase
  const displayWord = isDrawing && currentWord ? currentWord : hint;
  const displayLength = wordLength ?? (hint ? hint.replace(/ /g, '').length : 0);

  return (
    <div className="word-hint-bar">
      {isDrawing ? (
        <div className="drawing-word">
          <span className="drawing-label">Draw this: </span>
          <span className="secret-word">{currentWord}</span>
        </div>
      ) : (
        <div className="hint-display">
          <span className="hint-label">{displayLength} letters: </span>
          <div className="hint-letters">
            {displayWord?.split('').map((char, idx) => (
              <span
                key={idx}
                className={`hint-char ${char !== '_' ? 'revealed' : ''} ${char === ' ' ? 'space' : ''}`}
              >
                {char === ' ' ? '\u00A0\u00A0' : char}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
