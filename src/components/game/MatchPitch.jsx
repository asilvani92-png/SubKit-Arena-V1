// MatchPitch — 12-zone football pitch with coloured dots, ball, and smooth animation
import { useRef, useEffect, useCallback } from 'react';

const ZONES = ['DEF_L','DEF_C','DEF_R','MID_L','MID_C','MID_R','ATT_L','ATT_C','ATT_R','BOX_L','BOX_C','BOX_R'];
const ROWS = 4;
const COLS = 3;

// Zone position centres (as percentage of pitch dimensions)
function getZonePosition(zone) {
  const row = Math.floor(ZONES.indexOf(zone) / 3);
  const col = ZONES.indexOf(zone) % 3;
  return {
    x: (col + 0.5) / COLS * 100,
    y: (row + 0.5) / ROWS * 100,
  };
}

function interpolatePos(from, to, t) {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

export default function MatchPitch({ homeTeam, awayTeam, events, currentMinute, grfObs, useGRF }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  const lastEventRef = useRef(null);
  const ballAnimRef = useRef(null);

  // Positions derived from GRF observations when available
  const getCurrentPositions = useCallback(() => {
    const positions = { home: {}, away: {}, ball: { x: 50, y: 50 } };
    
    if (useGRF && grfObs) {
      // Render from GRF raw coordinates
      const W = 100;
      const H = 100;
      
      // Ball
      const bx = ((grfObs.ball.x + 1) / 2) * 100;
      const by = ((grfObs.ball.y + 0.42) / 0.84) * 100;
      positions.ball = { x: bx, y: by };
      
      // Home players (left team in GRF, rendered as home)
      (grfObs.home || []).forEach((p, i) => {
        if (i >= 11) return;
        const px = ((p.x + 1) / 2) * 100;
        const py = ((p.y + 0.42) / 0.84) * 100;
        positions.home[`player_${i}`] = {
          x: px,
          y: py,
          colour: homeTeam?.primary_colour || '#3b82f6',
          isGK: i === 0,
          name: `Player ${i + 1}`,
          active: p.active,
          tiredFactor: p.tiredFactor,
        };
      });
      
      // Away players (right team in GRF, rendered as away)
      (grfObs.away || []).forEach((p, i) => {
        if (i >= 11) return;
        const px = ((p.x + 1) / 2) * 100;
        const py = ((p.y + 0.42) / 0.84) * 100;
        positions.away[`player_${i}`] = {
          x: px,
          y: py,
          colour: awayTeam?.primary_colour || '#ef4444',
          secondary: awayTeam?.secondary_colour || '#b91c1c',
          isGK: i === 0,
          name: `Player ${i + 1}`,
          active: p.active,
          tiredFactor: p.tiredFactor,
        };
      });
      
      return positions;
    }

    // Fallback to JS engine positioning
    if (!homeTeam || !awayTeam) return positions;

    const formHome = homeTeam.formation || '4-4-2';
    const formAway = awayTeam.formation || '4-4-2';
    const FORMATION_POSITIONS = {
      '4-4-2': ['GK','LB','CB','CB','RB','LM','CM','CM','RM','ST','ST'],
      '4-3-3': ['GK','LB','CB','CB','RB','CM','CM','CM','LW','ST','RW'],
    };
    const posHome = FORMATION_POSITIONS[formHome] || FORMATION_POSITIONS['4-4-2'];
    const posAway = FORMATION_POSITIONS[formAway] || FORMATION_POSITIONS['4-4-2'];

    const POSITION_ZONE = {
      GK:'DEF_C', LB:'DEF_L', CB:'DEF_C', RB:'DEF_R', LM:'MID_L', CM:'MID_C', RM:'MID_R',
      LW:'ATT_L', RW:'ATT_R', ST:'ATT_C', CDM:'MID_C', CAM:'MID_C', LWB:'DEF_L', RWB:'DEF_R',
    };

    const lastEvent = lastEventRef.current;
    let ballZone = 'MID_C';
    if (lastEvent && lastEvent.zone) ballZone = lastEvent.zone;

    // Position home players
    (homeTeam.players || []).forEach((p, i) => {
      if (i >= 11) return;
      const zone = POSITION_ZONE[posHome[i]] || 'MID_C';
      const pos = getZonePosition(zone);
      positions.home[p.player_name || `P${i}`] = {
        x: pos.x + (Math.random() - 0.5) * 10,
        y: pos.y + (Math.random() - 0.5) * 10,
        colour: homeTeam.primary_colour || '#3b82f6',
        isGK: posHome[i] === 'GK',
        name: p.player_name || `P${i}`,
      };
    });

    // Position away players (mirrored)
    (awayTeam.players || []).forEach((p, i) => {
      if (i >= 11) return;
      const zone = POSITION_ZONE[posAway[i]] || 'MID_C';
      const pos = getZonePosition(zone);
      positions.away[p.player_name || `P${i}`] = {
        x: 100 - pos.x + (Math.random() - 0.5) * 10,
        y: 100 - pos.y + (Math.random() - 0.5) * 10,
        colour: awayTeam.primary_colour || '#ef4444',
        secondary: awayTeam.secondary_colour || '#b91c1c',
        isGK: posAway[i] === 'GK',
        name: p.player_name || `P${i}`,
      };
    });

    // Ball position
    const ballPos = getZonePosition(ballZone);
    positions.ball = { x: ballPos.x + (Math.random() - 0.5) * 5, y: ballPos.y + (Math.random() - 0.5) * 5 };

    return positions;
  }, [homeTeam, awayTeam, grfObs, useGRF]);

  // Draw function
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Draw pitch
    const pitchColor = '#2d5a27';
    ctx.fillStyle = pitchColor;
    ctx.fillRect(0, 0, w, h);

    // Grass stripes
    for (let i = 0; i < 8; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
      ctx.fillRect(0, (i / 8) * h, w, h / 8);
    }

    // Pitch markings
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;

    // Centre line
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    // Centre circle
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.12, 0, Math.PI * 2);
    ctx.stroke();

    // Centre spot
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Goal areas
    ctx.strokeRect(w * 0.15, 0, w * 0.7, h * 0.12);
    ctx.strokeRect(w * 0.15, h * 0.88, w * 0.7, h * 0.12);

    // Goals
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.strokeRect(w * 0.3, 0, w * 0.4, h * 0.03);
    ctx.strokeRect(w * 0.3, h * 0.97, w * 0.4, h * 0.03);
    ctx.fillRect(w * 0.3, 0, w * 0.4, h * 0.03);
    ctx.fillRect(w * 0.3, h * 0.97, w * 0.4, h * 0.03);

    // Zone grid lines (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i < COLS; i++) {
      ctx.beginPath();
      ctx.moveTo((i / COLS) * w, 0);
      ctx.lineTo((i / COLS) * w, h);
      ctx.stroke();
    }
    for (let i = 1; i < ROWS; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (i / ROWS) * h);
      ctx.lineTo(w, (i / ROWS) * h);
      ctx.stroke();
    }

    // Get positions
    const positions = getCurrentPositions();

    // Helper to draw a player dot
    function drawDot(x, y, colour, radius, isGK, isBallCarrier, active = true) {
      if (!active) {
        ctx.globalAlpha = 0.3;
      }
      
      // Shadow
      ctx.beginPath();
      ctx.arc(x, y + 1.5, radius + 1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fill();

      // Body
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = colour;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // GK: different colour ring
      if (isGK) {
        ctx.beginPath();
        ctx.arc(x, y, radius + 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#facc15';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Ball carrier pulse
      if (isBallCarrier) {
        const pulse = Math.sin(Date.now() / 200) * 2 + 4;
        ctx.beginPath();
        ctx.arc(x, y, radius + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
      
      ctx.globalAlpha = 1;
    }

    // Draw away players first (behind)
    Object.values(positions.away).forEach((p, idx) => {
      if (p.name === undefined) return;
      const x = p.x / 100 * w;
      const y = p.y / 100 * h;
      drawDot(x, y, p.secondary || p.colour, 7, p.isGK, false, p.active !== false);
      
      // Show fatigue indicator
      if (p.tiredFactor && p.tiredFactor > 0.5) {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y - 12, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw home players
    Object.values(positions.home).forEach((p, idx) => {
      if (p.name === undefined) return;
      const x = p.x / 100 * w;
      const y = p.y / 100 * h;
      drawDot(x, y, p.colour, 7, p.isGK, false, p.active !== false);
      
      // Show fatigue indicator
      if (p.tiredFactor && p.tiredFactor > 0.5) {
        ctx.fillStyle = 'rgba(255, 100, 100, 0.5)';
        ctx.beginPath();
        ctx.arc(x, y - 12, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw ball
    const ball = positions.ball;
    drawDot(ball.x / 100 * w, ball.y / 100 * h, '#ffffff', 5, false, true, true);
    
    // Draw ball direction indicator if GRF obs
    if (useGRF && grfObs?.ballDirection) {
      const bdx = grfObs.ballDirection.x;
      const bdy = grfObs.ballDirection.y;
      if (Math.abs(bdx) > 0.01 || Math.abs(bdy) > 0.01) {
        ctx.beginPath();
        ctx.moveTo(ball.x / 100 * w, ball.y / 100 * h);
        ctx.lineTo(
          ball.x / 100 * w + bdx * 30,
          ball.y / 100 * h + bdy * 30
        );
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }, [getCurrentPositions, grfObs, useGRF]);

  // Animation loop
  useEffect(() => {
    const animate = () => {
      draw();
      animRef.current = requestAnimationFrame(animate);
    };
    animRef.current = requestAnimationFrame(animate);
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [draw]);

  // Track last event for positioning
  useEffect(() => {
    if (events && events.length > 0) {
      lastEventRef.current = events[events.length - 1];
    }
  }, [events]);

  return (
    <div className="relative w-full" style={{ aspectRatio: '3/4', maxHeight: '100%' }}>
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded-lg"
        width={600}
        height={800}
      />
    </div>
  );
}
