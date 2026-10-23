import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, useEditor, EditorContent } from '@tiptap/react'
import type { ReactNodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { parseWidgetDocument, serializeWidgetDocument } from './widgetDocument'
import { documentToTiptap, tiptapToDocument } from './widgetDocumentAdapter'

const tokenSource = (key: string) => `{{${key}}}`

type TokenViewProps = Pick<ReactNodeViewProps, 'node' | 'updateAttributes'>
type BlockViewProps = Pick<ReactNodeViewProps, 'node' | 'updateAttributes'>
function WidgetMetricView({ node, updateAttributes }: BlockViewProps) {
  const label = String(node.attrs.label ?? '')
  const value = String(node.attrs.value ?? '')
  return <NodeViewWrapper className="widget-block-node" contentEditable={false}><label>Metric label<input aria-label="Metric label" value={label} onChange={(event) => updateAttributes({ label: event.target.value, source: `[metric: ${event.target.value} | ${value}]` })} /></label><label>Value<input aria-label="Metric value" value={value} onChange={(event) => updateAttributes({ value: event.target.value, source: `[metric: ${label} | ${event.target.value}]` })} /></label></NodeViewWrapper>
}
function WidgetProgressView({ node, updateAttributes }: BlockViewProps) {
  const label = String(node.attrs.label ?? '')
  const value = String(node.attrs.value ?? '')
  const maximum = String(node.attrs.maximum ?? '100')
  return <NodeViewWrapper className="widget-block-node" contentEditable={false}><label>Progress label<input aria-label="Progress label" value={label} onChange={(event) => updateAttributes({ label: event.target.value, source: `[progress: ${event.target.value} | ${value} | ${maximum}]` })} /></label><label>Value<input aria-label="Progress value" value={value} onChange={(event) => updateAttributes({ value: event.target.value, source: `[progress: ${label} | ${event.target.value} | ${maximum}]` })} /></label><label>Maximum<input aria-label="Progress maximum" value={maximum} onChange={(event) => updateAttributes({ maximum: event.target.value, source: `[progress: ${label} | ${value} | ${event.target.value}]` })} /></label></NodeViewWrapper>
}

const WidgetMetric = Node.create({ name: 'widgetMetric', group: 'block', atom: true, selectable: true, addAttributes: () => ({ label: { default: 'Metric' }, value: { default: '0' }, source: { default: '' } }), parseHTML: () => [{ tag: 'div[data-widget-metric]' }], renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-widget-metric': '' })], addNodeView: () => ReactNodeViewRenderer(WidgetMetricView) })
const WidgetProgress = Node.create({ name: 'widgetProgress', group: 'block', atom: true, selectable: true, addAttributes: () => ({ label: { default: 'Progress' }, value: { default: '0' }, maximum: { default: '100' }, source: { default: '' } }), parseHTML: () => [{ tag: 'div[data-widget-progress]' }], renderHTML: ({ HTMLAttributes }) => ['div', mergeAttributes(HTMLAttributes, { 'data-widget-progress': '' })], addNodeView: () => ReactNodeViewRenderer(WidgetProgressView) })
function WidgetTokenView({ node, updateAttributes }: TokenViewProps) {
  const key = String(node.attrs.key ?? '')
  const source = String(node.attrs.source ?? '')
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(tokenSource(key))
  const popoverRef = useRef<HTMLSpanElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!open) return
    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || !popoverRef.current?.contains(event.target)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      setOpen(false)
      requestAnimationFrame(() => triggerRef.current?.focus())
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => { document.removeEventListener('pointerdown', closeOnOutsidePointer); document.removeEventListener('keydown', closeOnEscape) }
  }, [open])
  const save = () => {
    const match = draft.trim().match(/^\{\{\s*([\w.]+)(?:\s*\|[^}]+)?\s*\}\}$/)
    if (match) { updateAttributes({ key: match[1], source: draft.trim() }); setOpen(false) }
  }
  return <NodeViewWrapper ref={popoverRef} as="span" className="builder-token-wrap" data-widget-token={key} contentEditable={false}>
    <button ref={triggerRef} type="button" className="builder-token" onClick={() => { setDraft(source || tokenSource(key)); setOpen(true) }} aria-label={`Dynamic value ${key}. Edit token`}>{key}</button>
    {open && <span className="token-popover" role="dialog" aria-label="Edit token syntax"><label>Token syntax<input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') save() }} /></label><span className="token-popover-actions"><button type="button" onClick={save}>Save</button><button type="button" className="text-button" onClick={() => { setOpen(false); requestAnimationFrame(() => triggerRef.current?.focus()) }}>Cancel</button></span></span>}
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

export type WidgetVisualEditorHandle = { setValue: (value: string) => void; insertToken: (key: string) => void; insertBlock: (type: 'heading' | 'metric' | 'progress') => void }
type Props = { value: string; onChange: (value: string) => void }

export const WidgetVisualEditor = forwardRef<WidgetVisualEditorHandle, Props>(function WidgetVisualEditor({ value, onChange }, ref) {
  const valueRef = useRef(value)
  const onChangeRef = useRef(onChange)
  useEffect(() => { onChangeRef.current = onChange }, [onChange])
  const editor = useEditor({ extensions: [StarterKit.configure({ bulletList: false, orderedList: false, blockquote: false, codeBlock: false, horizontalRule: false }), WidgetToken, WidgetMetric, WidgetProgress], content: documentToTiptap(parseWidgetDocument(value)), onUpdate: ({ editor: current }) => { const next = serializeWidgetDocument(tiptapToDocument(current.getJSON())); if (next !== valueRef.current) { valueRef.current = next; onChangeRef.current(next) } }, editorProps: { attributes: { class: 'widget-tiptap-content', 'aria-label': 'Your text' } } })
  useEffect(() => { if (editor && value !== valueRef.current) { valueRef.current = value; editor.commands.setContent(documentToTiptap(parseWidgetDocument(value)), { emitUpdate: false }) } }, [editor, value])
  useImperativeHandle(ref, () => ({ setValue: (next) => { valueRef.current = next; editor?.commands.setContent(documentToTiptap(parseWidgetDocument(next)), { emitUpdate: false }) }, insertToken: (key) => { if (!editor) return; editor.chain().focus().insertContent({ type: 'widgetToken', attrs: { key, source: tokenSource(key) } }).run() }, insertBlock: (type) => { if (!editor) return; const content = type === 'heading' ? { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'New heading' }] } : type === 'metric' ? { type: 'widgetMetric', attrs: { label: 'Metric', value: '0', source: '[metric: Metric | 0]' } } : { type: 'widgetProgress', attrs: { label: 'Progress', value: '0', maximum: '100', source: '[progress: Progress | 0 | 100]' } }; editor.chain().focus().insertContent(content).run() } }), [editor])
  return <div className="builder-text"><EditorContent editor={editor} /></div>
})
