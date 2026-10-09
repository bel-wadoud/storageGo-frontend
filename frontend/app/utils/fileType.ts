import type { IconName } from './icons'

// The server never sees file names, so the type is worked out here from the extension.
export type FileType = 'folder' | 'pdf' | 'image' | 'video' | 'audio' | 'text' | 'document' | 'spreadsheet' | 'presentation' | 'archive' | 'other'

const BY_EXTENSION: Record<string, FileType> = {
  pdf: 'pdf',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', heic: 'image', bmp: 'image', avif: 'image',
  mp4: 'video', webm: 'video', mov: 'video', mkv: 'video', avi: 'video',
  mp3: 'audio', wav: 'audio', ogg: 'audio', m4a: 'audio', flac: 'audio', aac: 'audio',
  txt: 'text', md: 'text', csv: 'text', json: 'text', xml: 'text', log: 'text',
  doc: 'document', docx: 'document', odt: 'document', rtf: 'document',
  xls: 'spreadsheet', xlsx: 'spreadsheet', ods: 'spreadsheet',
  ppt: 'presentation', pptx: 'presentation', odp: 'presentation',
  zip: 'archive', rar: 'archive', '7z': 'archive', tar: 'archive', gz: 'archive',
}

const ICONS: Record<FileType, IconName> = {
  folder: 'folder',
  pdf: 'file',
  image: 'image',
  video: 'video',
  audio: 'music',
  text: 'file',
  document: 'file',
  spreadsheet: 'sheet',
  presentation: 'file',
  archive: 'archive',
  other: 'file',
}

/** MIME types for previews built from decrypted bytes (the bytes themselves carry no type). */
const MIME: Partial<Record<string, string>> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', avif: 'image/avif', bmp: 'image/bmp',
  mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime',
  mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', aac: 'audio/aac', flac: 'audio/flac',
  txt: 'text/plain', md: 'text/plain', csv: 'text/plain', json: 'text/plain', xml: 'text/plain', log: 'text/plain',
}

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function fileType(name: string, kind: 'file' | 'folder' = 'file'): FileType {
  if (kind === 'folder') return 'folder'
  return BY_EXTENSION[extensionOf(name)] ?? 'other'
}

export function fileIcon(type: FileType): IconName {
  return ICONS[type]
}

export function mimeFor(name: string): string {
  return MIME[extensionOf(name)] ?? 'application/octet-stream'
}

/** Types the browser can show safely without plugins. Everything else is offered as a download. */
export function previewable(name: string): 'image' | 'pdf' | 'text' | 'video' | 'audio' | null {
  const type = fileType(name)
  if (type === 'image' && extensionOf(name) !== 'heic' && extensionOf(name) !== 'svg') return 'image'
  if (type === 'pdf' || type === 'text' || type === 'video' || type === 'audio') return type
  return null
}
