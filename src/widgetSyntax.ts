export type SyntaxIssue = { line: number; message: string }

export const validateWidgetSyntax = (content: string): SyntaxIssue[] => content.split('\n').flatMap((line, index) => {
  const issues: SyntaxIssue[] = []
  const opens = (line.match(/\{\{/g) ?? []).length
  const closes = (line.match(/\}\}/g) ?? []).length
  if (opens !== closes) issues.push({ line: index + 1, message: 'Dynamic values must have matching {{ and }}.' })
  if (/\[metric:/i.test(line) && !/^\s*\[metric:\s*[^|]+\|[^]]+\]\s*$/i.test(line)) issues.push({ line: index + 1, message: 'Metric blocks need [metric: Label | value].' })
  if (/\[progress:/i.test(line) && !/^\s*\[progress:\s*[^|]+\|[^|]+\|[^]]+\]\s*$/i.test(line)) issues.push({ line: index + 1, message: 'Progress blocks need [progress: Label | value | maximum].' })
  if (/\{\{\s*}}/.test(line)) issues.push({ line: index + 1, message: 'Dynamic values cannot be empty.' })
  return issues
})
