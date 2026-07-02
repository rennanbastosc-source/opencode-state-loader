import { readFileSync, existsSync, cpSync, mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tool } from '@opencode-ai/plugin/tool'
import { syncSchema, createStateTemplate, createAgentTemplate, setupGitHook } from './sync-schema.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export const StateLoader = async ({ directory }) => {
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      if (!output || !Array.isArray(output.system)) return
      if (!directory) return

      const statePath = join(directory, 'STATE.md')
      if (existsSync(statePath)) {
        output.system.push(readFileSync(statePath, 'utf8'))
      }

      const agentsPath = join(directory, 'AGENTS.md')
      if (existsSync(agentsPath)) {
        output.system.push(readFileSync(agentsPath, 'utf8'))
      }
    },

    tool: {
      'init-state': tool({
        description: 'Initialize opencode-state-loader in the current workspace. Creates STATE.md and AGENTS.md (with Prisma schema extraction if detected), and sets up git pre-commit hook for auto-sync.',
        args: {},
        async execute(_args, ctx) {
          const { directory: dir } = ctx
          const statePath = join(dir, 'STATE.md')
          const agentsPath = join(dir, 'AGENTS.md')
          const schemaPath = join(dir, 'prisma', 'schema.prisma')
          const lines = []

          if (!existsSync(statePath)) {
            createStateTemplate(statePath)
            lines.push('STATE.md created (template with markers)')
          } else {
            lines.push('STATE.md already exists')
          }

          if (!existsSync(agentsPath)) {
            createAgentTemplate(agentsPath)
            lines.push('AGENTS.md created (template)')
          } else {
            lines.push('AGENTS.md already exists')
          }

          // Copy sync-schema.js to .opencode/ for git hook to use
          const dotOpencode = join(dir, '.opencode')
          if (!existsSync(dotOpencode)) {
            mkdirSync(dotOpencode, { recursive: true })
          }
          const targetSync = join(dotOpencode, 'sync-schema.js')
          cpSync(join(__dirname, 'sync-schema.js'), targetSync)
          lines.push('sync-schema.js copied to .opencode/')

          if (existsSync(schemaPath)) {
            const result = syncSchema(schemaPath, statePath)
            lines.push(`Prisma: ${result.message}`)

            if (existsSync(join(dir, '.git'))) {
              setupGitHook(dir)
              lines.push('Git pre-commit hook configured')
            } else {
              lines.push('Not a git repository — skip hook setup')
            }
          } else {
            lines.push('Prisma schema not detected — skip sync and hook')
          }

          return lines.join('\n')
        },
      }),
    },
  }
}

export default StateLoader
