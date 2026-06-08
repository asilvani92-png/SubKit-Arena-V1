import { useState } from 'react';

const COLS = 10;
const ROWS = 14;

function cellKey(r, c) { return `${r},${c}`; }

function getValidMoves(pos, playerPositions, opponentPositions, hasAction) {
  if (!pos) return new Set();
  const moves = new Set();
  const allOccupied = new Set([
    ...playerPositions.filter(p => p.pos !== pos.key).map(p => p.pos),
    ...opponentPositions.map(p => p.pos),
  ]);
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const nr = pos.row + dr;
      const nc = pos.col + dc;
      if (nr >= 0 && nr < ROWS && nc >= 0 && nc < COLS) {
        const key = cellKey(nr, nc);
        if (!allOccupied.has(key)) moves.add(key);
      }
    }
  }
  return moves;
}

function PlayerToken({ isHome, player, selected, onSelect }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full h-full rounded-full flex items-center justify-center text-[7px] font-heading font-bold transition-all border-2 ${
        selected
          ? 'border-gold scale-110 shadow-[0_0_8px_hsl(43_68%_52%/0.8)]'
          : isHome
            ? 'border-blue-400 bg-blue-900/80 text-blue-200 hover:border-blue-300'
            : 'border-red-400 bg-red-900/80 text-red-200 hover:border-red-300'
      }`}
    >
      {player?.name?.[0] || '?'}
    </button>
  );
}

function BallToken({ ballPos, row, col }) {
  if (!ballPos || ballPos.row !== row || ballPos.col !== col) return null;
  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="w-2 h-2 rounded-full bg-white border border-gray-400 shadow" />
    </div>
  );
}

export default function PitchGrid({
  homePlayers = [],
  awayPlayers = [],
  ballPosition,
  isMyTurn,
  isHome,
  selectedPlayer,
  onSelectPlayer,
  onMovePlayer,
  onAction,
}) {
  const [hoveredCell, setHoveredCell] = useState(null);

  const myPlayers = isHome ? homePlayers : awayPlayers;
  const oppPlayers = isHome ? awayPlayers : homePlayers;

  const validMoves = getValidMoves(selectedPlayer, myPlayers, oppPlayers);

  const getPlayerAt = (row, col) => {
    const key = cellKey(row, col);
    const home = homePlayers.find(p => p.pos === key);
    if (home) return { player: home, isHome: true };
    const away = awayPlayers.find(p => p.pos === key);
    if (away) return { player: away, isHome: false };
    return null;
  };

  const handleCellClick = (row, col) => {
    if (!isMyTurn) return;
    const key = cellKey(row, col);
    const playerHere = getPlayerAt(row, col);

    if (playerHere) {
      const mine = isHome ? playerHere.isHome : !playerHere.isHome;
      if (mine) {
        onSelectPlayer({ ...playerHere.player, row, col, key });
        return;
      }
      // Opponent player — clash if adjacent to selected
      if (selectedPlayer && validMoves.has(key) && onAction) {
        onAction('tackle', { target: playerHere.player });
        return;
      }
    }

    if (selectedPlayer && validMoves.has(key)) {
      onMovePlayer(key);
    }
  };

  return (
    <div className="w-full select-none">
      {/* Pitch */}
      <div
        className="relative border-2 border-white/20 rounded-lg overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${COLS}, 1fr)`,
          gridTemplateRows: `repeat(${ROWS}, 1fr)`,
          aspectRatio: `${COLS}/${ROWS}`,
          backgroundColor: 'hsl(138 45% 12%)',
          backgroundImage: 'repeating-linear-gradient(0deg, hsl(138 45% 14% / 0.6), hsl(138 45% 14% / 0.6) 1px, transparent 1px, transparent calc(100%/14))',
        }}
      >
        {/* Pitch markings */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox={`0 0 ${COLS * 10} ${ROWS * 10}`}
          preserveAspectRatio="none"
        >
          {/* Centre circle */}
          <circle cx={COLS * 5} cy={ROWS * 5} r={15} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
          {/* Centre line */}
          <line x1={0} y1={ROWS * 5} x2={COLS * 10} y2={ROWS * 5} stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
          {/* Goal areas */}
          <rect x={COLS * 3} y={0} width={COLS * 4} height={ROWS * 1.2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
          <rect x={COLS * 3} y={ROWS * 10 - ROWS * 1.2} width={COLS * 4} height={ROWS * 1.2} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
          {/* Goals */}
          <rect x={COLS * 3.8} y={0} width={COLS * 2.4} height={3} fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="0.5" />
          <rect x={COLS * 3.8} y={ROWS * 10 - 3} width={COLS * 2.4} height={3} fill="rgba(255,255,255,0.1)" stroke="white" strokeWidth="0.5" />
        </svg>

        {Array.from({ length: ROWS }, (_, row) =>
          Array.from({ length: COLS }, (_, col) => {
            const key = cellKey(row, col);
            const here = getPlayerAt(row, col);
            const isValid = validMoves.has(key);
            const isSelected = selectedPlayer?.key === key;

            return (
              <div
                key={key}
                className={`pitch-cell relative flex items-center justify-center ${isValid ? 'valid-move' : ''} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCellClick(row, col)}
                onMouseEnter={() => setHoveredCell(key)}
                onMouseLeave={() => setHoveredCell(null)}
              >
                {here && (
                  <PlayerToken
                    isHome={here.isHome}
                    player={here.player}
                    selected={isSelected}
                    onSelect={() => handleCellClick(row, col)}
                  />
                )}
                <BallToken ballPos={ballPosition} row={row} col={col} />
              </div>
            );
          })
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 mt-2 text-[10px] text-muted-foreground font-heading">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-blue-400 bg-blue-900/60" />
          <span>HOME</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full border-2 border-red-400 bg-red-900/60" />
          <span>AWAY</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-white border border-gray-400" />
          <span>BALL</span>
        </div>
      </div>
    </div>
  );
}