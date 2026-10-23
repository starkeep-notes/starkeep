import Delta from 'quill-delta'
import { database } from './db'
import type { Board, Collection, Note, WebReference } from './types'

export const BACKUP_FORMAT = 'starkeep-notebook'
export const BACKUP_VERSION = 2

type BackupPayload = {
  format: typeof BACKUP_FORMAT
  version: 1 | typeof BACKUP_VERSION
  exportedAt: string
  notes: Array<Omit<Note, 'content'> & { content: { ops: unknown[] } }>
  collections: Collection[]
  webReferences: WebReference[]
  boards: Board[]
}

export type ImportMode = 'merge' | 'replace'
export type ImportSummary = { notes: number; collections: number; webReferences: number; boards: number; mode: ImportMode }

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null
const isId = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0
const isTimestamp = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const isOptionalTimestamp = (value: unknown): value is number | undefined => value === undefined || isTimestamp(value)
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message) }

function validatePayload(value: unknown): BackupPayload {
  assert(isRecord(value), 'The backup must contain a JSON object.')
  assert(value.format === BACKUP_FORMAT, 'This file is not a Starkeep backup.')
  assert(value.version === 1 || value.version === BACKUP_VERSION, `Unsupported backup version: ${String(value.version)}.`)
  assert(typeof value.exportedAt === 'string', 'The backup is missing its export date.')
  assert(Array.isArray(value.notes) && Array.isArray(value.collections), 'The backup must contain notes and collections arrays.')
  assert(value.webReferences === undefined || Array.isArray(value.webReferences), 'Web references must be an array.')
  assert(value.boards === undefined || Array.isArray(value.boards), 'Boards must be an array.')
  const collections = value.collections as unknown[]
  const notes = value.notes as unknown[]
  const webReferences = (value.webReferences ?? []) as unknown[]
  const boards = (value.boards ?? []) as unknown[]
  const collectionIds = new Set<string>()
  const noteIds = new Set<string>()
  const referenceIds = new Set<string>()
  const boardIds = new Set<string>()
  collections.forEach((item, index) => {
    assert(isRecord(item) && isId(item.id) && typeof item.name === 'string' && item.name.trim(), `Collection ${index + 1} is invalid.`)
    assert(isTimestamp(item.createdAt) && isTimestamp(item.updatedAt), `Collection ${index + 1} has invalid timestamps.`)
    assert(item.parentId === undefined || isId(item.parentId), `Collection ${index + 1} has an invalid parent.`)
    assert(!collectionIds.has(item.id), `Duplicate collection ID: ${item.id}.`)
    collectionIds.add(item.id)
  })
  boards.forEach((item, index) => {
    assert(isRecord(item) && isId(item.id) && typeof item.name === 'string' && item.name.trim(), `Board ${index + 1} is invalid.`)
    assert(isTimestamp(item.createdAt) && isTimestamp(item.updatedAt), `Board ${index + 1} has invalid timestamps.`)
    assert(!boardIds.has(item.id), `Duplicate board ID: ${item.id}.`)
    boardIds.add(item.id)
  })
  notes.forEach((item, index) => {
    assert(isRecord(item) && isId(item.id) && typeof item.title === 'string', `Note ${index + 1} is invalid.`)
    assert(isRecord(item.content) && Array.isArray(item.content.ops), `Note ${index + 1} has invalid editor content.`)
    assert(isTimestamp(item.createdAt) && isTimestamp(item.updatedAt) && isOptionalTimestamp(item.deletedAt), `Note ${index + 1} has invalid timestamps.`)
    assert(item.collectionId === undefined || isId(item.collectionId), `Note ${index + 1} has an invalid collection.`)
    assert(item.widgetBoardId === undefined || isId(item.widgetBoardId), `Note ${index + 1} has an invalid board.`)
    assert(item.widgetHeight === undefined || item.widgetHeight === 'short' || item.widgetHeight === 'medium' || item.widgetHeight === 'tall', `Note ${index + 1} has an invalid widget height.`)
    assert(item.widgetGroup === undefined || (typeof item.widgetGroup === 'string' && item.widgetGroup.trim()), `Note ${index + 1} has an invalid widget group.`)
    try { new Delta(item.content as never) } catch { throw new Error(`Note ${index + 1} has unreadable editor content.`) }
    assert(!noteIds.has(item.id), `Duplicate note ID: ${item.id}.`)
    noteIds.add(item.id)
  })
  webReferences.forEach((item, index) => {
    assert(isRecord(item) && isId(item.id) && isId(item.noteId) && typeof item.url === 'string', `Web reference ${index + 1} is invalid.`)
    assert(/^https?:\/\//i.test(item.url), `Web reference ${index + 1} must use an HTTP or HTTPS URL.`)
    assert(item.title === undefined || typeof item.title === 'string', `Web reference ${index + 1} has an invalid title.`)
    assert(item.selectedText === undefined || typeof item.selectedText === 'string', `Web reference ${index + 1} has invalid selected text.`)
    assert(!referenceIds.has(item.id), `Duplicate web reference ID: ${item.id}.`)
    referenceIds.add(item.id)
  })
  collections.forEach((raw) => { const item = raw as Record<string, unknown>; assert(item.parentId === undefined || collectionIds.has(item.parentId as string), `Collection ${item.id as string} refers to a missing parent.`) })
  notes.forEach((raw) => { const item = raw as Record<string, unknown>; assert(item.collectionId === undefined || collectionIds.has(item.collectionId as string), `Note ${item.id as string} refers to a missing collection.`); assert(item.widgetBoardId === undefined || boardIds.has(item.widgetBoardId as string), `Note ${item.id as string} refers to a missing board.`) })
  webReferences.forEach((raw) => { const item = raw as Record<string, unknown>; assert(noteIds.has(item.noteId as string), `Web reference ${item.id as string} refers to a missing note.`) })
  return { format: BACKUP_FORMAT, version: value.version as 1 | typeof BACKUP_VERSION, exportedAt: value.exportedAt, notes: notes as BackupPayload['notes'], collections: collections as Collection[], webReferences: webReferences as WebReference[], boards: boards as Board[] }
}

export async function exportBackup(): Promise<BackupPayload> {
  const [notes, collections, webReferences, boards] = await Promise.all([database.notes.toArray(), database.collections.toArray(), database.webReferences.toArray(), database.boards.toArray()])
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), notes: notes.map((note) => ({ ...note, content: note.content instanceof Delta ? { ops: note.content.ops } : note.content })), collections, webReferences, boards }
}

