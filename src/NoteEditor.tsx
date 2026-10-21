import { useEffect, useRef, useState } from 'react'
import Quill from 'quill'
import type { Collection, Note } from './types'
import { database } from './db'
import { notesRepository } from './notesRepository'

type Props = { note: Note; onSaved: (note: Note) => void; onClose: () => void }

export function NoteEditor({ note, onSaved, onClose }: Props) {
  const editorRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const noteRef = useRef(note)
  const titleRef = useRef(note.title)
  const collectionIdRef = useRef(note.collectionId ?? '')
  const onSavedRef = useRef(onSaved)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [title, setTitle] = useState(note.title)
  const [collectionId, setCollectionId] = useState(note.collectionId ?? '')
  const [collections, setCollections] = useState<Collection[]>([])
  const [saveState, setSaveState] = useState('Saved locally')

  async function persist(quill: Quill) {
    const updated: Note = { ...noteRef.current, title: titleRef.current.trim() || 'Untitled note', collectionId: collectionIdRef.current || undefined, content: quill.getContents(), updatedAt: Date.now() }
    setSaveState('Saving…')
    try { await notesRepository.save(updated); setSaveState('Saved locally'); onSavedRef.current(updated) }
    catch { setSaveState('Save failed — retrying on next change') }
  }

  useEffect(() => { noteRef.current = note; onSavedRef.current = onSaved }, [note, onSaved])
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { collectionIdRef.current = collectionId }, [collectionId])
  useEffect(() => { void database.collections.toArray().then(setCollections) }, [])
  useEffect(() => {
    if (!editorRef.current) return
    const editorElement = editorRef.current
    const quill = new Quill(editorElement, { theme: 'snow', modules: { toolbar: [['bold', 'italic', 'underline'], [{ header: [1, 2, false] }], [{ list: 'ordered' }, { list: 'bullet' }], ['link', 'image']] } })
    quill.setContents(noteRef.current.content)
    quillRef.current = quill
    const save = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      setSaveState('Unsaved changes')
      timerRef.current = setTimeout(() => { void persist(quill) }, 500)
    }
    quill.on('text-change', save)
    return () => { if (timerRef.current) clearTimeout(timerRef.current); quill.off('text-change', save); quill.disable(); quillRef.current = null; editorElement.replaceChildren() }
  }, [note.id])

  const saveTitle = () => { if (quillRef.current) void persist(quillRef.current) }

  return <div className="editor-panel"><div className="editor-header"><button type="button" className="text-button" onClick={onClose}>← Back</button><span className={`save-state ${saveState.startsWith('Save failed') ? 'save-failed' : ''}`}>{saveState}</span></div><input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} onBlur={saveTitle} aria-label="Note title" placeholder="Untitled note" />{collections.length > 0 && <label className="editor-collection"><span>Collection</span><select value={collectionId} onChange={(event) => { setCollectionId(event.target.value); setSaveState('Unsaved changes'); if (quillRef.current) void persist(quillRef.current) }}><option value="">No collection</option>{collections.map((collection) => <option key={collection.id} value={collection.id}>{collection.name}</option>)}</select></label>}<div ref={editorRef} className="quill-editor" /></div>
}
