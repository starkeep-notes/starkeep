import type Delta from 'quill-delta'

export type NoteContent = Delta

export type Note = {
  id: string
  title: string
  content: NoteContent
  collectionId?: string
  boardId?: string
  isWidget?: boolean
  widgetStyle?: 'cream' | 'yellow' | 'blue' | 'green' | 'ink'
  widgetPinned?: boolean
  widgetHidden?: boolean
  widgetOrder?: number
  widgetSize?: 'small' | 'medium' | 'large' | 'wide'
  /** Persisted board-note width, expressed as a grid column span. */
  boardSize?: 'tiny' | 'small' | 'medium' | 'large'
  /** Persisted board-note height. */
  boardHeight?: 'short' | 'medium' | 'tall'
  widgetHeight?: 'short' | 'medium' | 'tall'
  widgetBoardId?: string
  /** @deprecated legacy display label, migrated to groupId on database upgrade. */
  widgetGroup?: string
  groupId?: string
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export type Board = {
  id: string
  name: string
  createdAt: number
  updatedAt: number
}

export type BoardGroup = {
  id: string
  boardId: string
  name: string
  order: number
  columnSpan: 1 | 2 | 3 | 4
  verticalSize: 'compact' | 'normal' | 'tall'
  collapsed: boolean
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
