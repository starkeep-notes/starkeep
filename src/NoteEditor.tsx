import { useEffect, useRef, useState } from 'react'
import Quill from 'quill'
import { plainContent, plainText } from './editorDraft'
import type { Board, Collection, Note } from './types'
import { database } from './db'
import { notesRepository } from './notesRepository'
import { loadSavedTemplates, renderWidgetTemplate, createTemplateValues, widgetPresets, type WidgetStyle } from './widgetTemplates'
import { parseWidgetDocument, type WidgetDocument } from './widgetDocument'
import { WidgetVisualEditor, type WidgetVisualEditorHandle } from './WidgetVisualEditor'
import { SyntaxCodeEditor } from './SyntaxCodeEditor'
import { validateWidgetSyntax, type SyntaxIssue } from './widgetSyntax'

const previewContent = (content: string) => content.trim() || 'Start writing your widget'

function WidgetPreview({ content, notes }: { content: string; notes: Note[] }) {
 const values = createTemplateValues(notes)
 let document: WidgetDocument
 try { document = parseWidgetDocument(content) } catch { return <div className="preview-content"><p>{content || 'Start writing your widget'}</p></div> }
 return <div className="preview-content">{document.blocks.filter((block) => block.type !== 'text' || block.parts.some((part) => part.type === 'text' ? part.text.trim() : true)).slice(0, 6).map((block) => {
   if (block.type === 'heading') { const text = renderWidgetTemplate(block.parts.map((part) => part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text).join(''), values); return <div className={`preview-heading preview-heading-${block.level}`} key={block.id}>{text}</div> }
   if (block.type === 'metric') return <div className="preview-metric" key={block.id}><span>{renderWidgetTemplate(block.label, values)}</span><strong>{renderWidgetTemplate(block.value, values)}</strong></div>
   if (block.type === 'progress') { const current = Number(renderWidgetTemplate(block.value, values)) || 0; const maximum = Number(renderWidgetTemplate(block.maximum, values)) || 100; return <div className="preview-progress" key={block.id}><span>{renderWidgetTemplate(block.label, values)}</span><strong>{renderWidgetTemplate(block.value, values)} / {renderWidgetTemplate(block.maximum, values)}</strong><div className="preview-progress-track"><i style={{ width: `${Math.min(100, Math.max(0, current / maximum * 100))}%` }} /></div></div> }
   return <p key={block.id}>{renderWidgetTemplate(block.parts.map((part) => part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text).join(''), values)}</p>
 })}</div>
}

function SyntaxEditorPanel({ content, notes, onChange, widgetStyle }: { content: string; notes: Note[]; onChange: (content: string) => void; widgetStyle: WidgetStyle }) {
  const issues: SyntaxIssue[] = validateWidgetSyntax(content)
  return <div className="syntax-workbench">
    <div className="syntax-editor-panel">
      <div className="syntax-editor-heading"><span className="syntax-badge">syntax</span><span className={`syntax-status ${issues.length ? 'has-errors' : ''}`}>{issues.length ? `⚠ ${issues.length} ${issues.length === 1 ? 'issue' : 'issues'}` : '✓ No errors'}</span></div>
      <SyntaxCodeEditor value={content} issues={issues} onChange={onChange} />
      {issues.length > 0 ? <div className="syntax-issues" role="alert">{issues.map((issue) => <div key={`${issue.line}-${issue.message}`}><strong>Line {issue.line}</strong>{issue.message}</div>)}</div> : <div className="syntax-hint"><strong>Hint</strong> Use <code>{'{{ notes.total }}'}</code> for a live value, or <code>{'{{ note("title") }}'}</code> to read a note.</div>}
    </div>
    <aside className="syntax-reference"><div className="syntax-preview-heading">Live preview</div><div className={`syntax-preview-card preview-${widgetStyle}`}><WidgetPreview content={previewContent(content)} notes={notes} /></div><div className="syntax-preview-heading">Cheat sheet</div><div className="syntax-cheat-sheet"><p><code>{'{{ note("title") }}'}</code><span>Read one note</span></p><p><code>{'{{ notes where tag = "x" }}'}</code><span>Filter notes</span></p><p><code>{'{{ value | ago }}'}</code><span>Format a value</span></p><p><code>{'[metric: Label | value]'}</code><span>Show a metric</span></p><p><code>{'[progress: Label | value | max]'}</code><span>Show progress</span></p></div></aside>
  </div>
}

