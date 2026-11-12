#!/usr/bin/env node

import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : process.cwd()

const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'coverage',
  '.vercel',
  '.turbo',
  '.worktrees',
  'storybook-static',
  'out',
  'build',
])

const TEXT_EXTENSIONS = new Set([
  '.js',
  '.jsx',
  '.ts',
  '.tsx',
  '.mjs',
  '.cjs',
  '.json',
  '.jsonc',
  '.md',
  '.mdx',
  '.yml',
  '.yaml',
  '.sh',
  '.bat',
  '.ps1',
  '.html',
  '.css',
  '.scss',
  '.gitignore',
  '.npmrc',
  '.env',
  '.env.example',
])

const FONT_EXTENSIONS = new Set(['.woff', '.woff2', '.ttf', '.otf'])

const CONFIG_TRAILING_PAYLOAD_TARGETS = new Set([
  'postcss.config.js',
  'postcss.config.mjs',
  'tailwind.config.js',
  'eslint.config.mjs',
  'next.config.mjs',
])

const POLINRIDER_ARTIFACT_FILES = new Set([
  'temp_auto_push.bat',
])

const EXCLUDE_FILES = new Set(['scripts/scan-polinrider.mjs'])

const CONTENT_PATTERNS = [
  { id: 'rmcej-token', re: /rmcej%otb%/ },
  { id: 'global-bang', re: /global\s*\[\s*['"]!['"]\s*\]/ },
  { id: 'global-_V', re: /global\s*\[\s*['"]_V['"]\s*\]/ },
  { id: 'decoder-var', re: /_\$_1e42/ },
  { id: 'cot-token', re: /Cot%3t=shtP/ },
  { id: 'function-mdy', re: /function\s+MDy\b/ },
  { id: 'c2-260120', re: /260120\.vercel\.app/ },
  { id: 'c2-default-config', re: /default-configuration\.vercel\.app/ },
  { id: 'c2-vscode-bootstrap', re: /vscode-settings-bootstrap\.vercel\.app/ },
  { id: 'c2-vscode-config', re: /vscode-settings-config\.vercel\.app/ },
  { id: 'c2-vscode-bootstrapper', re: /vscode-bootstrapper\.vercel\.app/ },
  { id: 'c2-vscode-load-config', re: /vscode-load-config\.vercel\.app/ },
]

const GITIGNORE_ARTIFACTS = [
  'temp_auto_push.bat',
  'temp_interactive_push.bat',
  'branch_structure.json',
]

const MAX_TEXT_BYTES = 2 * 1024 * 1024

const findings = []

function rel(filePath) {
  return path.relative(ROOT, filePath) || '.'
}

function add(rule, filePath, detail) {
  findings.push({ rule, file: rel(filePath), detail })
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    if (entry.name.startsWith('.DS_Store')) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue
      files.push(...await walk(fullPath))
      continue
    }
    if (entry.isFile()) files.push(fullPath)
  }
  return files
}

function isFontFile(filePath) {
  return FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

function isScannableTextFile(filePath) {
  const ext = path.extname(filePath).toLowerCase()
  if (TEXT_EXTENSIONS.has(ext)) return true
  return path.basename(filePath) === '.gitignore'
}

function hasValidFontMagic(buffer) {
  if (buffer.length < 4) return false
  const signature = buffer.subarray(0, 4).toString('ascii')
  if (signature === 'wOF2' || signature === 'wOFF') return true
  if (signature === 'OTTO' || signature === 'true' || signature === 'typ1') return true
  return buffer[0] === 0 && buffer[1] === 1 && buffer[2] === 0 && buffer[3] === 0
}

function lineHasExportDefaultTrailingPayload(line) {
  const trimmed = line.trim()
  if (!trimmed.includes('export default')) return false
  const after = trimmed.slice(trimmed.indexOf('export default') + 'export default'.length).trim()
  if (/^config\s*;\s*\S/.test(after)) return true
  if (/^[\w.$/[\]-]+\s*;\s*\S/.test(after)) return true
  if (/^\{[\s\S]*\}\s*;\s*\S/.test(after)) return true
  if (/^\[[\s\S]*\]\s*;\s*\S/.test(after)) return true
  if (/^\([\s\S]*\)\s*;\s*\S/.test(after)) return true
  if (/^config\b/.test(after) && after !== 'config' && after !== 'config;') return true
  return false
}

function lineHasModuleExportsTrailingPayload(line) {
  const trimmed = line.trim()
  if (!trimmed.includes('module.exports')) return false
  const after = trimmed.slice(trimmed.indexOf('module.exports') + 'module.exports'.length).replace(/^\s*=\s*/, '')
  if (/^\{[\s\S]*\}\s*;\s*$/.test(after)) return false
  return /^\{[\s\S]*\}\s*;\s*\S/.test(after)
}

function scanTextContent(filePath, text) {
  if (EXCLUDE_FILES.has(rel(filePath))) return
  for (const pattern of CONTENT_PATTERNS) {
    if (pattern.re.test(text)) {
      add(`content:${pattern.id}`, filePath, `Matched ${pattern.id}`)
    }
  }
}

async function scanConfigTrailingPayload(filePath, text) {
  const basename = path.basename(filePath)
  if (!CONFIG_TRAILING_PAYLOAD_TARGETS.has(basename)) return

  for (const line of text.split(/\r?\n/)) {
    if (lineHasExportDefaultTrailingPayload(line)) {
      add('config-trailing-payload', filePath, `Obfuscated JS appended after export default in ${basename}`)
      break
    }
    if (lineHasModuleExportsTrailingPayload(line)) {
      add('config-trailing-payload', filePath, `Obfuscated JS appended after module.exports in ${basename}`)
      break
    }
  }

  if (/^postcss\.config\.(js|mjs)$/.test(basename) && /createRequire\s*\(/.test(text) && /global\s*\[\s*['"]!['"]\s*\]/.test(text)) {
    add('postcss-createRequire-payload', filePath, 'createRequire bootstrap combined with PolinRider globals')
  }
}

async function scanGitignore(filePath, text) {
  if (path.basename(filePath) !== '.gitignore') return
  for (const artifact of GITIGNORE_ARTIFACTS) {
    const lines = text.split(/\r?\n/).map((line) => line.trim())
    if (lines.includes(artifact)) {
      add('gitignore-artifact', filePath, `Tracks PolinRider artifact ${artifact}`)
    }
  }
}

async function scanVscodeTasks(filePath, text) {
  if (!filePath.endsWith(`${path.sep}.vscode${path.sep}tasks.json`)) return
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    add('vscode-tasks-invalid-json', filePath, 'Unable to parse tasks.json')
    return
  }
  const tasks = Array.isArray(parsed.tasks) ? parsed.tasks : []
  for (const task of tasks) {
    const blob = JSON.stringify(task)
    const runsOnOpen = task.runOptions?.runOn === 'folderOpen'
    const executesFont = /fa-solid-400\.(woff2?|ttf|otf)|public\/fonts\/.*\.(woff2?|ttf|otf)/.test(blob)
    const executesNode = /\bnode\b/.test(blob) && /\.(woff2?|ttf|otf)\b/.test(blob)
    if (runsOnOpen && (executesFont || executesNode)) {
      add('vscode-folder-open-font-exec', filePath, `Task "${task.label ?? 'unknown'}" executes a font file on folder open`)
    }
  }
}

function scanVscodeSettings(filePath, text) {
  if (!filePath.endsWith(`${path.sep}.vscode${path.sep}settings.json`)) return
  if (/"task\.allowAutomaticTasks"\s*:\s*true/.test(text)) {
    add('vscode-auto-tasks-enabled', filePath, 'Workspace enables automatic task execution')
  }
}

async function scanFontFile(filePath, buffer) {
  const text = buffer.toString('latin1')
  if (/global\s*\[\s*['"]!['"]\s*\]/.test(text) || /rmcej%otb%/.test(text)) {
    add('font-js-payload', filePath, 'Font file contains JavaScript payload markers')
    return
  }
  if (!hasValidFontMagic(buffer)) {
    add('font-invalid-magic', filePath, 'Font file missing valid wOFF/wOF2/TTF/OTF signature')
  }
}

async function scanFile(filePath) {
  const info = await stat(filePath)
  if (info.size === 0) return

  const basename = path.basename(filePath)
  if (POLINRIDER_ARTIFACT_FILES.has(basename)) {
    add('polinrider-artifact-file', filePath, 'PolinRider git automation batch file present')
  }

  if (isFontFile(filePath)) {
    const buffer = await readFile(filePath)
    await scanFontFile(filePath, buffer)
    return
  }

  if (!isScannableTextFile(filePath)) return
  if (info.size > MAX_TEXT_BYTES) return

  const text = await readFile(filePath, 'utf8')
  scanTextContent(filePath, text)
  await scanConfigTrailingPayload(filePath, text)
  await scanGitignore(filePath, text)
  await scanVscodeTasks(filePath, text)
  scanVscodeSettings(filePath, text)
}

async function main() {
  const files = await walk(ROOT)
  await Promise.all(files.map((filePath) => scanFile(filePath)))

  if (findings.length === 0) {
    console.log(`PolinRider scan passed (${files.length} files checked under ${ROOT})`)
    process.exit(0)
  }

  console.error(`PolinRider scan failed with ${findings.length} finding(s):`)
  for (const finding of findings) {
    console.error(`- [${finding.rule}] ${finding.file}: ${finding.detail}`)
  }
  process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(2)
})
