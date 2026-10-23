import Delta from 'quill-delta'
import type { NoteContent } from './types'

// Quill requires a final newline; widget syntax does not include that sentinel.
export function plainText(content: NoteContent): string {
  return content.ops.map((op) => typeof op.insert === 'string' ? op.insert : '').join('').replace(/\n$/, '')
}

export function plainContent(text: string): NoteContent {
  return new Delta().insert(`${text}\n`)
}
