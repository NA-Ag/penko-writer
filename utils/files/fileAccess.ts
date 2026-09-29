/**
 * Reading and writing files on disk.
 *
 * Chromium browsers have the File System Access API: files are opened and
 * saved through native pickers and the returned `FileSystemFileHandle` lets
 * the app write the same file again later (after the user grants
 * permission). Firefox and Safari don't: files are opened with
 * `<input type=file>` and "saving" downloads a copy.
 */

export type DiskFormat = 'penko' | 'docx';

/** Minimal typings for the parts of the File System Access API we use (not in TS's DOM lib yet). */
export interface FsaPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}
export interface FsaWritable {
  write(data: Blob | BufferSource | string): Promise<void>;
  close(): Promise<void>;
  abort?(): Promise<void>;
}
export interface FsaFileHandle {
  kind: 'file';
  name: string;
  getFile(): Promise<File>;
  createWritable?(): Promise<FsaWritable>;
  queryPermission?(d?: FsaPermissionDescriptor): Promise<PermissionState>;
  requestPermission?(d?: FsaPermissionDescriptor): Promise<PermissionState>;
  isSameEntry?(other: FsaFileHandle): Promise<boolean>;
}
interface FsaPickerType {
  description?: string;
  accept: Record<string, string[]>;
}
interface FsaWindow {
  showOpenFilePicker?: (opts?: { types?: FsaPickerType[]; excludeAcceptAllOption?: boolean; multiple?: boolean; id?: string }) => Promise<FsaFileHandle[]>;
  showSaveFilePicker?: (opts?: { suggestedName?: string; types?: FsaPickerType[]; excludeAcceptAllOption?: boolean; id?: string }) => Promise<FsaFileHandle>;
}

const fsaWindow = () => (typeof window === 'undefined' ? {} : (window as unknown as FsaWindow));

/** True when files can be opened and saved in place (Chromium desktop). */
export const canOpenInPlace = () => typeof fsaWindow().showOpenFilePicker === 'function';
export const canSaveInPlace = () => typeof fsaWindow().showSaveFilePicker === 'function';

export const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

const PENKO_TYPE: FsaPickerType = { description: 'Penko document', accept: { 'application/vnd.penko.document': ['.penko'] } };
const DOCX_TYPE: FsaPickerType = { description: 'Word document', accept: { [DOCX_MIME]: ['.docx'] } };
const OPEN_TYPES: FsaPickerType[] = [
  {
    description: 'Documents',
    accept: {
      'application/vnd.penko.document': ['.penko'],
      [DOCX_MIME]: ['.docx'],
      'application/msword': ['.doc'],
      'application/vnd.oasis.opendocument.text': ['.odt'],
      'application/rtf': ['.rtf'],
      'text/markdown': ['.md', '.markdown'],
      'text/html': ['.html', '.htm'],
      'text/plain': ['.txt'],
    },
  },
];

export const isAbortError = (e: unknown) => !!e && typeof e === 'object' && (e as { name?: string }).name === 'AbortError';

/** Native open picker. Returns null when the user cancels. */
export const pickFileToOpen = async (): Promise<{ file: File; handle: FsaFileHandle } | null> => {
  const picker = fsaWindow().showOpenFilePicker;
  if (!picker) return null;
  try {
    const [handle] = await picker({ types: OPEN_TYPES, multiple: false, id: 'penko-documents' });
    if (!handle) return null;
    return { file: await handle.getFile(), handle };
  } catch (e) {
    if (isAbortError(e)) return null;
    throw e;
  }
};

/** Native save picker. Returns null when the user cancels. */
export const pickFileToSave = async (suggestedName: string, preferred: DiskFormat): Promise<FsaFileHandle | null> => {
  const picker = fsaWindow().showSaveFilePicker;
  if (!picker) return null;
  try {
    return await picker({ suggestedName, types: preferred === 'docx' ? [DOCX_TYPE, PENKO_TYPE] : [PENKO_TYPE, DOCX_TYPE], id: 'penko-documents' });
  } catch (e) {
    if (isAbortError(e)) return null;
    throw e;
  }
};

/**
 * Makes sure we may write to a handle. `request` must only be true inside a
 * user gesture (click / key press); background auto-save only queries.
 */
export const ensureWritePermission = async (handle: FsaFileHandle, request: boolean): Promise<boolean> => {
  const opts: FsaPermissionDescriptor = { mode: 'readwrite' };
  try {
    if (!handle.queryPermission) return true;
    if ((await handle.queryPermission(opts)) === 'granted') return true;
    if (!request || !handle.requestPermission) return false;
    return (await handle.requestPermission(opts)) === 'granted';
  } catch {
    return false;
  }
};

export const ensureReadPermission = async (handle: FsaFileHandle): Promise<boolean> => {
  try {
    if (!handle.queryPermission) return true;
    if ((await handle.queryPermission({ mode: 'read' })) === 'granted') return true;
    return !!handle.requestPermission && (await handle.requestPermission({ mode: 'read' })) === 'granted';
  } catch {
    return false;
  }
};

/** Writes the whole file (the browser swaps it in atomically on close). */
export const writeToHandle = async (handle: FsaFileHandle, blob: Blob) => {
  if (!handle.createWritable) throw new Error('This file cannot be written');
  const writable = await handle.createWritable();
  try {
    await writable.write(blob);
    await writable.close();
  } catch (e) {
    await writable.abort?.().catch(() => undefined);
    throw e;
  }
};

/** Format implied by a file name (null when it's neither .penko nor .docx). */
export const formatOfName = (name: string): DiskFormat | null => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.penko')) return 'penko';
  if (lower.endsWith('.docx')) return 'docx';
  return null;
};

/** `name` with the extension of `format` (replacing .penko / .docx if present). */
export const withExtension = (name: string, format: DiskFormat): string => {
  const base = name.trim().replace(/\.(penko|docx)$/i, '') || 'Document';
  return `${base}.${format}`;
};

/** Extensions the app can open (lower case, without the dot). */
export const OPENABLE_EXTENSIONS = ['penko', 'docx', 'doc', 'odt', 'rtf', 'md', 'markdown', 'html', 'htm', 'txt'];
export const isOpenableName = (name: string) => OPENABLE_EXTENSIONS.includes((name.toLowerCase().split('.').pop() || '').trim());

/** A file name from a document title (no path separators or reserved characters). */
export const safeName = (title: string | undefined, fallback: string) =>
  (title || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '_').replace(/\s+/g, ' ').trim().slice(0, 120) || fallback;
