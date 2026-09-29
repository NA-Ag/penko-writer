import { describe, it, expect } from 'vitest';
import { encodeMessage, FrameAssembler, isOwnFrame, formatPairingCode, generatePairingCode, pairingQrPayload, parsePairingCode, syncRoomName } from '../../utils/sync/p2p';

describe('device pairing codes', () => {
  it('round-trips through the QR payload and the typed form', () => {
    const code = generatePairingCode();
    expect(parsePairingCode(pairingQrPayload(code))).toEqual(code);
    expect(parsePairingCode(formatPairingCode(code))).toEqual(code);
    expect(parsePairingCode(formatPairingCode(code).toLowerCase())).toEqual(code);
    expect(formatPairingCode(code)).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){5}$/);
  });

  it('rejects anything else', () => {
    expect(parsePairingCode('')).toBeNull();
    expect(parsePairingCode('ABCD-EFGH')).toBeNull();
    expect(parsePairingCode('PENKO1:ABCDEFGHJKLMNPQRSTUVWXYZ')).toBeNull();
    // 0/O/1/I are not part of the alphabet
    expect(parsePairingCode('0000-0000-0000-0000-0000-0000')).toBeNull();
  });

  it('derives a stable, secret-independent-looking room name', async () => {
    const a = await syncRoomName('SECRET-ONE');
    expect(a).toBe(await syncRoomName('SECRET-ONE'));
    expect(a).not.toBe(await syncRoomName('SECRET-TWO'));
    expect(a).not.toContain('SECRET');
    expect(a).toMatch(/^penko-writer-sync-[0-9a-f]{32}$/);
  });
});

describe('wire format', () => {
  it('frames small messages in one chunk that y-webrtc would never produce', () => {
    const frames = encodeMessage({ type: 'hello', deviceId: 'dev1', name: 'Laptop', channels: { index: 'AA==' } }, 7);
    expect(frames).toHaveLength(1);
    expect(isOwnFrame(frames[0])).toBe(true);
    // y-webrtc messages start with a small varuint message type
    expect(isOwnFrame(new Uint8Array([0, 1, 2]))).toBe(false);
    expect(new FrameAssembler().push(frames[0])).toEqual({ type: 'hello', deviceId: 'dev1', name: 'Laptop', channels: { index: 'AA==' } });
  });

  it('chunks and reassembles large updates, in any order, interleaved with other messages', () => {
    const data = new Uint8Array(250_000).map((_, i) => (i * 31) % 251);
    const big = encodeMessage({ type: 'update', channel: 'doc-1', data }, 1);
    const small = encodeMessage({ type: 'want', channels: ['x'] }, 2);
    expect(big.length).toBeGreaterThan(4);
    const asm = new FrameAssembler();
    const order = [big[3], big[0], ...small, big[2], ...big.slice(4), big[1]];
    const out = order.map(f => asm.push(f)).filter(Boolean);
    expect(out[0]).toEqual({ type: 'want', channels: ['x'] });
    const msg = out[1] as { type: 'update'; channel: string; data: Uint8Array };
    expect(msg.type).toBe('update');
    expect(msg.channel).toBe('doc-1');
    expect(msg.data.length).toBe(data.length);
    expect(Buffer.from(msg.data).equals(Buffer.from(data))).toBe(true);
  });

  it('ignores garbage and duplicate frames', () => {
    const asm = new FrameAssembler();
    expect(asm.push(new Uint8Array([0xf0, 1, 2]))).toBeNull();
    const frames = encodeMessage({ type: 'update', channel: 'c', data: new Uint8Array(130_000) }, 9);
    expect(asm.push(frames[0])).toBeNull();
    expect(asm.push(frames[0])).toBeNull();
    expect(asm.push(frames[1])).toBeNull();
    expect(asm.push(frames[2])).not.toBeNull();
  });
});
