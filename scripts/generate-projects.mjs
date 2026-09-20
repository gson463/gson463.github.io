#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { writeFileSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const overridesPath = join(root, 'projects-overrides.json')

const EXCLUDE = new Set(['gson463', 'gson463.github.io'])

const CATEGORY_RULES = [
  { cat: 'commerce', label: 'E-commerce', match: /simu|sj-ecommerce|^sj$/i },
  { cat: 'property', label: 'Property', match: /blb|nyumba|makazi|plot|viwanja|go-makazi/i },
  { cat: 'finance', label: 'Finance', match: /fcl|microfinance|mukwano|ibs/i },
  { cat: 'health', label: 'Healthcare', match: /pharm|pms|medical|Pharma/i },
  { cat: 'platform', label: 'Platform', match: /gosany|gosep|hostel|compliance|plusnology|taka/i },
  { cat: 'security', label: 'Security', match: /vogu|malware|rita|faragha|netcon/i },
  { cat: 'community', label: 'Community', match: /ajira|vilo|vuga|murari|cv/i },
]

const STACK_KEYWORDS = [
  'TanStack', 'Supabase', 'Vercel', 'Vite', 'Next.js', 'React', 'PocketBase',
  'Expo', 'Electron', 'Prisma', 'PostgreSQL', 'pnpm', 'GoSEP', 'PWA',
]

function loadOverrides() {
  try {
    return JSON.parse(readFileSync(overridesPath, 'utf8'))
  } catch {
    return { titles: {}, categories: {}, descriptions: {}, exclude: [] }
  }
}

function titleCase(name) {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function detectCategory(name, description) {
  const hay = `${name} ${description}`
  for (const rule of CATEGORY_RULES) {
    if (rule.match.test(hay)) return { cat: rule.cat, label: rule.label }
  }
  return { cat: 'other', label: 'Other' }
}

function detectStack(description, language) {
  const found = STACK_KEYWORDS.filter((k) =>
    description.toLowerCase().includes(k.toLowerCase()),
  )
  if (language && !found.includes(language)) found.unshift(language)
  return found.length ? found.join(' · ') : language || 'Software'
}

function fetchRepos() {
  const raw = execSync(
    'gh repo list gson463 --limit 100 --json name,description,primaryLanguage,url,updatedAt,isPrivate,isFork',
    { encoding: 'utf8' },
  )
  return JSON.parse(raw)
}

function buildProjects(repos, overrides) {
  const extraExclude = new Set(overrides.exclude || [])

  return repos
    .filter((r) => !EXCLUDE.has(r.name) && !extraExclude.has(r.name) && !r.isFork)
    .map((repo) => {
      const description = overrides.descriptions?.[repo.name] || repo.description?.trim() || ''
      const overrideCat = overrides.categories?.[repo.name]
      const detected = detectCategory(repo.name, description)
      const category = overrideCat || detected.cat
      const categoryLabel =
        CATEGORY_RULES.find((r) => r.cat === category)?.label ||
        (category === 'other' ? 'Other' : detected.label)

      return {
        id: repo.name,
        title: overrides.titles?.[repo.name] || titleCase(repo.name),
        description: description || 'Software system designed and built as lead developer.',
        category,
        categoryLabel,
        stack: detectStack(description, repo.primaryLanguage?.name),
        url: repo.url,
        updatedAt: repo.updatedAt,
        private: repo.isPrivate,
      }
    })
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

const overrides = loadOverrides()
const repos = fetchRepos()
const projects = buildProjects(repos, overrides)

const output = {
  generatedAt: new Date().toISOString(),
  count: projects.length,
  projects,
}

writeFileSync(join(root, 'projects.json'), JSON.stringify(output, null, 2) + '\n')
console.log(`Wrote ${projects.length} projects to projects.json`)
