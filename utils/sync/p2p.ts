import * as Y from 'yjs';
import type { WebrtcProvider } from 'y-webrtc';
import { createProvider, destroyProvider, isSignalingConnected, loadCollabConfig, normalizeCode, formatCode, randomCode, CODE_ALPHABET } from '../collaboration';
import { bytesToBase64, base64ToBytes } from '../base64';
import { sha256Hex } from './crypto';

/**
 * Device-to-device sync over WebRTC (y-webrtc for discovery + connection setup).
 *
 * Pairing: one device shows a one-time code / QR (room + key). Both join a
 * password-protected y-webrtc room (signaling is encrypted with the key, so
 * the signaling server can neither read nor tamper with the connection
 * setup), the showing device generates a random 160-bit pairing secret and
 * hands it over the resulting DTLS data channel.
 *
 * Syncing: every pair of devices has its own room, derived from its secret
 * (`password` = secret, so again only the two devices can connect). Unpairing
 * forgets that secret; other pairs are unaffected. Over the data channel the
 * devices exchange Yjs state vectors for every document and then stream
 * incremental updates. y-webrtc only syncs one Y.Doc per room, so our own
 * messages are multiplexed on its data channel: they start with byte 0xF0,
 * which never begins a y-webrtc message, and are chunked to stay under
 * WebRTC's message size limits.
 */

/* ------------------------------------------------------------------ */
/* Pairing codes                                                       */
/* ------------------------------------------------------------------ */

const PAIR_PREFIX = 'PENKOPAIR1:';
export const PAIR_ROOM_LENGTH = 8;
export const PAIR_KEY_LENGTH = 16; // ~80 bits, short-lived
const SECRET_LENGTH = 32; // 160 bits

export interface PairingCode {
  room: string;
  key: string;
}

export const generatePairingCode = (): PairingCode => ({ room: randomCode(PAIR_ROOM_LENGTH), key: randomCode(PAIR_KEY_LENGTH) });
export const formatPairingCode = (c: PairingCode) => formatCode(c.room + c.key, 4);
export const pairingQrPayload = (c: PairingCode) => PAIR_PREFIX + c.room + c.key;

export const parsePairingCode = (raw: string): PairingCode | null => {
  let text = (raw || '').trim();
  if (text.toUpperCase().startsWith(PAIR_PREFIX)) text = text.slice(PAIR_PREFIX.length);
  const clean = normalizeCode(text);
  if (clean.length !== PAIR_ROOM_LENGTH + PAIR_KEY_LENGTH || [...clean].some(ch => !CODE_ALPHABET.includes(ch))) return null;
  return { room: clean.slice(0, PAIR_ROOM_LENGTH), key: clean.slice(PAIR_ROOM_LENGTH) };
};

export const syncRoomName = async (secret: string) => `penko-writer-sync-${(await sha256Hex(`penko-sync-room:${secret}`)).slice(0, 32)}`;

export interface DeviceInfo {
  id: string;
  name: string;
}

export interface PairingResult {
  peer: DeviceInfo;
  secret: string;
}

export interface PairingHandle {
  cancel: () => Promise<void>;
}

const pairingRoom = (code: PairingCode) => `penko-writer-pair-${normalizeCode(code.room)}`;
const cleanName = (s: unknown) => (typeof s === 'string' && s.trim() ? s.trim().slice(0, 60) : '?');
const cleanId = (s: unknown) => (typeof s === 'string' && /^[A-Za-z0-9_-]{4,64}$/.test(s) ? s : null);

/** The device showing the code. Resolves `onPaired` once the other device confirmed. */
export const hostPairing = (code: PairingCode, me: DeviceInfo, handlers: { onPeerJoined: () => void; onPaired: (r: PairingResult) => void }): PairingHandle => {
  const ydoc = new Y.Doc();
  const provider = createProvider(pairingRoom(code), ydoc, normalizeCode(code.key), loadCollabConfig());
  provider.awareness.setLocalStateField('pair', { role: 'host', device: me });
  const offer = ydoc.getMap<any>('offer');
  const ack = ydoc.getMap<any>('ack');
  let offered: { guest: DeviceInfo; secret: string } | null = null;
  let done = false;

  const onAwareness = () => {
    if (offered) return;
    for (const s of provider.awareness.getStates().values()) {
      const p = (s as any)?.pair;
      const id = cleanId(p?.device?.id);
      if (p?.role !== 'guest' || !id || id === me.id) continue;
      offered = { guest: { id, name: cleanName(p.device.name) }, secret: randomCode(SECRET_LENGTH) };
      handlers.onPeerJoined();
      ydoc.transact(() => {
        offer.set('secret', offered!.secret);
        offer.set('host', me);
        offer.set('guestId', id);
      });
      return;
    }
  };
  const onAck = () => {
    if (done || !offered || ack.get('guestId') !== offered.guest.id) return;
    done = true;
    const name = ack.get('name');
    handlers.onPaired({ peer: { id: offered.guest.id, name: name ? cleanName(name) : offered.guest.name }, secret: offered.secret });
  };
  provider.awareness.on('change', onAwareness);
  ack.observe(onAck);
  return {
    cancel: async () => {
      provider.awareness.off('change', onAwareness);
      ack.unobserve(onAck);
      await destroyProvider(provider, ydoc);
    },
  };
};

