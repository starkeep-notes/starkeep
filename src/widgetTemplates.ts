import type { Note } from './types'

export type WidgetStyle = 'cream' | 'yellow' | 'blue' | 'green' | 'ink'

export type WidgetTemplate = {
  id: string
  name: string
  category: string
  description: string
  template: string
  accent: WidgetStyle
  updatedAt?: number
}

export const widgetPresets: WidgetTemplate[] = [
  { id: 'quote', name: 'Daily quote', category: 'Editorial', description: 'A quiet moment of inspiration.', template: '“The secret of getting ahead is getting started.”\n\n— Mark Twain\n\nQuote of the day', accent: 'cream' },
  { id: 'counter', name: 'Counter', category: 'Progress', description: 'Show a number and its momentum.', template: '# {{notes.total}}\n\nIdeas collected\n\n↑ {{notes.created_today}} this week', accent: 'yellow' },
  { id: 'welcome', name: 'Welcome message', category: 'Personal', description: 'A friendly hello for your notebook.', template: '# Hello, {{date.greeting}}\n\nYou have **{{notes.total}} notes** in your notebook.', accent: 'blue' },
  { id: 'goal', name: 'Daily goal', category: 'Progress', description: 'Make a little progress visible.', template: '## Daily goal\n\n{{notes.updated_week}} notes updated\n\n62% of 400 goal', accent: 'green' },
  { id: 'custom', name: 'Custom text', category: 'Custom', description: 'Start with a blank canvas.', template: 'Your idea starts here.', accent: 'ink' },
]

export function createTemplateValues(notes: Note[] = []): Record<string, string> {
  const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0)
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const activeNotes = notes.filter((note) => !note.deletedAt && !note.isWidget)
  const words = activeNotes.reduce((total, note) => total + note.content.ops.reduce((count, op) => count + (typeof op.insert === 'string' ? op.insert.trim().split(/\s+/).filter(Boolean).length : 0), 0), 0)
  const latest = activeNotes.sort((a, b) => b.updatedAt - a.updatedAt)[0]
  const collections = new Set(activeNotes.map((note) => note.collectionId).filter(Boolean))
  const widgets = notes.filter((note) => !note.deletedAt && note.isWidget).length
  return {
    'notes.total': String(activeNotes.length),
    'notes.created_today': String(activeNotes.filter((note) => note.createdAt >= startOfToday.getTime()).length),
    'notes.updated_week': String(activeNotes.filter((note) => note.updatedAt >= weekAgo).length),
    'notes.words': words.toLocaleString(),
    'notes.collections': String(collections.size),
    'notes.widgets': String(widgets),
    'notes.latest_title': latest?.title ?? 'No notes yet',
    'notes.latest_date': latest ? new Date(latest.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '—',
    'date.today': new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    'date.greeting': new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening',
  }
}

export const templateValues = createTemplateValues()

export function renderWidgetTemplate(template: string, values = templateValues) {
  return template.replace(/{{\s*(?:(note)\(\s*"([^"]+)"\s*\)|([\w.]+))(?:\s*\|[^}]+)?\s*}}/g, (match: string, functionName: string | undefined, argument: string | undefined, key: string | undefined) => {
    const resolvedKey = functionName ? argument?.toLowerCase() === 'title' ? 'notes.latest_title' : argument?.toLowerCase() === 'date' ? 'notes.latest_date' : undefined : key
    return resolvedKey && values[resolvedKey] !== undefined ? values[resolvedKey] : match
  })
}

export function loadSavedTemplates(): WidgetTemplate[] {
  try { return JSON.parse(localStorage.getItem('starkeep-widget-templates') ?? '[]') as WidgetTemplate[] } catch { return [] }
}