type Props = { note: Note; onSaved: (note: Note) => void; onClose: () => void; backLabel?: string }

export function NoteEditor({ note, onSaved, onClose, backLabel = 'All notes' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const widgetEditorRef = useRef<WidgetVisualEditorHandle>(null)
  const noteRef = useRef(note)
  const titleRef = useRef(note.title)
  const collectionIdRef = useRef(note.collectionId ?? '')
  const boardIdRef = useRef(note.boardId ?? '')
  const modeRef = useRef(note.isWidget ?? false)
  const widgetStyleRef = useRef(note.widgetStyle ?? 'cream')
  const onSavedRef = useRef(onSaved)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const revisionRef = useRef(0)
  const queuedRef = useRef(0)
  const mountedRef = useRef(true)
  const contentRef = useRef(note.content)
  const [title, setTitle] = useState(note.title)
  const [collectionId, setCollectionId] = useState(note.collectionId ?? '')
  const [boardId, setBoardId] = useState(note.boardId ?? '')
  const [boards, setBoards] = useState<Board[]>([])
  const [isWidget, setIsWidget] = useState(note.isWidget ?? false)
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>(note.widgetStyle ?? 'cream')
  const [templateChoice, setTemplateChoice] = useState('')
  const [editorMode, setEditorMode] = useState<'builder' | 'syntax'>(() => validateWidgetSyntax(plainText(note.content)).length ? 'syntax' : 'builder')
  const [savedTemplates] = useState(() => loadSavedTemplates())
  const initialWidgetText = plainText(note.content)
  const [previewText, setPreviewText] = useState(initialWidgetText)
  const previewTextRef = useRef(initialWidgetText)
  const [collections, setCollections] = useState<Collection[]>([])
  const [allNotes, setAllNotes] = useState<Note[]>([note])
  const [saveState, setSaveState] = useState('Saved locally')

  function queueSave() {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = undefined }
    const revision = revisionRef.current
    if (queuedRef.current === revision) return
    queuedRef.current = revision
    if (mountedRef.current) setSaveState('Saving…')
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      // Skip superseded requests; a debounce or newer queued write owns that draft.
      if (revision !== revisionRef.current) return
      const savingRevision = revision
      const updated: Note = { ...noteRef.current, title: titleRef.current.trim() || 'Untitled note', collectionId: collectionIdRef.current || undefined, boardId: boardIdRef.current || undefined, isWidget: modeRef.current, widgetStyle: modeRef.current ? widgetStyleRef.current : undefined, content: contentRef.current, updatedAt: Date.now() }
      try {
        await notesRepository.save(updated)
        noteRef.current = updated
        onSavedRef.current(updated)
        if (mountedRef.current) setSaveState(savingRevision === revisionRef.current ? 'Saved locally' : queuedRef.current === revisionRef.current ? 'Saving…' : 'Unsaved changes')
      } catch {
        if (mountedRef.current && savingRevision === revisionRef.current) setSaveState('Save failed — retrying on next change')
      }
    })
  }
  function changed(immediate = false) {
    revisionRef.current++
    setSaveState('Unsaved changes')
    if (immediate) queueSave()
    else {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(queueSave, 500)
    }
  }

  useEffect(() => { onSavedRef.current = onSaved }, [onSaved])
  useEffect(() => { void database.collections.toArray().then(setCollections); void database.boards.toArray().then((items) => setBoards(items.sort((a, b) => a.createdAt - b.createdAt))); void notesRepository.list().then(setAllNotes) }, [])
  useEffect(() => {
    if (isWidget || !editorRef.current) return
    const editorElement = editorRef.current
    const quill = new Quill(editorElement, { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], [{ header: [1, 2, false] }], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image']] } })
    quill.setContents(contentRef.current)
    quillRef.current = quill
    const save = () => {
      contentRef.current = quill.getContents()
      previewTextRef.current = plainText(contentRef.current)
      changed()
    }
    quill.on('text-change', save)
    return () => { quill.off('text-change', save); quill.disable(); quillRef.current = null; const toolbar = editorElement.previousElementSibling; if (toolbar?.classList.contains('ql-toolbar')) toolbar.remove(); editorElement.replaceChildren(); editorElement.className = 'quill-editor' }
  }, [note.id, isWidget])
  useEffect(() => { mountedRef.current = true; return () => { mountedRef.current = false; if (timerRef.current) queueSave() } }, [])

  const saveTitle = () => queueSave()
  const changeMode = (next: boolean) => {
    if (next === modeRef.current) return
    if (next) {
      if (!window.confirm('Switching to Widget will discard note formatting and embedded content. Continue?')) return
      if (quillRef.current) contentRef.current = quillRef.current.getContents()
      const text = plainText(contentRef.current)
      previewTextRef.current = text
      setPreviewText(text)
      if (validateWidgetSyntax(text).length) setEditorMode('syntax')
      contentRef.current = plainContent(text)
    } else contentRef.current = plainContent(previewTextRef.current)
    modeRef.current = next
    setIsWidget(next)
    changed(true)
  }
  const changeStyle = (next: WidgetStyle) => { setWidgetStyle(next); widgetStyleRef.current = next; changed(true) }
  const templateOptions = [...widgetPresets.map((item) => ({ ...item, source: 'Built-in' })), ...savedTemplates.filter((item) => !widgetPresets.some((preset) => preset.id === item.id)).map((item) => ({ ...item, source: 'Saved' }))]
  const applyTemplate = (template: string, style?: WidgetStyle) => {
    if (style) { widgetStyleRef.current = style; setWidgetStyle(style) }
    commitWidgetText(template, true)
    setTemplateChoice('')
  }
  const commitWidgetText = (next: string, immediate = false) => {
    previewTextRef.current = next
    contentRef.current = plainContent(next)
    setPreviewText(next)
    changed(immediate)
  }

  return <div className="editor-modal" role="dialog" aria-modal="true" aria-label={isWidget ? 'Edit widget' : 'Edit note'} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><div className={`editor-panel ${isWidget ? 'widget-mode' : 'note-mode'}`}><div className="editor-header"><button type="button" className="text-button editor-back" onClick={onClose}>← {backLabel}</button><span className={`editor-mode-label ${isWidget ? 'active' : ''}`}>{isWidget ? 'Widget' : 'Note'}</span><span role="status" aria-live="polite" className={`save-state ${saveState.startsWith('Save failed') ? 'save-failed' : ''}`}><span className="status-dot" />{saveState}</span><button type="button" className="editor-close" aria-label="Close editor" onClick={onClose}>× Close</button></div><div className="editor-mode-toggle" role="group" aria-label="Content mode"><button type="button" className={!isWidget ? 'active' : ''} onClick={() => changeMode(false)}>Note</button><button type="button" className={isWidget ? 'active' : ''} onClick={() => changeMode(true)}>Widget</button></div><input className="title-input" value={title} onChange={(event) => { setTitle(event.target.value); titleRef.current = event.target.value; changed() }} onBlur={saveTitle} aria-label={isWidget ? 'Widget title' : 'Note title'} placeholder={isWidget ? 'Widget name' : 'Untitled note'} />{isWidget && <><div className="widget-builder-toolbar"><span className="eyebrow">Widget editor</span><button type="button" className="builder-switch" disabled={editorMode === 'syntax' && validateWidgetSyntax(previewText).length > 0} title={editorMode === 'syntax' && validateWidgetSyntax(previewText).length ? 'Fix syntax issues before opening the visual builder' : undefined} onClick={() => setEditorMode((mode) => mode === 'builder' ? 'syntax' : 'builder')}>{editorMode === 'builder' ? '</> Switch to syntax editor' : '← Back to visual builder'}</button></div>{editorMode === 'builder' && <div className="builder-panel"><div className="builder-field builder-template-library"><span>Template library</span><div className="preset-list">{templateOptions.map((item) => <button type="button" key={`${item.source}-${item.id}`} className={`preset-card ${templateChoice === item.id ? 'selected' : ''}`} onClick={() => { setTemplateChoice(item.id); applyTemplate(item.template, item.accent) }}><span className={`preset-swatch swatch-${item.accent}`} /><span><strong>{item.name}</strong><small>{item.source}</small></span><span className="preset-arrow" aria-hidden="true">→</span></button>)}</div></div><div><span className="tool-label">Your text</span><WidgetVisualEditor ref={widgetEditorRef} value={previewText} onChange={commitWidgetText} /><p className="builder-help">Type directly in this area. Click a yellow value to edit its <code>{'{{ }}'}</code> syntax.</p></div><div><span className="tool-label">Insert a block</span><div className="builder-add" role="group" aria-label="Insert widget block">{(['heading', 'metric', 'progress'] as const).map((type) => <button type="button" key={type} onClick={() => widgetEditorRef.current?.insertBlock(type)}>+ {type}</button>)}</div><span className="tool-label">Tap a value to add it</span><div className="builder-add">{['notes.total', 'notes.latest_title', 'date.today'].map((key) => <button type="button" key={key} onClick={() => widgetEditorRef.current?.insertToken(key)}>+ {key}</button>)}</div></div><div className={`builder-live-preview preview-${widgetStyle}`}><span>LIVE PREVIEW · Updates as you type</span><WidgetPreview content={previewContent(previewText)} notes={allNotes} /></div></div>}<div className={editorMode === 'syntax' ? '' : 'builder-hidden'}><SyntaxEditorPanel content={previewText} notes={allNotes} onChange={commitWidgetText} widgetStyle={widgetStyle} /></div><div className={`widget-template-picker ${editorMode === 'syntax' ? 'syntax-editor-mode builder-hidden' : 'builder-hidden'}`}><label>Start from template<select aria-label="Pick an existing widget template" value={templateChoice} onChange={(event) => { setTemplateChoice(event.target.value); const option = templateOptions.find((item) => item.id === event.target.value); if (option) applyTemplate(option.template, option.accent) }}><option value="">Keep current content</option>{templateOptions.map((item) => <option key={`${item.source}-${item.id}`} value={item.id}>{item.name} · {item.source}</option>)}</select></label><div className={`widget-inline-preview preview-${widgetStyle}`} aria-label="Widget preview"><span>Preview</span>{renderWidgetTemplate(previewContent(previewText), createTemplateValues(allNotes)).replace(/[*#>“”]/g, '').split('\n').filter(Boolean).slice(0, 3).map((line) => <p key={line}>{line}</p>)}</div></div><div className="widget-editor-options"><span>Widget style</span>{(['cream', 'yellow', 'blue', 'green', 'ink'] as const).map((item) => <button type="button" key={item} className={`style-dot dot-${item} ${widgetStyle === item ? 'active' : ''}`} aria-label={`${item} widget style`} onClick={() => changeStyle(item)} />)}</div></>}{collections.length > 0 && <label className="editor-collection"><span>Collection</span><select value={collectionId} onChange={(event) => { setCollectionId(event.target.value); collectionIdRef.current = event.target.value; changed(true) }}><option value="">No collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}{!isWidget && boards.length > 0 && <label className="editor-collection"><span>Board</span><select value={boardId} onChange={(event) => { setBoardId(event.target.value); boardIdRef.current = event.target.value; changed(true) }}><option value="">No board</option>{boards.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}  {!isWidget && <div ref={editorRef} className="quill-editor" />}</div></div>
}
