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

1. Creates a blank `STATE.md` with `<!-- MODELS -->` markers (the git hook fills it later)
2. Creates a blank `AGENTS.md` (you fill with project conventions)
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
| Model | Relations |
|-------|-----------|
| User | Account?, Session?, Driver? |
| Post | Comment? |
| Tag | PostTag? |
```

## Templates (created by `init-state`)

`init-state` creates both files as clean skeletons — no opinionated sections, no language bias. You edit them to fit your project.

### STATE.md (before first sync)

```markdown
<!-- MODELS -->
<!-- /MODELS -->
```

The `<!-- MODELS -->` markers are the only structure. On the next commit that changes `prisma/schema.prisma`, the git hook auto-populates the table between them.

### AGENTS.md

```
(empty — created as blank file for you to fill)
```

## Why Both Files?

- `STATE.md` = mutable state (models, features, backlog, known issues)
- `AGENTS.md` = permanent rules (code style, conventions, file structure)

Separation of concerns. The agent sees both in context from the first message — no runtime searches needed.

## License

MIT
