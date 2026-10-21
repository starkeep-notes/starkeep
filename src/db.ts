import Dexie, { type EntityTable } from 'dexie'
import type { Collection, Note, WebReference } from './types'

export class StarkeepDatabase extends Dexie {
  notes!: EntityTable<Note, 'id'>
  collections!: EntityTable<Collection, 'id'>
  webReferences!: EntityTable<WebReference, 'id'>

  constructor() {
    super('starkeep')
    this.version(1).stores({
      notes: 'id, updatedAt, collectionId, deletedAt',
      collections: 'id, parentId, updatedAt',
      webReferences: 'id, noteId, url',
    })
  }
}

export const database = new StarkeepDatabase()
