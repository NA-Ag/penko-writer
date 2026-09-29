// Real-time P2P collaboration (Yjs + y-webrtc) and one-shot QR document transfer.
//
// Security model (keep UI copy in line with this):
// - Every room has a password. y-webrtc derives an AES-GCM key from it (PBKDF2, room name as salt)
//   and encrypts all signaling traffic (including the WebRTC SDP / DTLS fingerprints) with it, so the
//   signaling server only relays opaque messages and cannot read or tamper with the connection setup.
// - Document updates travel directly between peers over WebRTC data channels (DTLS-encrypted).
// - A signaling server (WebSocket) is still required so peers can find each other; STUN/TURN servers
//   help with NAT traversal (TURN relays encrypted traffic when a direct path is impossible).
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';
import { useSyncExternalStore } from 'react';

/* ------------------------------------------------------------------ */
/* Codes & passwords                                                   */
/* ------------------------------------------------------------------ */

/** Unambiguous uppercase alphabet (no 0/O, 1/I). 32 symbols = 5 bits each. */
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ALPHABET = CODE_ALPHABET;

export const ROOM_CODE_LENGTH = 10; // ~50 bits – only has to avoid collisions
export const PASSWORD_LENGTH = 20; // ~99 bits – protects the session
export const TRANSFER_ROOM_LENGTH = 8;
export const TRANSFER_KEY_LENGTH = 16; // ~79 bits, short-lived one-shot transfer

const randomIndex = (max: number): number => {
  // Rejection sampling -> uniform over [0, max)
  const limit = Math.floor(256 / max) * max;
  const buf = new Uint8Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
};

/** Cryptographically random string over the unambiguous alphabet. */
export const randomCode = (length: number, alphabet: string = ALPHABET): string => {
  let out = '';
  for (let i = 0; i < length; i++) out += alphabet[randomIndex(alphabet.length)];
  return out;
};

/** Upper-cases and strips everything that isn't a code symbol (spaces, dashes…). */
export const normalizeCode = (input: string): string => (input || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/** "ABCDEFGHJK" -> "ABCDE-FGHJK" (groups of `group`). */
export const formatCode = (code: string, group = 4): string => {
  const clean = normalizeCode(code);
  const parts: string[] = [];
  for (let i = 0; i < clean.length; i += group) parts.push(clean.slice(i, i + group));
  return parts.join('-');
};

export const generateRoomCode = (): string => randomCode(ROOM_CODE_LENGTH);
export const generatePassword = (): string => randomCode(PASSWORD_LENGTH);

/** Entropy in bits of a random code of `length` symbols over the code alphabet. */
export const codeEntropyBits = (length: number): number => length * Math.log2(ALPHABET.length);

export const isValidRoomCode = (input: string): boolean => normalizeCode(input).length >= 6;
export const isValidPassword = (input: string): boolean => normalizeCode(input).length >= 6;

/** The y-webrtc room name (namespaced so we never collide with other apps on a public signaling server). */
export const roomNameFor = (code: string, kind: 'live' | 'transfer' = 'live') =>
  `penko-writer-${kind}-${normalizeCode(code)}`;

/* ------------------------------------------------------------------ */
/* QR / manual transfer codes                                          */
/* ------------------------------------------------------------------ */

const TRANSFER_PREFIX = 'PENKO1:';

export interface TransferCode {
  room: string;
  key: string;
}

export const generateTransferCode = (): TransferCode => ({
  room: randomCode(TRANSFER_ROOM_LENGTH),
  key: randomCode(TRANSFER_KEY_LENGTH),
});

/** Human-readable single code: room + key in groups of four. */
export const formatTransferCode = (c: TransferCode): string => formatCode(c.room + c.key, 4);

/** Payload encoded in the QR image. */
export const transferQrPayload = (c: TransferCode): string => TRANSFER_PREFIX + normalizeCode(c.room + c.key);

/** Parses a scanned QR payload or a typed transfer code. Returns null if it's not a transfer code. */
export const parseTransferCode = (raw: string): TransferCode | null => {
  if (!raw) return null;
  let text = raw.trim();
  // Legacy QR format: {"r": room, "k": key}
  if (text.startsWith('{')) {
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed?.r === 'string' && typeof parsed?.k === 'string' && parsed.r && parsed.k) {
        return { room: normalizeCode(parsed.r), key: normalizeCode(parsed.k) };
      }
    } catch {
      /* not JSON */
    }
    return null;
  }
  if (text.toUpperCase().startsWith(TRANSFER_PREFIX)) text = text.slice(TRANSFER_PREFIX.length);
  const clean = normalizeCode(text);
  if (clean.length !== TRANSFER_ROOM_LENGTH + TRANSFER_KEY_LENGTH) return null;
  return { room: clean.slice(0, TRANSFER_ROOM_LENGTH), key: clean.slice(TRANSFER_ROOM_LENGTH) };
};

