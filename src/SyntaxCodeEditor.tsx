import { useEffect, useMemo, useRef } from 'react'
import CodeMirror, { type ReactCodeMirrorProps } from '@uiw/react-codemirror'
import { EditorView, Decoration, ViewPlugin, type ViewUpdate } from '@codemirror/view'
import { autocompletion, completeFromList } from '@codemirror/autocomplete'
import { lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint'
import { oneDark } from '@codemirror/theme-one-dark'
import type { SyntaxIssue } from './widgetSyntax'

const widgetHighlighting = ViewPlugin.fromClass(class {
  decorations
  constructor(view: EditorView) { this.decorations = this.build(view) }
  update(update: ViewUpdate) { if (update.docChanged || update.viewportChanged) this.decorations = this.build(update.view) }
  build(view: EditorView) {
    const marks = []
    const source = view.state.doc.toString()
    const expression = /\{\{[^\n]*?\}\}/g
    let match: RegExpExecArray | null
    while ((match = expression.exec(source))) marks.push(Decoration.mark({ class: 'cm-widget-expression' }).range(match.index, match.index + match[0].length))
    return Decoration.set(marks)
  }
}, { decorations: (value) => value.decorations })

const completions = completeFromList([
  { label: 'notes.total', type: 'variable', info: 'Number of notes' },
  { label: 'notes.latest_title', type: 'variable', info: 'Title of the latest note' },
  { label: 'date.today', type: 'variable', info: 'Today’s date' },
  { label: 'note("title")', type: 'function', info: 'Read a note by title' },
  { label: 'notes where tag = "x"', type: 'keyword', info: 'Filter notes by tag' },
  { label: 'ago', type: 'keyword', info: 'Format a date as relative time' },
])

const toDiagnostics = (issues: SyntaxIssue[], content: string): Diagnostic[] => issues.map((issue) => {
  const lines = content.split('\n')
  const from = Math.min(content.length, lines.slice(0, issue.line - 1).reduce((total, line) => total + line.length + 1, 0))
  return { from, to: Math.min(content.length, from + (lines[issue.line - 1]?.length ?? 0)), severity: 'error', message: issue.message }
})

type Props = { value: string; issues: SyntaxIssue[]; onChange: (value: string) => void }

export function SyntaxCodeEditor({ value, issues, onChange }: Props) {
  const viewRef = useRef<EditorView | null>(null)
  const extensions = useMemo<ReactCodeMirrorProps['extensions']>(() => [lintGutter(), autocompletion({ override: [completions] }), widgetHighlighting], [])
  useEffect(() => {
    if (viewRef.current) viewRef.current.dispatch(setDiagnostics(viewRef.current.state, toDiagnostics(issues, value)))
  }, [issues, value])
  return <CodeMirror value={value} onChange={onChange} onCreateEditor={(view) => { viewRef.current = view }} extensions={extensions} basicSetup height="250px" theme={oneDark} aria-label="Widget syntax editor" className="syntax-code-mirror" />
}