const nextId = (used: Set<string>) => { let id = crypto.randomUUID(); while (used.has(id)) id = crypto.randomUUID(); used.add(id); return id }

export async function importBackup(input: unknown, mode: ImportMode): Promise<ImportSummary> {
  const payload = validatePayload(input)
  const existing = mode === 'merge' ? await Promise.all([database.notes.toArray(), database.collections.toArray(), database.webReferences.toArray(), database.boards.toArray()]) : [[], [], [], []] as const
  const usedNotes = new Set(existing[0].map((item) => item.id))
  const usedCollections = new Set(existing[1].map((item) => item.id))
  const usedReferences = new Set(existing[2].map((item) => item.id))
  const usedBoards = new Set(existing[3].map((item) => item.id))
  const noteIds = new Map(payload.notes.map((item) => [item.id, mode === 'merge' && usedNotes.has(item.id) ? nextId(usedNotes) : (usedNotes.add(item.id), item.id)]))
  const collectionIds = new Map(payload.collections.map((item) => [item.id, mode === 'merge' && usedCollections.has(item.id) ? nextId(usedCollections) : (usedCollections.add(item.id), item.id)]))
  const referenceIds = new Map(payload.webReferences.map((item) => [item.id, mode === 'merge' && usedReferences.has(item.id) ? nextId(usedReferences) : (usedReferences.add(item.id), item.id)]))
  const boardIds = new Map(payload.boards.map((item) => [item.id, mode === 'merge' && usedBoards.has(item.id) ? nextId(usedBoards) : (usedBoards.add(item.id), item.id)]))
  const notes = payload.notes.map((item) => ({ ...item, id: noteIds.get(item.id)!, collectionId: item.collectionId ? collectionIds.get(item.collectionId) : undefined, widgetBoardId: item.widgetBoardId ? boardIds.get(item.widgetBoardId) : undefined, content: new Delta(item.content as never) })) as Note[]
  const collections = payload.collections.map((item) => ({ ...item, id: collectionIds.get(item.id)!, parentId: item.parentId ? collectionIds.get(item.parentId) : undefined }))
  const webReferences = payload.webReferences.map((item) => ({ ...item, id: referenceIds.get(item.id)!, noteId: noteIds.get(item.noteId)! }))
  const boards = payload.boards.map((item) => ({ ...item, id: boardIds.get(item.id)! }))
  await database.transaction('rw', database.notes, database.collections, database.webReferences, database.boards, async () => {
    if (mode === 'replace') { await database.webReferences.clear(); await database.notes.clear(); await database.collections.clear(); await database.boards.clear() }
    await database.collections.bulkPut(collections)
    await database.notes.bulkPut(notes)
    await database.webReferences.bulkPut(webReferences)
    await database.boards.bulkPut(boards)
  })
  return { notes: notes.length, collections: collections.length, webReferences: webReferences.length, boards: boards.length, mode }
}
