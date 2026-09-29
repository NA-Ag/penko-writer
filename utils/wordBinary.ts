/**
 * Best-effort text extraction from legacy binary Word files (.doc, Word
 * 97-2003 and Word 6/95). Reads the Compound File (CFB/OLE2) container,
 * then the main document text via the FIB and the piece table (CLX) in the
 * table stream. Formatting is not recovered — only paragraphs, line breaks
 * and table cells (tab separated).
 */

const ENDOFCHAIN = 0xfffffffe;
const FREESECT = 0xffffffff;

interface DirEntry {
  name: string;
  type: number;
  start: number;
  size: number;
}

export class CfbReader {
  private view: DataView;
  private sectorSize: number;
  private miniSectorSize: number;
  private miniCutoff: number;
  private fat: number[] = [];
  private miniFat: number[] = [];
  private entries: DirEntry[] = [];
  private miniStream: Uint8Array | null = null;

  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (!CfbReader.isCfb(bytes)) throw new Error('Not a compound file');
    this.sectorSize = 1 << this.view.getUint16(0x1e, true);
    this.miniSectorSize = 1 << this.view.getUint16(0x20, true);
    this.miniCutoff = this.view.getUint32(0x38, true) || 4096;
    this.readFat();
    this.readDirectory();
  }

  static isCfb(bytes: Uint8Array) {
    const sig = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
    return bytes.length >= 512 && sig.every((b, i) => bytes[i] === b);
  }

  private sectorOffset(n: number) {
    return (n + 1) * this.sectorSize;
  }

  private u32(off: number) {
    return off + 4 <= this.bytes.length ? this.view.getUint32(off, true) : FREESECT;
  }

  private readFat() {
    const difat: number[] = [];
    for (let i = 0; i < 109; i++) difat.push(this.u32(0x4c + i * 4));
    let next = this.u32(0x44);
    let guard = 0;
    const perSector = this.sectorSize / 4;
    while (next < 0xfffffffa && guard++ < 10000) {
      const off = this.sectorOffset(next);
      for (let i = 0; i < perSector - 1; i++) difat.push(this.u32(off + i * 4));
      next = this.u32(off + (perSector - 1) * 4);
    }
    for (const sect of difat) {
      if (sect >= 0xfffffffa) continue;
      const off = this.sectorOffset(sect);
      for (let i = 0; i < perSector; i++) this.fat.push(this.u32(off + i * 4));
    }
  }

  private chain(start: number, table: number[]): number[] {
    const out: number[] = [];
    let s = start;
    const seen = new Set<number>();
    while (s < 0xfffffffa && s < table.length && !seen.has(s)) {
      seen.add(s);
      out.push(s);
      s = table[s];
    }
    if (s < 0xfffffffa && s >= table.length && s !== ENDOFCHAIN) out.push(s);
    return out;
  }

  private readChain(start: number, size: number): Uint8Array {
    const sectors = this.chain(start, this.fat);
    const out = new Uint8Array(sectors.length * this.sectorSize);
    sectors.forEach((s, i) => {
      const off = this.sectorOffset(s);
      out.set(this.bytes.subarray(off, Math.min(off + this.sectorSize, this.bytes.length)), i * this.sectorSize);
    });
    return size >= 0 ? out.subarray(0, Math.min(size, out.length)) : out;
  }

  private readDirectory() {
    const dir = this.readChain(this.u32(0x30), -1);
    const dv = new DataView(dir.buffer, dir.byteOffset, dir.byteLength);
    for (let off = 0; off + 128 <= dir.length; off += 128) {
      const nameLen = dv.getUint16(off + 0x40, true);
      let name = '';
      for (let i = 0; i + 1 < nameLen - 1 && i < 64; i += 2) name += String.fromCharCode(dv.getUint16(off + i, true));
      this.entries.push({ name, type: dir[off + 0x42], start: dv.getUint32(off + 0x74, true), size: dv.getUint32(off + 0x78, true) });
    }
    const root = this.entries.find(e => e.type === 5);
    if (root) {
      this.miniStream = this.readChain(root.start, root.size);
      const mfStart = this.u32(0x3c);
      if (mfStart < 0xfffffffa) {
        const mf = this.readChain(mfStart, -1);
        const mdv = new DataView(mf.buffer, mf.byteOffset, mf.byteLength);
        for (let i = 0; i + 4 <= mf.length; i += 4) this.miniFat.push(mdv.getUint32(i, true));
      }
    }
  }

  streamNames() {
    return this.entries.filter(e => e.type === 2).map(e => e.name);
  }

  stream(name: string): Uint8Array | null {
    const entry = this.entries.find(e => e.type === 2 && e.name.toLowerCase() === name.toLowerCase());
    if (!entry) return null;
    if (entry.size < this.miniCutoff && this.miniStream) {
      const sectors = this.chain(entry.start, this.miniFat);
      const out = new Uint8Array(sectors.length * this.miniSectorSize);
      sectors.forEach((s, i) => out.set(this.miniStream!.subarray(s * this.miniSectorSize, (s + 1) * this.miniSectorSize), i * this.miniSectorSize));
      return out.subarray(0, entry.size);
    }
    return this.readChain(entry.start, entry.size);
  }
}