/* ------------------------------------------------------------------ */
/* Connection config (signaling / STUN / TURN)                          */
/* ------------------------------------------------------------------ */

/** y-webrtc 10.3's own default signaling server. */
export const DEFAULT_SIGNALING = ['wss://y-webrtc-eu.fly.dev'];
export const DEFAULT_STUN: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export interface CollabConfig {
  signaling: string[];
  turnUrl: string;
  turnUsername: string;
  turnCredential: string;
}

export const DEFAULT_COLLAB_CONFIG: CollabConfig = { signaling: DEFAULT_SIGNALING, turnUrl: '', turnUsername: '', turnCredential: '' };
const CONFIG_KEY = 'penko_writer_collab_config';

/** Splits a free-form list (newlines, commas, spaces) into unique, valid ws:// / wss:// URLs. */
export const parseSignalingList = (text: string): string[] => {
  const out: string[] = [];
  for (const part of (text || '').split(/[\s,;]+/)) {
    const s = part.trim();
    if (!s) continue;
    try {
      const u = new URL(s);
      if ((u.protocol === 'ws:' || u.protocol === 'wss:') && u.hostname) {
        const norm = s.replace(/\/+$/, '');
        if (!out.includes(norm)) out.push(norm);
      }
    } catch {
      /* ignore invalid entries */
    }
  }
  return out;
};

export const isValidTurnUrl = (url: string) => /^turns?:[^\s]+$/i.test((url || '').trim());

/** Parses the persisted config (tolerant of garbage / older shapes). */
export const parseCollabConfig = (raw: string | null | undefined): CollabConfig => {
  if (!raw) return { ...DEFAULT_COLLAB_CONFIG };
  try {
    const obj = JSON.parse(raw);
    const signalingSource = Array.isArray(obj?.signaling) ? obj.signaling.join('\n') : typeof obj?.signaling === 'string' ? obj.signaling : '';
    const signaling = parseSignalingList(signalingSource);
    const turnUrl = typeof obj?.turnUrl === 'string' && isValidTurnUrl(obj.turnUrl) ? obj.turnUrl.trim() : '';
    return {
      signaling: signaling.length ? signaling : DEFAULT_SIGNALING,
      turnUrl,
      turnUsername: turnUrl && typeof obj?.turnUsername === 'string' ? obj.turnUsername : '',
      turnCredential: turnUrl && typeof obj?.turnCredential === 'string' ? obj.turnCredential : '',
    };
  } catch {
    return { ...DEFAULT_COLLAB_CONFIG };
  }
};

export const loadCollabConfig = (): CollabConfig => {
  try {
    return parseCollabConfig(localStorage.getItem(CONFIG_KEY));
  } catch {
    return { ...DEFAULT_COLLAB_CONFIG };
  }
};

export const saveCollabConfig = (config: CollabConfig) => {
  try {
    localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
  } catch {
    /* storage unavailable */
  }
};

export const buildIceServers = (config: CollabConfig): RTCIceServer[] => {
  const servers = [...DEFAULT_STUN];
  if (config.turnUrl && isValidTurnUrl(config.turnUrl)) {
    servers.push({ urls: config.turnUrl.trim(), username: config.turnUsername || undefined, credential: config.turnCredential || undefined });
  }
  return servers;
};

