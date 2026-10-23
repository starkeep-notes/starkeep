import Dexie, { type EntityTable } from 'dexie'
import type { Board, Collection, Note, WebReference } from './types'

export class StarkeepDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>
  collections!: EntityTable<Collection, 'id'>
  webReferences!: EntityTable<WebReference, 'id'>
  boards!: EntityTable<Board, 'id'>

  constructor() {
    super('starkeep')
    this.version(1).stores({
      notes: 'id, updatedAt, collectionId, deletedAt',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
    })
    this.version(2).stores({
      notes: 'id, updatedAt, collectionId, deletedAt, widgetBoardId, widgetGroup',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
    })
    this.version(3).stores({
      notes: 'id, updatedAt, collectionId, boardId, deletedAt, widgetBoardId, widgetGroup',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
      boards: 'id, updatedAt',
    })
  }
}

export const database = new StarkeepDatabase()
