import { describe, expect, it } from 'vitest'
import { documentToTiptap, tiptapToDocument } from './widgetDocumentAdapter'
import { parseWidgetDocument, serializeWidgetDocument } from './widgetDocument'

describe('Tiptap widget document adapter', () => {
  it('represents template tokens as inline atomic nodes and round-trips syntax', () => {
    const document = parseWidgetDocument('Hello {{ notes.total }}\nToday')
    const json = documentToTiptap(document)
    expect(json.content?.[0]?.content?.[1]).toMatchObject({ type: 'widgetToken', attrs: { key: 'notes.total', source: '{{ notes.total }}' } })
    expect(serializeWidgetDocument(tiptapToDocument(json as { content: Array<{ type: string; content: Array<{ type: string; text?: string; attrs?: { key?: string; source?: string } }> }> }))).toBe('Hello {{ notes.total }}\nToday')
  })
})