const cp1252 = (() => {
  try {
    return new TextDecoder('windows-1252');
  } catch {
    return null;
  }
})();

const decode8 = (bytes: Uint8Array) => (cp1252 ? cp1252.decode(bytes) : String.fromCharCode(...Array.from(bytes)));

const decode16 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i + 1 < bytes.length; i += 2) s += String.fromCharCode(bytes[i] | (bytes[i + 1] << 8));
  return s;
};

export class WordBinaryError extends Error {
  constructor(message: string, readonly code: 'not-word' | 'encrypted' | 'corrupt') {
    super(message);
  }
}

/** Raw main-document text of a Word 97-2003 (or Word 6/95) file. */
export const extractWordText = (bytes: Uint8Array): string => {
  const cfb = new CfbReader(bytes);
  const word = cfb.stream('WordDocument');
  if (!word || word.length < 0x200) throw new WordBinaryError('No WordDocument stream', 'not-word');
  const dv = new DataView(word.buffer, word.byteOffset, word.byteLength);
  if (dv.getUint16(0, true) !== 0xa5ec) throw new WordBinaryError('Bad FIB signature', 'not-word');
  const nFib = dv.getUint16(2, true);
  const flags = dv.getUint16(0x0a, true);
  if (flags & 0x0100) throw new WordBinaryError('Encrypted document', 'encrypted');

  if (nFib < 101) {
    // Word 6 / 95: text stored as 8-bit between fcMin and fcMac
    const fcMin = dv.getUint32(0x18, true);
    const fcMac = dv.getUint32(0x1c, true);
    return decode8(word.subarray(fcMin, Math.min(fcMac, word.length)));
  }

  const table = cfb.stream(flags & 0x0200 ? '1Table' : '0Table');
  if (!table) throw new WordBinaryError('Missing table stream', 'corrupt');

  // FIB: base (32 bytes) | csw + fibRgW | cslw + fibRgLw | cbRgFcLcb + fibRgFcLcb
  let off = 32;
  const csw = dv.getUint16(off, true);
  off += 2 + csw * 2;
  const cslw = dv.getUint16(off, true);
  const rgLw = off + 2;
  off += 2 + cslw * 4;
  const ccpText = dv.getUint32(rgLw + 3 * 4, true);
  const rgFcLcb = off + 2;
  const fcClx = dv.getUint32(rgFcLcb + 66 * 4, true);
  const lcbClx = dv.getUint32(rgFcLcb + 67 * 4, true);
  if (!lcbClx || fcClx + lcbClx > table.length) throw new WordBinaryError('No piece table', 'corrupt');

  const tdv = new DataView(table.buffer, table.byteOffset, table.byteLength);
  let p = fcClx;
  const end = fcClx + lcbClx;
  // skip Prc entries
  while (p < end && table[p] === 0x01) p += 3 + tdv.getInt16(p + 1, true);
  if (table[p] !== 0x02) throw new WordBinaryError('Bad CLX', 'corrupt');
  const lcb = tdv.getUint32(p + 1, true);
  const plc = p + 5;
  const n = Math.floor((lcb - 4) / 12);
  let text = '';
  for (let i = 0; i < n; i++) {
    const cpStart = tdv.getUint32(plc + i * 4, true);
    let cpEnd = tdv.getUint32(plc + (i + 1) * 4, true);
    if (cpStart >= ccpText) break;
    cpEnd = Math.min(cpEnd, ccpText);
    const pcd = plc + (n + 1) * 4 + i * 8;
    const fcRaw = tdv.getUint32(pcd + 2, true);
    const compressed = (fcRaw & 0x40000000) !== 0;
    const count = cpEnd - cpStart;
    if (compressed) {
      const fc = (fcRaw & 0x3fffffff) / 2;
      text += decode8(word.subarray(fc, fc + count));
    } else {
      text += decode16(word.subarray(fcRaw, fcRaw + count * 2));
    }
  }
  return text;
};

/** Cleans Word's special characters (fields, cell marks, objects) and builds HTML paragraphs. */
export const wordTextToHtml = (raw: string, escape: (s: string) => string): string => {
  // drop field instructions: \x13 instr \x14 result \x15 -> result; \x13 instr \x15 -> ''
  let text = '';
  const stack: { inInstr: boolean }[] = [];
  for (const ch of raw) {
    if (ch === '\x13') { stack.push({ inInstr: true }); continue; }
    if (ch === '\x14') { if (stack.length) stack[stack.length - 1].inInstr = false; continue; }
    if (ch === '\x15') { stack.pop(); continue; }
    if (stack.some(s => s.inInstr)) continue;
    text += ch;
  }
  text = text
    .replace(/[\x01\x02\x05\x08\x1f]/g, '')
    .replace(/\x1e/g, '-')
    .replace(/\x0b/g, '\n')
    .replace(/\x07\r?/g, '\t')
    .replace(/\x0c/g, '\r\f\r');
  return text
    .split('\r')
    .map(p => p.replace(/\t+$/, ''))
    .filter((p, i, arr) => p.trim() || (i > 0 && arr[i - 1].trim()))
    .map(p => (p === '\f' ? '<div data-type="page-break"></div>' : `<p>${escape(p).replace(/\n/g, '<br>')}</p>`))
    .join('');
};