/** The device that entered / scanned the code. */
export const joinPairing = (code: PairingCode, me: DeviceInfo, handlers: { onConnected: () => void; onPaired: (r: PairingResult) => void }): PairingHandle => {
  const ydoc = new Y.Doc();
  const provider = createProvider(pairingRoom(code), ydoc, normalizeCode(code.key), loadCollabConfig());
  provider.awareness.setLocalStateField('pair', { role: 'guest', device: me });
  const offer = ydoc.getMap<any>('offer');
  const ack = ydoc.getMap<any>('ack');
  let connected = false;
  let done = false;

  const onAwareness = () => {
    if (connected) return;
    const host = Array.from(provider.awareness.getStates().values()).some((s: any) => s?.pair?.role === 'host');
    if (host) {
      connected = true;
      handlers.onConnected();
    }
  };
  const onOffer = () => {
    if (done || offer.get('guestId') !== me.id) return;
    const secret = offer.get('secret');
    const host = offer.get('host');
    const hostId = cleanId(host?.id);
    if (typeof secret !== 'string' || secret.length < SECRET_LENGTH || !hostId) return;
    done = true;
    ydoc.transact(() => {
      ack.set('guestId', me.id);
      ack.set('name', me.name);
    });
    handlers.onPaired({ peer: { id: hostId, name: cleanName(host.name) }, secret });
  };
  provider.awareness.on('change', onAwareness);
  offer.observe(onOffer);
  return {
    cancel: async () => {
      provider.awareness.off('change', onAwareness);
      offer.unobserve(onOffer);
      await destroyProvider(provider, ydoc);
    },
  };
};

/* ------------------------------------------------------------------ */
/* Wire format                                                         */
/* ------------------------------------------------------------------ */

const MARK = 0xf0;
const CHUNK = 60_000;
const HEADER = 9; // mark + msgId(4) + index(2) + total(2)

export type WireMessage =
  | { type: 'hello'; deviceId: string; name: string; channels: Record<string, string> }
  | { type: 'update'; channel: string; data: Uint8Array }
  | { type: 'want'; channels: string[] }
  | { type: 'unpair'; deviceId: string };

const te = new TextEncoder();
const td = new TextDecoder();

/** Message -> frames (each ≤ 60 kB + header). */
export const encodeMessage = (msg: WireMessage, msgId: number): Uint8Array[] => {
  const { data, ...head } = msg as WireMessage & { data?: Uint8Array };
  const json = te.encode(JSON.stringify(head));
  const bin = data || new Uint8Array(0);
  const body = new Uint8Array(4 + json.length + bin.length);
  new DataView(body.buffer).setUint32(0, json.length);
  body.set(json, 4);
  body.set(bin, 4 + json.length);
  const total = Math.max(1, Math.ceil(body.length / CHUNK));
  const frames: Uint8Array[] = [];
  for (let i = 0; i < total; i++) {
    const part = body.subarray(i * CHUNK, (i + 1) * CHUNK);
    const frame = new Uint8Array(HEADER + part.length);
    const dv = new DataView(frame.buffer);
    frame[0] = MARK;
    dv.setUint32(1, msgId >>> 0);
    dv.setUint16(5, i);
    dv.setUint16(7, total);
    frame.set(part, HEADER);
    frames.push(frame);
  }
  return frames;
};

const decodeBody = (body: Uint8Array): WireMessage | null => {
  try {
    const len = new DataView(body.buffer, body.byteOffset, body.byteLength).getUint32(0);
    const head = JSON.parse(td.decode(body.subarray(4, 4 + len)));
    if (!head || typeof head.type !== 'string') return null;
    if (head.type === 'update') return { type: 'update', channel: String(head.channel), data: body.slice(4 + len) };
    return head as WireMessage;
  } catch {
    return null;
  }
};

/** Reassembles frames (per connection). */
export class FrameAssembler {
  private partial = new Map<number, { parts: Uint8Array[]; got: number; total: number }>();

