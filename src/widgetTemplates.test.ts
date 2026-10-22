import { describe, expect, it } from 'vitest'
import Delta from 'quill-delta'
import { createTemplateValues, renderWidgetTemplate } from './widgetTemplates'
import type { Note } from './types'

const makeNote = (overrides: Partial<Note> = {}): Note => {
  const timestamp = Date.now()
  return {
    id: crypto.randomUUID(),
    title: 'Test note',
    content: new Delta([{ insert: 'hello world\n' }]),
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  }
}

describe('widget template values', () => {
  it('calculates live note statistics and excludes deleted notes and widgets', () => {
    const now = Date.now()
    const notes = [
      makeNote({ title: 'Latest', content: new Delta([{ insert: 'one two three\n' }]), collectionId: 'ideas', createdAt: now, updatedAt: now }),
      makeNote({ title: 'Older', content: new Delta([{ insert: 'four five\n' }]), collectionId: 'work', createdAt: now - 8 * 24 * 60 * 60 * 1000, updatedAt: now - 8 * 24 * 60 * 60 * 1000 }),
      makeNote({ isWidget: true, content: new Delta([{ insert: 'widget words\n' }]) }),
      makeNote({ deletedAt: now, content: new Delta([{ insert: 'deleted words\n' }]) }),
    ]

    const values = createTemplateValues(notes)

    expect(values['notes.total']).toBe('2')
    expect(values['notes.words']).toBe('5')
    expect(values['notes.collections']).toBe('2')
    expect(values['notes.widgets']).toBe('1')
    expect(values['notes.created_today']).toBe('1')
    expect(values['notes.updated_week']).toBe('1')
    expect(values['notes.latest_title']).toBe('Latest')
  })

  it('handles an empty notebook', () => {
    const values = createTemplateValues([])

    expect(values['notes.total']).toBe('0')
    expect(values['notes.words']).toBe('0')
    expect(values['notes.latest_title']).toBe('No notes yet')
    expect(values['notes.latest_date']).toBe('—')
  })
})

describe('renderWidgetTemplate', () => {
  it('replaces known variables and preserves unknown variables', () => {
    expect(renderWidgetTemplate('Count: {{ notes.total }} / {{notes.missing}}', { 'notes.total': '7' })).toBe('Count: 7 / {{notes.missing}}')
  })

  it('supports optional pipe labels while resolving the variable', () => {
    expect(renderWidgetTemplate('{{notes.total | number}} notes', { 'notes.total': '12' })).toBe('12 notes')
  })
})
