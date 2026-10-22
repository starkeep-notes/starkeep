export type TextPart = { type: 'text'; text: string }
export type TokenPart = { type: 'token'; key: string; source?: string }
export type InlinePart = TextPart | TokenPart
export type TextBlock = { type: 'text'; id: string; parts: InlinePart[] }
export type DocumentBlock = TextBlock
export type WidgetDocument = { blocks: DocumentBlock[] }

const tokenPattern = /{{\s*([\w.]+)(?:\s*\|[^}]+)?\s*}}/g

export function parseInlineParts(template: string): InlinePart[] {
  const parts: InlinePart[] = []
  let cursor = 0
  template.replace(tokenPattern, (source, key: string, offset: number) => {
    if (offset > cursor) parts.push({ type: 'text', text: template.slice(cursor, offset) })
    parts.push({ type: 'token', key, source })
    cursor = offset + source.length
    return source
  })
  if (cursor < template.length || parts.length === 0) parts.push({ type: 'text', text: template.slice(cursor) })
  return parts
}

export function parseWidgetDocument(template: string): WidgetDocument {
  const lines = template.split('\n')
  return { blocks: lines.map((line, index) => ({ type: 'text', id: `text-${index}`, parts: parseInlineParts(line) })) }
}

export function serializeInlineParts(parts: InlinePart[]): string {
  return parts.map((part) => part.type === 'token' ? part.source ?? `{{${part.key}}}` : part.text).join('')
}

export function serializeWidgetDocument(document: WidgetDocument): string {
  return document.blocks.map((block) => block.type === 'text' ? serializeInlineParts(block.parts) : '').join('\n')
}

export function logicalLength(parts: InlinePart[]): number {
  return serializeInlineParts(parts).length
}

export function replaceToken(parts: InlinePart[], index: number, key: string): InlinePart[] {
  return parts.map((part, partIndex) => partIndex === index && part.type === 'token' ? { type: 'token', key } : part)
}

function textPart(text: string): TextPart { return { type: 'text', text } }
function copyBlock(block: TextBlock, parts: InlinePart[], id = block.id): TextBlock { return { type: 'text', id, parts } }

export function updateTextPart(document: WidgetDocument, blockIndex: number, partIndex: number, text: string): WidgetDocument {
  return { blocks: document.blocks.map((block, index) => index !== blockIndex ? block : copyBlock(block, block.parts.map((part, partIndexToUpdate) => partIndexToUpdate === partIndex && part.type === 'text' ? textPart(text) : part))) }
}

export function splitTextBlock(document: WidgetDocument, blockIndex: number, partIndex: number, offset: number): WidgetDocument {
  const block = document.blocks[blockIndex]
  const part = block?.parts[partIndex]
  if (!block || !part || part.type !== 'text') return document
  const before = [...block.parts.slice(0, partIndex), textPart(part.text.slice(0, offset))]
  const after = [textPart(part.text.slice(offset)), ...block.parts.slice(partIndex + 1)]
  const blocks = [...document.blocks]
  blocks.splice(blockIndex, 1, copyBlock(block, before), copyBlock(block, after, `${block.id}-next`))
  return { blocks }
}

export function mergeWidgetBlocks(document: WidgetDocument, firstIndex: number, secondIndex: number): WidgetDocument {
  const first = document.blocks[firstIndex]
  const second = document.blocks[secondIndex]
  if (!first || !second || secondIndex !== firstIndex + 1) return document
  const parts = [...first.parts]
  if (parts.at(-1)?.type === 'text' && second.parts[0]?.type === 'text') {
    const left = parts.pop() as TextPart
    const right = second.parts[0] as TextPart
    parts.push(textPart(left.text + right.text), ...second.parts.slice(1))
  } else parts.push(...second.parts)
  const blocks = document.blocks.filter((_, index) => index !== secondIndex).map((block, index) => index === firstIndex ? copyBlock(first, parts) : block)
  return { blocks: blocks.length ? blocks : [{ type: 'text', id: 'text-0', parts: [textPart('')] }] }
}

export function insertTokenAfterBlock(document: WidgetDocument, blockIndex: number, key: string): WidgetDocument {
  const block = document.blocks[blockIndex] ?? document.blocks.at(-1)
  if (!block) return { blocks: [{ type: 'text', id: 'text-0', parts: [{ type: 'token', key }] }] }
  const index = document.blocks.indexOf(block)
  const tokenBlock = { type: 'text' as const, id: `${block.id}-value-${document.blocks.length}`, parts: [{ type: 'token' as const, key }, textPart('')] }
  const blocks = [...document.blocks]
  blocks.splice(index + 1, 0, tokenBlock)
  return { blocks }
}
