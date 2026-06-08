export default class GameEngine {
  constructor(matchState = {}){
    this.matchState = matchState;
    this.engineVersion = '0.0.1-stub';
  }

  init(state){
    this.matchState = state || this.matchState;
    return { success:true, engineVersion:this.engineVersion };
  }

  // Resolve an action and return a deterministic stubbed result
  resolveAction(action){
    // action: { player_id, action_type, target_position, power }
    const turn = (this.matchState.current_turn || 0) + 1;
    const result = {
      success: true,
      result: {
        new_board_state: this._applyMove(action),
        goals_scored: { home: 0, away: 0 },
        player_stat_clash: null,
        action_log_entry: {
          turn,
          player_id: action.player_id,
          action: action.action_type,
          from: action.from || { x: 0, y: 0 },
          to: action.target_position || { x: 0, y: 0 },
          result: 'success',
          timestamp: new Date().toISOString()
        },
        valid_next_moves: []
      }
    };

    this.matchState.current_turn = turn;
    // append to action_log if present
    this.matchState.action_log = this.matchState.action_log || [];
    this.matchState.action_log.push(result.result.action_log_entry);

    return result;
  }

  _applyMove(action){
    // Naive board state updater: move player to target
    const bs = JSON.parse(JSON.stringify(this.matchState.board_state || {}));
    const pid = action.player_id;
    if(!bs.positions) bs.positions = {};
    bs.positions[pid] = { x: action.target_position?.x || 0, y: action.target_position?.y || 0 };
    return bs;
  }

  // Replay a single action against a state (used by replay viewer)
  static replayAction(state, action){
    const engine = new GameEngine(state);
    return engine.resolveAction(action).result.new_board_state;
  }
}