/* ------------------------------------------------------------------ */
/* Users                                                               */
/* ------------------------------------------------------------------ */

export const USER_COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];
export const randomUserColor = () => USER_COLORS[randomIndex(USER_COLORS.length)];

export interface Participant {
  id: number;
  name: string;
  color: string;
  isSelf: boolean;
}

export const participantsFromAwareness = (states: Map<number, any>, selfId: number): Participant[] => {
  const list: Participant[] = [];
  states.forEach((state, clientId) => {
    const user = state?.user;
    if (!user || state?.transfer) return;
    list.push({
      id: clientId,
      name: typeof user.name === 'string' && user.name.trim() ? user.name.slice(0, 60) : '?',
      color: typeof user.color === 'string' && /^#[0-9a-f]{3,8}$/i.test(user.color) ? user.color : '#6b7280',
      isSelf: clientId === selfId,
    });
  });
  return list.sort((a, b) => (a.isSelf === b.isSelf ? a.name.localeCompare(b.name) : a.isSelf ? -1 : 1));
};

/* ------------------------------------------------------------------ */
/* Provider helpers                                                    */
/* ------------------------------------------------------------------ */

export const createProvider = (roomName: string, ydoc: Y.Doc, password: string, config: CollabConfig) =>
  new WebrtcProvider(roomName, ydoc, {
    signaling: config.signaling.length ? config.signaling : DEFAULT_SIGNALING,
    password,
    peerOpts: { config: { iceServers: buildIceServers(config) } },
  } as any);

/** True when at least one signaling WebSocket is open. */
export const isSignalingConnected = (provider: WebrtcProvider) =>
  ((provider as any).signalingConns || []).some((c: any) => c.connected);

/** Subscribes to the open/close events of the provider's signaling sockets. */
const onSignalingChange = (provider: WebrtcProvider, cb: () => void) => {
  const conns: any[] = (provider as any).signalingConns || [];
  conns.forEach(c => {
    c.on('connect', cb);
    c.on('disconnect', cb);
  });
  return () =>
    conns.forEach(c => {
      c.off('connect', cb);
      c.off('disconnect', cb);
    });
};

/** Disconnects and destroys a provider (+ its doc). Resolves once the y-webrtc room is released. */
export const destroyProvider = async (provider: WebrtcProvider, ydoc?: Y.Doc) => {
  try {
    provider.disconnect();
    provider.destroy();
    await (provider as any).key;
  } catch {
    /* already destroyed */
  }
  ydoc?.destroy();
};

/* ------------------------------------------------------------------ */
/* Live session store (survives the dialog being closed)               */
/* ------------------------------------------------------------------ */

export interface LiveSession {
  role: 'host' | 'guest';
  roomCode: string;
  password: string;
  docId: string;
  ydoc: Y.Doc;
  provider: WebrtcProvider;
  user: { name: string; color: string };
  /** Host only: HTML to seed the shared doc with when the collaborative editor first mounts. */
  seedHtml: string | null;
  startedAt: number;
}

export interface LiveState {
  session: LiveSession | null;
  signalingConnected: boolean;
  /** Ever connected to signaling in this session (to tell "connecting" from "reconnecting"). */
  everConnected: boolean;
  /** Guest: received the host's document at least once. Host: always true. */
  synced: boolean;
  /** Number of directly connected WebRTC peers. */
  webrtcPeers: number;
  participants: Participant[];
}

const EMPTY_STATE: LiveState = { session: null, signalingConnected: false, everConnected: false, synced: false, webrtcPeers: 0, participants: [] };
let state: LiveState = EMPTY_STATE;
const listeners = new Set<() => void>();
let teardown: (() => void) | null = null;

const setState = (patch: Partial<LiveState>) => {
  state = { ...state, ...patch };
  listeners.forEach(l => l());
};

export const getLiveState = () => state;
export const subscribeLive = (cb: () => void) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
export const useLiveSession = () => useSyncExternalStore(subscribeLive, getLiveState, getLiveState);

