/**
 * useGRFEngine.js
 * ───────────────
 * React hook that replaces the old custom game engine.
 *
 * Instead of running physics in the browser, this hook:
 *   1. Opens a WebSocket to the GRF backend (server.py)
 *   2. Sends the match config on connect
 *   3. Exposes step(), managerAction(), freePrompt() to your components
 *   4. Returns live game state that your pitch renderer can consume
 *
 * Usage:
 *   const {
 *     state,          // MatchRules.state_snapshot() — score, AP, zones, etc.
 *     obs,            // Raw GRF observation array (use for dot positions)
 *     commentary,     // string[] of latest commentary lines
 *     lastEvent,      // { type, ... } last significant event
 *     connected,
 *     step,           // (action: int) => void
 *     managerAction,  // (action: string, sub?: object) => void
 *     freePrompt,     // (prompt: string, choice: string) => void
 *     disconnect,
 *   } = useGRFEngine(matchConfig, wsUrl);
 */

import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_WS_URL = import.meta.env.VITE_GRF_WS_URL || 'ws://localhost:8765/env';

/**
 * @param {object} matchConfig
 * @param {string} matchConfig.scenario        GRF scenario name
 * @param {string} matchConfig.representation  'raw' | 'simple115v2'
 * @param {object} matchConfig.home_team       { name, ref, baseRating, year }
 * @param {object} matchConfig.away_team
 * @param {string} matchConfig.match_type      'friendly' | 'ranked' | 'cup' | 'league'
 * @param {string} matchConfig.formation       '4-4-2' etc.
 * @param {string} matchConfig.tactic          'balanced' etc.
 * @param {string} [wsUrl]
 */
export function useGRFEngine(matchConfig, wsUrl = DEFAULT_WS_URL) {
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const [connected, setConnected]   = useState(false);
  const [ready, setReady]           = useState(false);
  const [obs, setObs]               = useState(null);
  const [state, setState]           = useState(null);
  const [commentary, setCommentary] = useState([]);
  const [lastEvent, setLastEvent]   = useState(null);
  const [matchOver, setMatchOver]   = useState(null);
  const [error, setError]           = useState(null);

  // ── Commentary ring buffer (keep last 20 lines) ───────────────────────────
  const pushCommentary = useCallback((lines) => {
    if (!lines?.length) return;
    setCommentary(prev => [...prev, ...lines].slice(-20));
  }, []);

  // ── Open WebSocket ─────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    const socket = new WebSocket(wsUrl);
    ws.current = socket;

    socket.onopen = () => {
      setConnected(true);
      setError(null);
      // Send match config as the handshake message
      socket.send(JSON.stringify({
        scenario:       matchConfig.scenario       ?? '11_vs_11_stochastic',
        representation: matchConfig.representation ?? 'raw',
        home_team:      matchConfig.home_team      ?? {},
        away_team:      matchConfig.away_team      ?? {},
        match_type:     matchConfig.match_type     ?? 'friendly',
        formation:      matchConfig.formation      ?? '4-4-2',
        tactic:         matchConfig.tactic         ?? 'balanced',
      }));
    };

    socket.onmessage = (ev) => {
      let msg;
      try { msg = JSON.parse(ev.data); }
      catch { return; }

      switch (msg.type) {
        case 'ready':
          setReady(true);
          if (msg.obs)   setObs(msg.obs);
          if (msg.state) setState(msg.state);
          break;

        case 'obs':
          if (msg.obs)   setObs(msg.obs);
          if (msg.state) setState(msg.state);
          if (msg.event) setLastEvent(msg.event);
          pushCommentary(msg.commentary);
          break;

        case 'manager_result':
          if (msg.state) setState(msg.state);
          break;

        case 'prompt_result':
          if (msg.state) setState(msg.state);
          break;

        case 'match_over':
          setMatchOver(msg);
          break;

        case 'error':
          setError(msg.message);
          break;

        case 'pong':
          break;

        default:
          break;
      }
    };

    socket.onerror = () => {
      setError('WebSocket error — is the GRF backend running?');
      setConnected(false);
    };

    socket.onclose = () => {
      setConnected(false);
      setReady(false);
      // Auto-reconnect after 3 s
      reconnectTimer.current = setTimeout(connect, 3000);
    };
  }, [wsUrl, matchConfig, pushCommentary]);

  useEffect(() => {
    connect();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, [connect]);

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Send one GRF action (player-level, 0-18).
   * Call this from your game loop / AI tick.
   */
  const step = useCallback((action = 0) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'step', action }));
  }, []);

  /**
   * Spend AP on a manager action.
   * @param {string} action  e.g. 'DEMAND_SHOT'
   * @param {object} [sub]   extra data (shout type, sub indices, etc.)
   */
  const managerAction = useCallback((action, sub = {}) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'manager_action', action, sub }));
  }, []);

  /**
   * Respond to a free dead-ball prompt (no AP cost).
   * @param {string} prompt  e.g. 'corner'
   * @param {string} choice  e.g. 'near_post'
   */
  const freePrompt = useCallback((prompt, choice) => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'free_prompt', prompt, choice }));
  }, []);

  const disconnect = useCallback(() => {
    clearTimeout(reconnectTimer.current);
    ws.current?.close();
  }, []);

  const ping = useCallback(() => {
    if (ws.current?.readyState !== WebSocket.OPEN) return;
    ws.current.send(JSON.stringify({ type: 'ping' }));
  }, []);

  return {
    // State
    connected,
    ready,
    obs,       // raw GRF observation — feed to your pitch renderer
    state,     // MatchRules snapshot — score, AP, zones, formation, etc.
    commentary,
    lastEvent,
    matchOver,
    error,
    // Actions
    step,
    managerAction,
    freePrompt,
    disconnect,
    ping,
  };
}
