import type Delta from 'quill-delta'

export type NoteContent = Delta

export type Note = {
  id: string
  title: string
  content: NoteContent
  collectionId?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type Collection = {
  id: string
  name: string
  parentId?: string
  createdAt: number
  updatedAt: number
}

export type WebReference = {
  id: string
  noteId: string
  url: string
  title?: string
  selectedText?: string
}
