import React, { useEffect, useState } from 'react';
import GameEngine from '../../packages/game-engine/dist/index.js';

const GameArena = ({ matchId }) => {
  const [engineInfo, setEngineInfo] = useState(null);
  const [matchState, setMatchState] = useState({ board_state: {}, current_turn: 0 });

  useEffect(() => {
    const engine = new GameEngine(matchState);
    const info = engine.init(matchState);
    setEngineInfo(info);
    // store engine on window for debug
    window.__GameEngine__ = engine;
  }, []);

  const handleStubAction = () => {
    const engine = window.__GameEngine__;
    if(!engine) return;
    const action = { player_id: 'p1', action_type: 'move', target_position: { x: Math.floor(Math.random()*10), y: Math.floor(Math.random()*14) } };
    const res = engine.resolveAction(action);
    setMatchState(engine.matchState);
    alert(`Action resolved. Turn ${engine.matchState.current_turn}`);
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-heading mb-4">Game Arena (stub)</h2>
      <p className="mb-4">Engine: {engineInfo?.engineVersion || 'loading...'}</p>
      <div className="mb-4">
        <button onClick={handleStubAction} className="btn">Run stub action</button>
      </div>
      <pre className="text-sm bg-muted p-3 rounded">{JSON.stringify(matchState, null, 2)}</pre>
    </div>
  );
};

export default GameArena;