export interface StartLiveOptions {
  role: 'host' | 'guest';
  roomCode: string;
  password: string;
  docId: string;
  user: { name: string; color: string };
  config: CollabConfig;
  seedHtml?: string | null;
  /** Host: document metadata shared with guests (title etc.). */
  meta?: Record<string, unknown>;
}

export const startLiveSession = (opts: StartLiveOptions): LiveSession => {
  if (state.session) throw new Error('A collaboration session is already running');
  const ydoc = new Y.Doc();
  if (opts.role === 'host' && opts.meta) {
    const meta = ydoc.getMap('meta');
    ydoc.transact(() => Object.entries(opts.meta!).forEach(([k, v]) => v !== undefined && meta.set(k, v)));
  }
  const provider = createProvider(roomNameFor(opts.roomCode), ydoc, normalizeCode(opts.password), opts.config);
  provider.awareness.setLocalStateField('user', opts.user);

  const session: LiveSession = {
    role: opts.role,
    roomCode: normalizeCode(opts.roomCode),
    password: normalizeCode(opts.password),
    docId: opts.docId,
    ydoc,
    provider,
    user: opts.user,
    seedHtml: opts.role === 'host' ? opts.seedHtml ?? '' : null,
    startedAt: Date.now(),
  };

  const refreshPeople = () =>
    setState({ participants: participantsFromAwareness(provider.awareness.getStates(), provider.awareness.clientID) });
  const refreshSignaling = () => {
    const connected = isSignalingConnected(provider);
    setState({ signalingConnected: connected, everConnected: state.everConnected || connected });
  };
  const onPeers = (e: any) => setState({ webrtcPeers: (e?.webrtcPeers || []).length });
  const onSynced = (e: any) => {
    if (e?.synced) setState({ synced: true });
  };
  // Guests also count as synced as soon as content arrives from a peer (y-webrtc uses the room as origin)
  const onUpdate = (_u: Uint8Array, origin: any) => {
    if (!state.synced && origin && origin === (provider as any).room) setState({ synced: true });
  };

  provider.awareness.on('change', refreshPeople);
  provider.on('peers', onPeers);
  provider.on('synced', onSynced);
  ydoc.on('update', onUpdate);
  const offSignaling = onSignalingChange(provider, refreshSignaling);

  teardown = () => {
    provider.awareness.off('change', refreshPeople);
    provider.off('peers', onPeers);
    provider.off('synced', onSynced);
    ydoc.off('update', onUpdate);
    offSignaling();
  };

  state = { ...EMPTY_STATE, session, synced: opts.role === 'host' };
  refreshPeople();
  refreshSignaling();
  return session;
};

/** Updates the local user's name/colour in awareness (the caret extension reads the same field). */
export const updateLiveUser = (user: { name: string; color: string }) => {
  const s = state.session;
  if (!s) return;
  s.user = user;
  s.provider.awareness.setLocalStateField('user', user);
};

/** Marks the host's seed as consumed (so it is never applied twice). */
export const consumeSeed = () => {
  const s = state.session;
  if (!s) return null;
  const html = s.seedHtml;
  s.seedHtml = null;
  return html;
};

/** Tears the session down. The caller must unbind the editor first (setCollabSession(null)). */
export const stopLiveSession = async () => {
  const s = state.session;
  if (!s) return;
  teardown?.();
  teardown = null;
  state = EMPTY_STATE;
  listeners.forEach(l => l());
  await destroyProvider(s.provider, s.ydoc);
};

/* ------------------------------------------------------------------ */
/* One-shot document transfer (QR clone)                               */
/* ------------------------------------------------------------------ */

export const TRANSFER_CHUNK_SIZE = 32 * 1024;

export const chunkString = (s: string, size = TRANSFER_CHUNK_SIZE): string[] => {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) out.push(s.slice(i, i + size));
  return out.length ? out : [''];
};

export interface TransferPayload {
  doc: Record<string, unknown>;
}

export interface TransferHandle {
  provider: WebrtcProvider;
  ydoc: Y.Doc;
  cancel: () => Promise<void>;
}

