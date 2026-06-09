# SubKit Agent System

This project uses a Coordinator-Subagent pattern for complex workflows. The coordinator delegates tasks to specialized agents and ensures consistency.

## Agents

### `/coordinator.agent.md` (Lead)
- **Role**: Task orchestration and architecture review
- **Responsibilities**: Breakdown complex work, assign subtasks, verify outputs, maintain architectural consistency
- **user-invocable**: `false` (invoked by the system, not directly by users)

### `/researcher.agent.md`
- **Role**: Codebase exploration and API research
- **Invocable by user**: Yes (`subkit research: ...`)

### `/tester.agent.md`
- **Role**: Test creation and execution
- **Invocable by user**: Yes (`subkit test: ...`)

### `/documenter.agent.md`
- **Role**: Documentation generation and updates
- **Invocable by user**: Yes (`subkit doc: ...`)

## Handoff Rules

| Scenario | Target Specialist | User-Invocable |
|----------|------------------|----------------|
| Security/authentication changes | security-specialist | `false` |
| Database schema changes | migration-handler | `false` |
| UI component work | coder agent | `true` |
| Game engine logic | coder agent | `true` |
| GRF backend / WebSocket integration | backend-specialist | `true` |

## Project State

See `.github/ai-state.json` for persistent architectural decisions, conventions, and integration notes.