  /** Returns the complete message once its last frame arrived. */
  push(frame: Uint8Array): WireMessage | null {
    if (frame.length < HEADER || frame[0] !== MARK) return null;
    const dv = new DataView(frame.buffer, frame.byteOffset, frame.byteLength);
    const id = dv.getUint32(1);
    const index = dv.getUint16(5);
    const total = dv.getUint16(7);
    const payload = frame.slice(HEADER);
    if (total <= 1) return decodeBody(payload);
    let p = this.partial.get(id);
    if (!p) {
      if (this.partial.size > 64) this.partial.clear(); // abandoned messages
      this.partial.set(id, (p = { parts: new Array(total), got: 0, total }));
    }
    if (index >= p.total || p.parts[index]) return null;
    p.parts[index] = payload;
    if (++p.got < p.total) return null;
    this.partial.delete(id);
    const size = p.parts.reduce((n, x) => n + x.length, 0);
    const body = new Uint8Array(size);
    let off = 0;
    p.parts.forEach(x => {
      body.set(x, off);
      off += x.length;
    });
    return decodeBody(body);
  }
}

export const isOwnFrame = (data: Uint8Array) => data.length > 0 && data[0] === MARK;

/* ------------------------------------------------------------------ */
/* Links to paired devices                                             */
/* ------------------------------------------------------------------ */

export interface P2PHandlers {
  /** State vectors (base64) of every channel this device can share. */
  announce(): Record<string, string>;
  /** Diff for a channel given the peer's state vector (none: everything). Null if not shareable. */
  diff(channel: string, stateVector: Uint8Array | null): Uint8Array | null;
  /** The channels the peer has (from its hello). */
  peerChannels(channels: string[]): void;
  receive(channel: string, update: Uint8Array, peerDeviceId: string): void;
  status(deviceId: string, connected: boolean): void;
  signaling(connected: boolean): void;
  unpaired(deviceId: string): void;
}

interface Conn {
  peer: any;
  assembler: FrameAssembler;
  helloSent: boolean;
  queue: Uint8Array[];
  pumping: boolean;
}

let nextMsgId = 1;
const HELLO_TIMEOUT_MS = 4000;

/** A connection to one paired device (its own y-webrtc room). */
export class PeerLink {
  readonly deviceId: string;
  private me: DeviceInfo;
  private handlers: P2PHandlers;
  private provider: WebrtcProvider | null = null;
  private ydoc = new Y.Doc();
  private conns = new Map<string, Conn>();
  /** WebRTC peers that proved to be the paired device (sent a matching hello). */
  private verified = new Set<string>();
  private destroyed = false;
  private offSignaling: (() => void) | null = null;

  constructor(deviceId: string, me: DeviceInfo, handlers: P2PHandlers) {
    this.deviceId = deviceId;
    this.me = me;
    this.handlers = handlers;
  }

  async start(secret: string) {
    const room = await syncRoomName(secret);
    if (this.destroyed) return;
    const provider = createProvider(room, this.ydoc, secret, loadCollabConfig());
    this.provider = provider;
    provider.on('peers', this.onPeers);
    const conns: any[] = (provider as any).signalingConns || [];
    const onSig = () => this.handlers.signaling(isSignalingConnected(provider));
    conns.forEach(c => {
      c.on('connect', onSig);
      c.on('disconnect', onSig);
    });
    this.offSignaling = () =>
      conns.forEach(c => {
        c.off('connect', onSig);
        c.off('disconnect', onSig);
      });
    onSig();
  }

  get connected() {
    return this.verified.size > 0;
  }

  get signalingConnected() {
    return !!this.provider && isSignalingConnected(this.provider);
  }

  private onPeers = (e: { added: string[]; removed: string[] }) => {
    const room = (this.provider as any)?.room;
    if (!room) return;
    e.added.forEach(id => {
      const wc = room.webrtcConns.get(id);
      if (wc) this.attach(id, wc);
    });
    e.removed.forEach(id => {
      this.conns.delete(id);
      if (this.verified.delete(id) && this.verified.size === 0) this.handlers.status(this.deviceId, false);
    });
  };

  /** Routes our frames to us and everything else to y-webrtc's own handler. */
  private attach(id: string, wc: any) {
    const peer = wc.peer;
    if (!peer || peer.__penkoSync) return;
    peer.__penkoSync = true;
    const conn: Conn = { peer, assembler: new FrameAssembler(), helloSent: false, queue: [], pumping: false };
    this.conns.set(id, conn);
    const original: ((d: any) => void)[] = peer.listeners('data');
    peer.removeAllListeners('data');
    peer.on('data', (data: any) => {
      const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
      if (isOwnFrame(bytes)) {
        const msg = conn.assembler.push(bytes);
        if (msg) this.onMessage(id, conn, msg);
      } else original.forEach(fn => fn.call(peer, data));
    });
    // Simultaneous connection attempts (both devices announcing at once, "glare") can
    // leave a "connected" channel that never delivers anything: drop it so y-webrtc
    // reconnects. The random delay keeps both sides from retrying in lockstep.
    let watchdog = 0;
    const hello = () => {
      this.sendHello(conn);
      watchdog = window.setTimeout(() => {
        if (!this.verified.has(id) && !this.destroyed && this.conns.get(id) === conn) {
          try {
            peer.destroy();
          } catch {
            /* already closed */
          }
        }
      }, HELLO_TIMEOUT_MS + Math.random() * HELLO_TIMEOUT_MS);
    };
    if (peer.connected) hello();
    else peer.once('connect', hello);
    peer.once('close', () => {
      window.clearTimeout(watchdog);
      if (this.conns.get(id) === conn) this.conns.delete(id);
      if (this.verified.delete(id) && this.verified.size === 0) this.handlers.status(this.deviceId, false);
    });
  }

