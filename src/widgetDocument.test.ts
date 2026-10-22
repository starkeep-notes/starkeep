import { describe, expect, it } from 'vitest'
import { insertTokenAfterBlock, mergeWidgetBlocks, parseInlineParts, parseWidgetDocument, serializeWidgetDocument, splitTextBlock, updateTextPart } from './widgetDocument'

describe('structured widget documents', () => {
  it('round-trips text, tokens, and blocks to template syntax', () => {
    const source = 'Hello {{ notes.total }}\nToday: {{date.today}}'
    expect(serializeWidgetDocument(parseWidgetDocument(source))).toBe(source)
  })

  it('keeps token parts separate from surrounding text', () => {
    expect(parseInlineParts('A {{x}} B')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'token', key: 'x', source: '{{x}}' },
      { type: 'text', text: ' B' },
    ])
  })

  it('splits and merges blocks without losing inline parts', () => {
    const document = parseWidgetDocument('Hello world')
    const split = splitTextBlock(document, 0, 0, 5)
    expect(serializeWidgetDocument(split)).toBe('Hello\n world')
    expect(serializeWidgetDocument(mergeWidgetBlocks(split, 0, 1))).toBe('Hello world')
  })

  it('round-trips headings, metrics, and progress blocks', () => {
    const source = '# Overview\n[metric: Notes | {{notes.total}}]\n[progress: Goal | 62 | 100]'
    const document = parseWidgetDocument(source)
    expect(document.blocks.map((block) => block.type)).toEqual(['heading', 'metric', 'progress'])
    expect(serializeWidgetDocument(document)).toBe(source)
  })

  it('updates text and inserts a token in the selected block', () => {
    let document = parseWidgetDocument('Draft\nSecond')
    document = updateTextPart(document, 1, 0, 'Updated')
    document = insertTokenAfterBlock(document, 1, 'notes.total')
    expect(serializeWidgetDocument(document)).toBe('Draft\nUpdated\n{{notes.total}}')
  })
})
