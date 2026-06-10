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

## One CLI — Platform Integrations

The One CLI (`one`) is installed and configured on this machine. It gives AI agents the ability to interact with 400+ third-party platforms (Gmail, Slack, Shopify, HubSpot, Stripe, GitHub, Notion, Salesforce, etc.) through a single, unified interface.

**Whenever you need to interact with any third-party platform or external service, use the One CLI.** This is the primary tool for all integrations.

### IMPORTANT: Always use the --agent flag
The `--agent` flag gives structured JSON output. Always include it right after `one`:
  `one --agent <command>`

### IMPORTANT: Learn before you use
Before using any feature (actions, flows, relay), read the corresponding skill documentation first (`~/.agents/skills/one/SKILL.md`). Never guess — read the skill, then act.

### Quick reference
- `one --agent list` — See connected platforms and connection keys
- `one --agent actions search <platform> "<query>"` — Find actions
- `one --agent actions knowledge <platform> <actionId>` — Read docs (REQUIRED before execute)
- `one --agent actions execute <platform> <actionId> <connectionKey>` — Execute action
- `one add <platform>` — Connect a new platform (interactive, no --agent)

### Workflow: search → knowledge → execute
Always read the knowledge before executing. Confirm with the user before anything destructive.
