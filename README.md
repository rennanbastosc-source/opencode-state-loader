# opencode-state-loader

Inject `STATE.md` + `AGENTS.md` into opencode's system prompt at session start. Global plugin with self-implementing workspace setup.

Saves ~1200 tokens per session vs reading files on demand — models, key files, current state, and conventions are always in context.

## Installation

```bash
# Clone the repo
git clone https://github.com/your-org/opencode-state-loader ~/opencode-state-loader

# Symlink into global plugins directory
ln -s ~/opencode-state-loader/plugins/state-loader ~/.config/opencode/plugins/state-loader

# (Optional) Install deps for type-checking in editor
cd ~/.config/opencode && npm install
```

## Usage

Once installed globally, the plugin loads automatically in every opencode session.

### First-time setup in a workspace

Ask the agent (in any workspace):

```
inicialize o state-loader
```

The agent invokes the `init-state` tool, which:

1. Creates `STATE.md` (if missing) with a template + `<!-- MODELS -->` markers
2. Creates `AGENTS.md` (if missing) with a template
3. Copies `sync-schema.js` to `.opencode/sync-schema.js` for git hook access
4. Detects `prisma/schema.prisma` → extracts models bidirectionally into `STATE.md`
5. Sets up `.git/hooks/pre-commit` to auto-sync on schema changes

## How It Works

```
opencode session start
  └── global plugin activates
      └── experimental.chat.system.transform
          ├── reads STATE.md → appends to system prompt
          └── reads AGENTS.md → appends to system prompt
```

Both files are loaded once per session and stay in context. The agent sees models, key files, conventions, and current state without reading files at runtime.

## Tool: `init-state`

Registered by the plugin. Zero arguments — reads `ctx.directory` for the current workspace.

| Step | Condition | Action |
|------|-----------|--------|
| STATE.md | missing | Create with template + markers |
| AGENTS.md | missing | Create with template |
| sync-schema.js | always | Copy to `.opencode/` |
| prisma/schema.prisma | exists | Extract models, write into STATE.md |
| .git/ | exists | Create/update pre-commit hook |

## Prisma Schema Sync

If your project uses Prisma, the plugin extracts model names and their bidirectional relationships into a markdown table between `<!-- MODELS -->` and `<!-- /MODELS -->` markers in `STATE.md`.

The table is updated:
- On `init-state` (first setup)
- On every commit that changes `prisma/schema.prisma` (via git hook)

### Example output

```
| Modelo | Relações principais |
|--------|-------------------|
| User | Account?, Session?, Driver? |
| Vehicle | DriverVehicle?, Refueling?, Maintenance?, Occurrence?, PreventiveSchedule? |
| Driver | DriverVehicle?, Refueling?, User?, FuelTank?, Maintenance?, Occurrence? |
```

## File Templates

### STATE.md

```markdown
# Estado do Projeto

## 1. Visão Geral

- **Stack:** <!-- preencha -->

## 2. Modelos Prisma

<!-- MODELS -->
| Modelo | Relações principais |
|--------|-------------------|
<!-- /MODELS -->

## 3. Estado Atual

**Branch:** <!-- preencha -->

## 4. Backlog

- [ ] Backlog item
```

### AGENTS.md

```markdown
# Convenções do Projeto

Regras permanentes de desenvolvimento. Estado mutável → `STATE.md`.

## Stack

<!-- preencha -->

## Padrões de Código

<!-- adicione convenções -->

## Estrutura de Arquivos

| Arquivo | Função |
|---------|--------|
```

## Why Both Files?

- `STATE.md` = mutable state (branch, features, backlog, models)
- `AGENTS.md` = permanent rules (code style, UI patterns, conventions)

Separation of concerns. The agent doesn't need to search for project-specific conventions — they're in context from the first message.

## License

MIT
