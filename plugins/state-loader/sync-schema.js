import { readFileSync, writeFileSync, existsSync, chmodSync } from 'node:fs'
import { join } from 'node:path'

const hideFromTable = new Set(['Account', 'Session', 'VerificationToken'])
const scalarTypes = new Set(['String', 'Int', 'Float', 'Boolean', 'DateTime', 'Json'])

export function syncSchema(schemaPath, statePath) {
  if (!existsSync(schemaPath)) {
    return { models: 0, message: 'schema.prisma not found' }
  }
  if (!existsSync(statePath)) {
    return { models: 0, message: 'STATE.md not found' }
  }

  const schema = readFileSync(schemaPath, 'utf8')
  const state = readFileSync(statePath, 'utf8')

  const modelRegex = /^model\s+(\w+)\s*\{([^}]+)\}/gm
  const allModelNames = []
  const outgoingRelations = []

  let match
  while ((match = modelRegex.exec(schema)) !== null) {
    const name = match[1]
    const body = match[2]
    allModelNames.push(name)

    for (const line of body.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed.includes('@relation')) continue

      const fieldMatch = trimmed.match(/^(\w+)\s+(\w[\w\[\]?]*)/)
      if (!fieldMatch) continue

      let type = fieldMatch[2].replace('[]', '').replace('?', '')
      if (scalarTypes.has(type)) continue

      const isArray = fieldMatch[2].includes('[]')
      outgoingRelations.push({ from: name, to: type, isArray })
    }
  }

  const relationMap = new Map()
  for (const { from, to, isArray } of outgoingRelations) {
    if (!relationMap.has(from)) relationMap.set(from, new Set())
    relationMap.get(from).add(isArray ? `${to}[]` : `${to}?`)

    if (!relationMap.has(to)) relationMap.set(to, new Set())
    relationMap.get(to).add(isArray ? `${from}[]` : `${from}?`)
  }

  const businessModels = allModelNames.filter(n => !hideFromTable.has(n))
  const header = '| Model | Relations |'
  const separator = '|-------|-----------|'
  const rows = businessModels.map(name => {
    const rels = relationMap.get(name)
    const relStr = rels && rels.size > 0 ? [...rels].join(', ') : '—'
    return `| \`${name}\` | ${relStr} |`
  })

  const table = [header, separator, ...rows].join('\n')

  const markerStart = '<!-- MODELS -->'
  const markerEnd = '<!-- /MODELS -->'
  const startIdx = state.indexOf(markerStart)
  const endIdx = state.indexOf(markerEnd)

  if (startIdx === -1 || endIdx === -1) {
    return { models: businessModels.length || 0, message: 'markers <!-- MODELS --> not found. Add them to STATE.md.' }
  }

  const before = state.slice(0, startIdx + markerStart.length)
  const after = state.slice(endIdx)
  const newState = `${before}\n${table}\n${after}`
  writeFileSync(statePath, newState, 'utf8')

  return { models: businessModels.length, message: `${businessModels.length} models synced with bidirectional relations` }
}

export function setupGitHook(directory) {
  const hookPath = join(directory, '.git', 'hooks', 'pre-commit')

  const hookContent = `#!/bin/sh
# Auto-sync STATE.md models when schema.prisma changes (opencode-state-loader)
if git diff --cached --name-only | grep -q 'prisma/schema\\.prisma'; then
  echo "schema.prisma changed - syncing models to STATE.md..."
  node --input-type=module -e "
import { syncSchema } from './.opencode/sync-schema.js'
const r = syncSchema('prisma/schema.prisma', 'STATE.md')
console.log(r.message)
"
  git add STATE.md
fi
`
  writeFileSync(hookPath, hookContent, 'utf8')
  chmodSync(hookPath, 0o775)
  return hookPath
}

export function createStateTemplate(statePath) {
  const content = `<!-- MODELS -->
| Model | Relations |
|-------|-----------|
| \`Example\` | — |
<!-- /MODELS -->
`
  writeFileSync(statePath, content, 'utf8')
}

export function createAgentTemplate(agentsPath) {
  const content = `# Conventions

## Stack

## Code Conventions

## File Structure

| File | Purpose |
|------|---------|
`
  writeFileSync(agentsPath, content, 'utf8')
}

// CLI
if (process.argv[1] && process.argv[1].endsWith('sync-schema.js')) {
  const cwd = process.cwd()
  const schemaPath = join(cwd, 'prisma', 'schema.prisma')
  const statePath = join(cwd, 'STATE.md')
  const result = syncSchema(schemaPath, statePath)
  console.log(result.message)
}
