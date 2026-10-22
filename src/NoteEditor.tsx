import { useEffect, useRef, useState } from 'react'
import Quill from 'quill'
import type { Collection, Note } from './types'
import { database } from './db'
import { notesRepository } from './notesRepository'
import { loadSavedTemplates, renderWidgetTemplate, createTemplateValues, widgetPresets, type WidgetStyle } from './widgetTemplates'
import { parseWidgetDocument, serializeWidgetDocument, type WidgetDocument } from './widgetDocument'
import { WidgetVisualEditor, type WidgetVisualEditorHandle } from './WidgetVisualEditor'

const previewContent = (content: string) => content.trim() || 'Start writing your widget'

type Props = { note: Note; onSaved: (note: Note) => void; onClose: () => void; backLabel?: string }

export function NoteEditor({ note, onSaved, onClose, backLabel = 'All notes' }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const widgetEditorRef = useRef<WidgetVisualEditorHandle>(null)
  const noteRef = useRef(note)
  const titleRef = useRef(note.title)
  const collectionIdRef = useRef(note.collectionId ?? '')
  const modeRef = useRef(note.isWidget ?? false)
  const widgetStyleRef = useRef(note.widgetStyle ?? 'cream')
  const onSavedRef = useRef(onSaved)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve())
  const metadataDirtyRef = useRef(false)
  const [title, setTitle] = useState(note.title)
  const [collectionId, setCollectionId] = useState(note.collectionId ?? '')
  const [isWidget, setIsWidget] = useState(note.isWidget ?? false)
  const [widgetStyle, setWidgetStyle] = useState<WidgetStyle>(note.widgetStyle ?? 'cream')
  const [templateChoice, setTemplateChoice] = useState('')
  const [editorMode, setEditorMode] = useState<'builder' | 'syntax'>('builder')
  const [savedTemplates] = useState(() => loadSavedTemplates())
  const initialWidgetText = note.content.ops.map((op) => typeof op.insert === 'string' ? op.insert : '').join('').replace(/\n$/, '')
  const widgetDocumentRef = useRef<WidgetDocument>(parseWidgetDocument(initialWidgetText))
  const [previewText, setPreviewText] = useState(initialWidgetText)
  const previewTextRef = useRef(previewText)
  const [collections, setCollections] = useState<Collection[]>([])
  const [saveState, setSaveState] = useState('Saved locally')

  function persist(quill: Quill) {
    const updated: Note = { ...noteRef.current, title: titleRef.current.trim() || 'Untitled note', collectionId: collectionIdRef.current || undefined, isWidget: modeRef.current, widgetStyle: modeRef.current ? widgetStyleRef.current : undefined, content: quill.getContents(), updatedAt: Date.now() }
    setSaveState('Saving…')
    saveQueueRef.current = saveQueueRef.current.then(async () => {
      try { await notesRepository.save(updated); noteRef.current = updated; metadataDirtyRef.current = false; setSaveState('Saved locally'); onSavedRef.current(updated) }
      catch { setSaveState('Save failed — retrying on next change') }
    })
  }

  useEffect(() => { noteRef.current = note; onSavedRef.current = onSaved }, [note, onSaved])
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { collectionIdRef.current = collectionId }, [collectionId])
  useEffect(() => { modeRef.current = isWidget }, [isWidget])
  useEffect(() => { widgetStyleRef.current = widgetStyle }, [widgetStyle])
  useEffect(() => { previewTextRef.current = previewText }, [previewText])
  useEffect(() => { void database.collections.toArray().then(setCollections) }, [])
  useEffect(() => {
    if (!editorRef.current) return
    const editorElement = editorRef.current
    const quill = new Quill(editorElement, { theme: 'snow', modules: { toolbar: noteRef.current.isWidget ? [['bold', 'italic'], [{ header: [1, 2, false] }]] : [['bold', 'italic', 'underline'], [{ header: [1, 2, false] }], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image']] } })
    quill.setContents(noteRef.current.content)
    quillRef.current = quill
    const save = () => {
      setPreviewText(quill.getText().replace(/\n$/, ''))
      if (timerRef.current) clearTimeout(timerRef.current)
      setSaveState('Unsaved changes')
      timerRef.current = setTimeout(() => { void persist(quill) }, 500)
    }
    quill.on('text-change', save)
    return () => { if (timerRef.current || metadataDirtyRef.current) { if (timerRef.current) clearTimeout(timerRef.current); persist(quill) }; quill.off('text-change', save); quill.disable(); quillRef.current = null; const toolbar = editorElement.previousElementSibling; if (toolbar?.classList.contains('ql-toolbar')) toolbar.remove(); editorElement.replaceChildren(); editorElement.className = 'quill-editor' }
  }, [note.id])

  const saveTitle = () => { if (quillRef.current) persist(quillRef.current) }
  const changeMode = (next: boolean) => { setIsWidget(next); modeRef.current = next; metadataDirtyRef.current = true; setSaveState('Unsaved changes'); if (quillRef.current) persist(quillRef.current) }
  const changeStyle = (next: WidgetStyle) => { setWidgetStyle(next); widgetStyleRef.current = next; metadataDirtyRef.current = true; setSaveState('Unsaved changes'); if (quillRef.current) persist(quillRef.current) }
  const templateOptions = [...widgetPresets.map((item) => ({ ...item, source: 'Built-in' })), ...savedTemplates.filter((item) => !widgetPresets.some((preset) => preset.id === item.id)).map((item) => ({ ...item, source: 'Saved' }))]
  const commitWidgetDocument = (nextDocument: WidgetDocument) => {
    const next = serializeWidgetDocument(nextDocument)
    widgetDocumentRef.current = nextDocument
    setPreviewText(next)
    widgetEditorRef.current?.setValue(next)
    if (quillRef.current && quillRef.current.getText().replace(/\n$/, '') !== next) quillRef.current.setText(next)
    setSaveState('Unsaved changes')
    metadataDirtyRef.current = true
    if (quillRef.current) persist(quillRef.current)
  }
  const applyTemplate = (template: string, style?: WidgetStyle) => {
    commitWidgetDocument(parseWidgetDocument(template))
    if (style) changeStyle(style)
    setTemplateChoice('')
  }
  const commitWidgetText = (next: string) => {
    const nextDocument = parseWidgetDocument(next)
    widgetDocumentRef.current = nextDocument
    setPreviewText(next)
    setSaveState('Unsaved changes')
    metadataDirtyRef.current = true
    if (quillRef.current && quillRef.current.getText().replace(/\n$/, '') !== next) quillRef.current.setText(next)
    if (quillRef.current) persist(quillRef.current)
  }

  return <div className={`editor-panel ${isWidget ? 'widget-mode' : 'note-mode'}`}><div className="editor-header"><button type="button" className="text-button editor-back" onClick={onClose}>← {backLabel}</button><span className={`editor-mode-label ${isWidget ? 'active' : ''}`}>{isWidget ? 'Widget' : 'Note'}</span><span className={`save-state ${saveState.startsWith('Save failed') ? 'save-failed' : ''}`}><span className="status-dot" />{saveState}</span></div><div className="editor-mode-toggle" role="group" aria-label="Content mode"><button type="button" className={!isWidget ? 'active' : ''} onClick={() => changeMode(false)}>Note</button><button type="button" className={isWidget ? 'active' : ''} onClick={() => changeMode(true)}>Widget</button></div><input className="title-input" value={title} onChange={(event) => { setTitle(event.target.value); titleRef.current = event.target.value; metadataDirtyRef.current = true; setSaveState('Unsaved changes') }} onBlur={saveTitle} aria-label={isWidget ? 'Widget title' : 'Note title'} placeholder={isWidget ? 'Widget name' : 'Untitled note'} />{isWidget && <><div className="widget-builder-toolbar"><span className="eyebrow">Widget editor</span><button type="button" className="builder-switch" onClick={() => setEditorMode((mode) => mode === 'builder' ? 'syntax' : 'builder')}>{editorMode === 'builder' ? '</> Switch to syntax editor' : '← Back to visual builder'}</button></div>{editorMode === 'builder' && <div className="builder-panel"><div className="builder-field builder-template-library"><span>Template library</span><div className="preset-list">{templateOptions.map((item) => <button type="button" key={`${item.source}-${item.id}`} className={`preset-card ${templateChoice === item.id ? 'selected' : ''}`} onClick={() => { setTemplateChoice(item.id); applyTemplate(item.template, item.accent) }}><span className={`preset-swatch swatch-${item.accent}`} /><span><strong>{item.name}</strong><small>{item.source}</small></span><span className="preset-arrow" aria-hidden="true">→</span></button>)}</div></div><div className="builder-field"><label>Which note?<select aria-label="Choose a note for this widget"><option>Current note</option><option>Latest note</option>{collections.map((collection) => <option key={collection.id}>{collection.name}</option>)}</select></label></div><div><span className="tool-label">Your text</span><WidgetVisualEditor ref={widgetEditorRef} value={previewText} onChange={commitWidgetText} /><p className="builder-help">Type directly in this area. Click a yellow value to edit its <code>{'{{ }}'}</code> syntax.</p></div><div><span className="tool-label">Tap a value to add it</span><div className="builder-add">{['notes.total', 'notes.latest_title', 'date.today'].map((key) => <button type="button" key={key} onClick={() => widgetEditorRef.current?.insertToken(key)}>+ {key}</button>)}</div></div><div className={`builder-live-preview preview-${widgetStyle}`}><span>LIVE PREVIEW · Updates as you type</span>{renderWidgetTemplate(previewContent(previewText), createTemplateValues([note])).replace(/[*#>“”]/g, '').split('\n').filter(Boolean).slice(0, 3).map((line) => <p key={line}>{line}</p>)}</div></div>}<div className={`syntax-editor-panel ${editorMode === 'syntax' ? '' : 'builder-hidden'}`}><div className="syntax-editor-heading"><span className="syntax-badge">syntax</span><span className="syntax-status">✓ No errors</span></div><textarea aria-label="Widget syntax" value={previewText} onChange={(event) => applyTemplate(event.target.value)} spellCheck={false} /><div className="syntax-hint"><strong>Hint</strong> Use <code>{'{{ notes.total }}'}</code> for a live value, or <code>{'{{ note("title") }}'}</code> to read a note.</div></div><div className={`widget-template-picker ${editorMode === 'syntax' ? 'syntax-editor-mode builder-hidden' : 'builder-hidden'}`}><label>Start from template<select aria-label="Pick an existing widget template" value={templateChoice} onChange={(event) => { setTemplateChoice(event.target.value); const option = templateOptions.find((item) => item.id === event.target.value); if (option) applyTemplate(option.template, option.accent) }}><option value="">Keep current content</option>{templateOptions.map((item) => <option key={`${item.source}-${item.id}`} value={item.id}>{item.name} · {item.source}</option>)}</select></label><div className={`widget-inline-preview preview-${widgetStyle}`} aria-label="Widget preview"><span>Preview</span>{renderWidgetTemplate(previewContent(previewText), createTemplateValues([note])).replace(/[*#>“”]/g, '').split('\n').filter(Boolean).slice(0, 3).map((line) => <p key={line}>{line}</p>)}</div></div><div className="widget-editor-options"><span>Widget style</span>{(['cream', 'yellow', 'blue', 'green', 'ink'] as const).map((item) => <button type="button" key={item} className={`style-dot dot-${item} ${widgetStyle === item ? 'active' : ''}`} aria-label={`${item} widget style`} onClick={() => changeStyle(item)} />)}</div></>}{collections.length > 0 && <label className="editor-collection"><span>Collection</span><select value={collectionId} onChange={(event) => { setCollectionId(event.target.value); collectionIdRef.current = event.target.value; metadataDirtyRef.current = true; setSaveState('Unsaved changes'); if (quillRef.current) persist(quillRef.current) }}><option value="">No collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}<div ref={editorRef} className="quill-editor" /></div>
}
