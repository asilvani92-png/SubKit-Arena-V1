# SubKit Agent System

This project uses a Coordinator-Subagent pattern for complex workflows. The coordinator delegates tasks to specialized agents and ensures consistency.

## Agents

### `/coordinator.agent.md` (Lead)
- **Role**: Task orchestration and code review
- **Responsibilities**: Breakdown complex work, assign subtasks, verify outputs, maintain architectural consistency

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

- Security/authentication changes → security specialist (via handoff)
- Database schema changes → migration handler (via handoff)
- UI component work → coder agent
- Game engine logic → coder agent

## Project State

See `.github/ai-state.json` for persistent architectural decisions and conventions.