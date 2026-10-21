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

export const templateValues: Record<string, string> = {
  'notes.total': '248', 'notes.created_today': '12', 'notes.updated_week': '36', 'notes.words': '18,420',
  'date.today': new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
  'date.greeting': new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening',
}

export function renderWidgetTemplate(template: string, values = templateValues) {
  return template.replace(/{{\s*([\w.]+)(?:\s*\|[^}]+)?\s*}}/g, (_, key: string) => values[key] ?? `{{${key}}}`)
}

export function loadSavedTemplates(): WidgetTemplate[] {
  try { return JSON.parse(localStorage.getItem('starkeep-widget-templates') ?? '[]') as WidgetTemplate[] } catch { return [] }
}