  private sendHello(conn: Conn) {
    if (conn.helloSent || this.destroyed) return;
    conn.helloSent = true;
    this.send(conn, { type: 'hello', deviceId: this.me.id, name: this.me.name, channels: this.handlers.announce() });
  }

  private onMessage(id: string, conn: Conn, msg: WireMessage) {
    if (msg.type === 'hello') {
      if (msg.deviceId !== this.deviceId) return; // only the paired device knows the secret; ignore anything else
      const first = !this.verified.has(id);
      this.verified.add(id);
      if (first) this.handlers.status(this.deviceId, true);
      this.sendHello(conn);
      const theirs = msg.channels && typeof msg.channels === 'object' ? msg.channels : {};
      this.handlers.peerChannels(Object.keys(theirs));
      const mine = this.handlers.announce();
      Object.keys(mine).forEach(ch => {
        const sv = typeof theirs[ch] === 'string' ? base64ToBytes(theirs[ch]) : null;
        const diff = this.handlers.diff(ch, sv);
        if (diff) this.send(conn, { type: 'update', channel: ch, data: diff });
      });
      // channels only they have arrive through their own hello handling
      return;
    }
    if (!this.verified.has(id)) return;
    if (msg.type === 'update') this.handlers.receive(msg.channel, msg.data, this.deviceId);
    else if (msg.type === 'want') {
      (msg.channels || []).forEach(ch => {
        const diff = this.handlers.diff(String(ch), null);
        if (diff) this.send(conn, { type: 'update', channel: String(ch), data: diff });
      });
    } else if (msg.type === 'unpair' && msg.deviceId === this.deviceId) this.handlers.unpaired(this.deviceId);
  }

  private send(conn: Conn, msg: WireMessage) {
    conn.queue.push(...encodeMessage(msg, nextMsgId++));
    void this.pump(conn);
  }

  /**
   * Sends queued frames without overrunning the data channel's buffer. The
   * channel can open (and receive) before simple-peer reports 'connect', so
   * only the channel state matters; until it's open, retry shortly.
   */
  private async pump(conn: Conn) {
    if (conn.pumping) return;
    conn.pumping = true;
    try {
      while (conn.queue.length && !this.destroyed && !conn.peer.destroyed) {
        const channel = conn.peer._channel as RTCDataChannel | undefined;
        if (!channel || channel.readyState !== 'open' || channel.bufferedAmount > 1_000_000) {
          if (channel && (channel.readyState === 'closing' || channel.readyState === 'closed')) break;
          await new Promise(r => setTimeout(r, 50));
          continue;
        }
        try {
          channel.send(conn.queue[0] as Uint8Array<ArrayBuffer>);
          conn.queue.shift();
        } catch {
          break;
        }
      }
    } finally {
      conn.pumping = false;
    }
  }

  /** Sends to every verified connection. */
  broadcast(msg: WireMessage) {
    this.conns.forEach((conn, id) => {
      if (this.verified.has(id)) this.send(conn, msg);
    });
  }

  sendUpdate(channel: string, update: Uint8Array) {
    this.broadcast({ type: 'update', channel, data: update });
  }

  want(channels: string[]) {
    if (channels.length) this.broadcast({ type: 'want', channels });
  }

  /** Tells the other device we unpaired (best effort) and closes the link. */
  async unpair() {
    this.broadcast({ type: 'unpair', deviceId: this.me.id });
    await new Promise(r => setTimeout(r, 300));
    await this.destroy();
  }

  async destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    this.offSignaling?.();
    const provider = this.provider;
    this.provider = null;
    this.conns.clear();
    if (this.verified.size) this.handlers.status(this.deviceId, false);
    this.verified.clear();
    if (provider) {
      provider.off('peers', this.onPeers);
      await destroyProvider(provider, this.ydoc);
    } else this.ydoc.destroy();
  }
}

export const encodeSV = (sv: Uint8Array) => bytesToBase64(sv);
