import { describe, it, expect } from 'vitest';
import {
  CODE_ALPHABET,
  DEFAULT_SIGNALING,
  PASSWORD_LENGTH,
  ROOM_CODE_LENGTH,
  buildIceServers,
  chunkString,
  codeEntropyBits,
  formatCode,
  formatTransferCode,
  generatePassword,
  generateRoomCode,
  generateTransferCode,
  isValidPassword,
  isValidRoomCode,
  normalizeCode,
  parseCollabConfig,
  parseSignalingList,
  parseTransferCode,
  participantsFromAwareness,
  roomNameFor,
  transferQrPayload,
} from '../../utils/collaboration';

describe('room codes and passwords', () => {
  it('uses an unambiguous 32-symbol alphabet', () => {
    expect(CODE_ALPHABET).toHaveLength(32);
    expect(new Set(CODE_ALPHABET).size).toBe(32);
    for (const ch of '01IO') expect(CODE_ALPHABET).not.toContain(ch);
  });

  it('generates codes of the right length and alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const room = generateRoomCode();
      const pass = generatePassword();
      expect(room).toMatch(new RegExp(`^[${CODE_ALPHABET}]{${ROOM_CODE_LENGTH}}$`));
      expect(pass).toMatch(new RegExp(`^[${CODE_ALPHABET}]{${PASSWORD_LENGTH}}$`));
    }
  });

  it('has strong entropy (password >= 96 bits, room >= 48 bits)', () => {
    expect(codeEntropyBits(PASSWORD_LENGTH)).toBeGreaterThanOrEqual(96);
    expect(codeEntropyBits(ROOM_CODE_LENGTH)).toBeGreaterThanOrEqual(48);
  });

  it('does not repeat and is roughly uniform', () => {
    const seen = new Set<string>();
    const counts: Record<string, number> = {};
    for (let i = 0; i < 2000; i++) {
      const p = generatePassword();
      seen.add(p);
      for (const ch of p) counts[ch] = (counts[ch] || 0) + 1;
    }
    expect(seen.size).toBe(2000);
    const expected = (2000 * PASSWORD_LENGTH) / 32; // 1250
    for (const ch of CODE_ALPHABET) {
      expect(counts[ch]).toBeGreaterThan(expected * 0.8);
      expect(counts[ch]).toBeLessThan(expected * 1.2);
    }
  });

  it('normalizes and formats user input', () => {
    expect(normalizeCode(' abcd-efgh jk ')).toBe('ABCDEFGHJK');
    expect(formatCode('ABCDEFGHJK', 5)).toBe('ABCDE-FGHJK');
    expect(formatCode('abcd-efgh', 4)).toBe('ABCD-EFGH');
    expect(isValidRoomCode('ab-cd')).toBe(false);
    expect(isValidRoomCode('ABCDE-FGHJK')).toBe(true);
    expect(isValidPassword('')).toBe(false);
    expect(roomNameFor('abcde-fghjk')).toBe('penko-writer-live-ABCDEFGHJK');
    expect(roomNameFor('abcd', 'transfer')).toBe('penko-writer-transfer-ABCD');
  });
});

describe('transfer codes', () => {
  it('round-trips through the QR payload and the formatted manual code', () => {
    const code = generateTransferCode();
    expect(parseTransferCode(transferQrPayload(code))).toEqual(code);
    expect(parseTransferCode(formatTransferCode(code))).toEqual(code);
    expect(parseTransferCode(formatTransferCode(code).toLowerCase())).toEqual(code);
    expect(formatTransferCode(code)).toMatch(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/);
  });

  it('accepts the legacy JSON QR format', () => {
    expect(parseTransferCode('{"r":"abcd1234","k":"XYZ"}')).toEqual({ room: 'ABCD1234', key: 'XYZ' });
  });

  it('rejects garbage', () => {
    expect(parseTransferCode('')).toBeNull();
    expect(parseTransferCode('hello')).toBeNull();
    expect(parseTransferCode('{"r":1}')).toBeNull();
    expect(parseTransferCode('{broken')).toBeNull();
    expect(parseTransferCode('https://example.com/')).toBeNull();
  });

  it('chunks payloads', () => {
    expect(chunkString('', 4)).toEqual(['']);
    expect(chunkString('abcdefghij', 4)).toEqual(['abcd', 'efgh', 'ij']);
    expect(chunkString('x'.repeat(100_000)).join('')).toHaveLength(100_000);
  });
});

describe('connection config', () => {
  it('parses signaling lists', () => {
    expect(parseSignalingList('wss://a.example.com\nws://localhost:4444, wss://a.example.com/ http://nope  garbage')).toEqual([
      'wss://a.example.com',
      'ws://localhost:4444',
    ]);
    expect(parseSignalingList('')).toEqual([]);
  });

  it('falls back to y-webrtc defaults for missing / broken config', () => {
    expect(parseCollabConfig(null).signaling).toEqual(DEFAULT_SIGNALING);
    expect(parseCollabConfig('not json').signaling).toEqual(DEFAULT_SIGNALING);
    expect(parseCollabConfig('{"signaling":[]}').signaling).toEqual(DEFAULT_SIGNALING);
    expect(DEFAULT_SIGNALING).toEqual(['wss://y-webrtc-eu.fly.dev']);
  });

  it('keeps valid custom servers and TURN config', () => {
    const cfg = parseCollabConfig(
      JSON.stringify({ signaling: ['ws://localhost:4444', 'bad'], turnUrl: 'turn:turn.example.com:3478', turnUsername: 'u', turnCredential: 'p' }),
    );
    expect(cfg.signaling).toEqual(['ws://localhost:4444']);
    const ice = buildIceServers(cfg);
    expect(ice.some(s => String(s.urls).includes('stun:stun.cloudflare.com'))).toBe(true);
    expect(ice.find(s => s.urls === 'turn:turn.example.com:3478')).toMatchObject({ username: 'u', credential: 'p' });
  });

  it('drops invalid TURN urls', () => {
    const cfg = parseCollabConfig(JSON.stringify({ turnUrl: 'http://x', turnUsername: 'u' }));
    expect(cfg.turnUrl).toBe('');
    expect(cfg.turnUsername).toBe('');
    expect(buildIceServers(cfg).every(s => String(s.urls).includes('stun:'))).toBe(true);
  });
});

describe('participants', () => {
  it('derives a sanitized list from awareness states, self first', () => {
    const states = new Map<number, any>([
      [2, { user: { name: 'Zoe', color: '#10b981' } }],
      [1, { user: { name: 'Me', color: 'red; background:url(x)' } }],
      [3, {}],
      [4, { transfer: 'receiver', user: { name: 'x', color: '#000' } }],
    ]);
    const list = participantsFromAwareness(states, 1);
    expect(list.map(p => p.name)).toEqual(['Me', 'Zoe']);
    expect(list[0]).toMatchObject({ isSelf: true, color: '#6b7280' });
    expect(list[1]).toMatchObject({ isSelf: false, color: '#10b981' });
  });
});
