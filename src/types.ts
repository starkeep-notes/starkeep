export type Note = {
  id: string
  title: string
  content: string
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
