import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, useEditor, EditorContent } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { parseWidgetDocument, serializeWidgetDocument } from './widgetDocument'
import { documentToTiptap, tiptapToDocument } from './widgetDocumentAdapter'

const tokenSource = (key: string) => `{{${key}}}`

type TokenViewProps = Pick<ReactNodeViewProps, 'node' | 'updateAttributes'>
function WidgetTokenView({ node, updateAttributes }: TokenViewProps) {
  const key = String(node.attrs.key ?? '')
  const source = String(node.attrs.source ?? '')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(tokenSource(key))
  const save = () => {
    const match = draft.trim().match(/^\{\{\s*([\w.]+)(?:\s*\|[^}]+)?\s*\}\}$/)
    if (match) { updateAttributes({ key: match[1], source: draft.trim() }); setOpen(false) }
  }
  return <NodeViewWrapper as="span" className="builder-token-wrap" data-widget-token={key} contentEditable={false}>
    <button type="button" className="builder-token" onClick={() => { setDraft(source || tokenSource(key)); setOpen(true) }} aria-label={`Dynamic value ${key}. Edit token`}>{key}</button>
    {open && <span className="token-popover" role="dialog" aria-label="Edit token syntax"><label>Token syntax<input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save(); if (event.key === 'Escape') setOpen(false) }} /></label><span className="token-popover-actions"><button type="button" onClick={save}>Save</button><button type="button" className="text-button" onClick={() => setOpen(false)}>Cancel</button></span></span>}
  </NodeViewWrapper>
}

const WidgetToken = Node.create({
  name: 'widgetToken',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ key: { default: '' }, source: { default: '' } }),
  parseHTML: () => [{ tag: 'span[data-widget-token]' }],
  renderHTML: ({ HTMLAttributes }) => ['span', mergeAttributes(HTMLAttributes, { 'data-widget-token': HTMLAttributes.key }), 0],
  addNodeView: () => ReactNodeViewRenderer(WidgetTokenView),
})

export type WidgetVisualEditorHandle = { setValue: (value: string) => void; insertToken: (key: string) => void }
type Props = { value: string; onChange: (value: string) => void }

export const WidgetVisualEditor = forwardRef<WidgetVisualEditorHandle, Props>(function WidgetVisualEditor({ value, onChange }, ref) {
  const valueRef = useRef(value)
  const editor = useEditor({ extensions: [StarterKit.configure({ heading: false, bulletList: false, orderedList: false, blockquote: false, codeBlock: false, horizontalRule: false }), WidgetToken], content: documentToTiptap(parseWidgetDocument(value)), onUpdate: ({ editor: current }) => { const next = serializeWidgetDocument(tiptapToDocument(current.getJSON())); valueRef.current = next; onChange(next) }, editorProps: { attributes: { class: 'widget-tiptap-content', 'aria-label': 'Your text' } } })
  useEffect(() => { if (editor && value !== valueRef.current) { valueRef.current = value; editor.commands.setContent(documentToTiptap(parseWidgetDocument(value))) } }, [editor, value])
  useImperativeHandle(ref, () => ({ setValue: (next) => { valueRef.current = next; editor?.commands.setContent(documentToTiptap(parseWidgetDocument(next))) }, insertToken: (key) => { if (!editor) return; editor.chain().focus().insertContent({ type: 'widgetToken', attrs: { key, source: tokenSource(key) } }).run() } }), [editor])
  return <div className="builder-text"><EditorContent editor={editor} /></div>
})