/**
 * Sender: waits for a receiver to join the room, then pushes the document in chunks
 * (each chunk its own update, to stay below WebRTC message-size limits) and resolves
 * `onReceiverJoined` / `onAcknowledged` when the receiver confirms it saved the copy.
 */
export const startTransferSend = (
  code: TransferCode,
  payload: TransferPayload,
  config: CollabConfig,
  handlers: { onReceiverJoined: () => void; onProgress: (p: number) => void; onAcknowledged: () => void },
): TransferHandle => {
  const ydoc = new Y.Doc();
  const provider = createProvider(roomNameFor(code.room, 'transfer'), ydoc, code.key, config);
  provider.awareness.setLocalStateField('transfer', 'sender');
  const files = ydoc.getMap<any>('transfer');
  const chunks = ydoc.getArray<string>('chunks');
  const ack = ydoc.getMap<any>('ack');
  let sent = false;
  let done = false;

  const json = JSON.stringify(payload.doc);
  const parts = chunkString(json);

  const onAwareness = () => {
    if (sent) return;
    const receiver = Array.from(provider.awareness.getStates().values()).some((s: any) => s?.transfer === 'receiver');
    if (!receiver) return;
    sent = true;
    handlers.onReceiverJoined();
    ydoc.transact(() => files.set('total', parts.length));
    parts.forEach((part, i) => {
      // one update per chunk
      ydoc.transact(() => chunks.push([part]));
      handlers.onProgress(Math.round(((i + 1) / parts.length) * 90));
    });
  };
  const onAck = () => {
    if (done || !ack.get('ok')) return;
    done = true;
    handlers.onProgress(100);
    handlers.onAcknowledged();
  };
  provider.awareness.on('change', onAwareness);
  ack.observe(onAck);

  return {
    provider,
    ydoc,
    cancel: async () => {
      provider.awareness.off('change', onAwareness);
      ack.unobserve(onAck);
      await destroyProvider(provider, ydoc);
    },
  };
};

/**
 * Receiver: joins the room, assembles the chunks and hands the document to `onDocument`.
 * `onDocument` should save it and return; we then acknowledge so the sender can report success.
 */
export const startTransferReceive = (
  code: TransferCode,
  config: CollabConfig,
  handlers: { onConnected: () => void; onProgress: (p: number) => void; onDocument: (doc: Record<string, unknown>) => void; onError: () => void },
): TransferHandle => {
  const ydoc = new Y.Doc();
  const provider = createProvider(roomNameFor(code.room, 'transfer'), ydoc, code.key, config);
  provider.awareness.setLocalStateField('transfer', 'receiver');
  const files = ydoc.getMap<any>('transfer');
  const chunks = ydoc.getArray<string>('chunks');
  const ack = ydoc.getMap<any>('ack');
  let connected = false;
  let delivered = false;

  const check = () => {
    if (delivered) return;
    const total = files.get('total');
    if (!connected && (typeof total === 'number' || chunks.length > 0)) {
      connected = true;
      handlers.onConnected();
    }
    if (typeof total !== 'number' || total <= 0) return;
    handlers.onProgress(Math.min(90, Math.round((chunks.length / total) * 90)));
    if (chunks.length < total) return;
    delivered = true;
    try {
      const doc = JSON.parse(chunks.toArray().join(''));
      if (!doc || typeof doc !== 'object') throw new Error('bad payload');
      handlers.onDocument(doc);
      ydoc.transact(() => ack.set('ok', Date.now()));
      handlers.onProgress(100);
    } catch {
      handlers.onError();
    }
  };
  const onAwareness = () => {
    if (connected) return;
    const sender = Array.from(provider.awareness.getStates().values()).some((s: any) => s?.transfer === 'sender');
    if (sender) {
      connected = true;
      handlers.onConnected();
    }
  };
  ydoc.on('update', check);
  provider.awareness.on('change', onAwareness);

  return {
    provider,
    ydoc,
    cancel: async () => {
      ydoc.off('update', check);
      provider.awareness.off('change', onAwareness);
      await destroyProvider(provider, ydoc);
    },
  };
};
