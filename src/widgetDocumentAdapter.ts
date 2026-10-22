import type { JSONContent } from '@tiptap/core'
import type { WidgetDocument } from './widgetDocument'

const tokenSource = (key: string) => `{{${key}}}`

export function documentToTiptap(document: WidgetDocument): JSONContent {
  return { type: 'doc', content: document.blocks.map((block) => ({ type: 'paragraph', content: block.parts.flatMap((part): JSONContent[] => part.type === 'token' ? [{ type: 'widgetToken', attrs: { key: part.key, source: part.source ?? tokenSource(part.key) } }] : part.text ? [{ type: 'text', text: part.text }] : []) })) }
}

export function tiptapToDocument(json: { content?: Array<{ type?: string; content?: Array<{ type?: string; text?: string; attrs?: { key?: string; source?: string } }> }> }): WidgetDocument {
  return { blocks: (json.content ?? []).map((block, index) => ({ type: 'text' as const, id: `text-${index}`, parts: (block.content ?? []).map((part) => part.type === 'widgetToken' ? { type: 'token' as const, key: part.attrs?.key ?? '', source: part.attrs?.source ?? tokenSource(part.attrs?.key ?? '') } : { type: 'text' as const, text: part.text ?? '' }) })) }
}
