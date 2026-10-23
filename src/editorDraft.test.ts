import { describe, expect, it } from 'vitest'
import Delta from 'quill-delta'
import { plainContent, plainText } from './editorDraft'

describe('note/widget draft conversion', () => {
  it('flattens formatted notes and embeds to widget syntax only as plain text', () => {
    const note = new Delta().insert('Hello ', { bold: true }).insert({ image: 'data:image/png;base64,x' }).insert('{{ notes.total }}\n')
    expect(plainText(note)).toBe('Hello {{ notes.total }}')
    expect(plainContent(plainText(note)).ops).toEqual([{ insert: 'Hello {{ notes.total }}\n' }])
  })

  it('keeps a widget draft as plain Quill content when switching back to Note', () => {
    const widgetText = 'First line\n[metric: Total | {{ notes.total }}]'
    const note = plainContent(widgetText)
    expect(note.ops).toEqual([{ insert: `${widgetText}\n` }])
    expect(plainText(note)).toBe(widgetText)
    expect(note.ops.some((op) => op.attributes)).toBe(false)
  })

  it('preserves actual line breaks, not literal backslash-n, in both directions', () => {
    const syntax = '# Heading\n{{ notes.total }}\n'
    const content = plainContent(syntax)
    expect(content.ops).toEqual([{ insert: '# Heading\n{{ notes.total }}\n\n' }])
    expect(plainText(content)).toBe(syntax)
    expect(plainText(plainContent(''))).toBe('')
  })
})
