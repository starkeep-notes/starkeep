import type { JSONContent } from '@tiptap/core'
import type { InlinePart, WidgetDocument } from './widgetDocument'

const tokenSource = (key: string) => `{{${key}}}`

const inlineContent = (parts: InlinePart[]) => parts.flatMap((part): JSONContent[] => {
  if (part.type === 'token') return [{ type: 'widgetToken', attrs: { key: part.key, source: part.source ?? tokenSource(part.key) } }]
  return part.text ? [{ type: 'text', text: part.text }] : []
})

export function documentToTiptap(document: WidgetDocument): JSONContent {
  return { type: 'doc', content: document.blocks.map((block) => {
    if (block.type === 'heading') return { type: 'heading', attrs: { level: block.level }, content: inlineContent(block.parts) }
    if (block.type === 'metric') return { type: 'widgetMetric', attrs: { label: block.label, value: block.value, source: block.source ?? '' } }
    if (block.type === 'progress') return { type: 'widgetProgress', attrs: { label: block.label, value: block.value, maximum: block.maximum, source: block.source ?? '' } }
    return { type: 'paragraph', content: inlineContent(block.parts) }
  }) }
}

type TiptapBlock = { type?: string; attrs?: { level?: number; label?: string; value?: string; maximum?: string; source?: string }; content?: Array<{ type?: string; text?: string; attrs?: { key?: string; source?: string } }> }
export function tiptapToDocument(json: { content?: TiptapBlock[] }): WidgetDocument {
  return { blocks: (json.content ?? []).map((block, index) => {
    const id = `${block.type ?? 'text'}-${index}`
    if (block.type === 'heading') return { type: 'heading' as const, id, level: Math.min(3, Math.max(1, block.attrs?.level ?? 1)) as 1 | 2 | 3, parts: (block.content ?? []).map((part) => part.type === 'widgetToken' ? { type: 'token' as const, key: String(part.attrs?.key ?? ''), source: part.attrs?.source } : { type: 'text' as const, text: part.text ?? '' }) }
    if (block.type === 'widgetMetric') return { type: 'metric' as const, id, label: block.attrs?.label ?? '', value: block.attrs?.value ?? '', source: block.attrs?.source || undefined }
    if (block.type === 'widgetProgress') return { type: 'progress' as const, id, label: block.attrs?.label ?? '', value: block.attrs?.value ?? '', maximum: block.attrs?.maximum ?? '100', source: block.attrs?.source || undefined }
    return { type: 'text' as const, id, parts: (block.content ?? []).map((part) => part.type === 'widgetToken' ? { type: 'token' as const, key: part.attrs?.key ?? '', source: part.attrs?.source ?? tokenSource(part.attrs?.key ?? '') } : { type: 'text' as const, text: part.text ?? '' }) }
  }) }
}
