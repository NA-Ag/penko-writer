/**
 * Minimal WebDAV client (fetch-based: PROPFIND / GET / PUT / DELETE / MKCOL).
 *
 * Browsers only allow these cross-origin requests when the server answers the
 * CORS preflight (OPTIONS) with the right headers. A request blocked by CORS
 * fails exactly like an unreachable server (a TypeError), so failures are
 * classified with an extra `no-cors` probe: if the server answers that, it is
 * reachable and the problem is CORS.
 */

export type WebDavErrorKind = 'auth' | 'forbidden' | 'notFound' | 'precondition' | 'offline' | 'cors' | 'network' | 'http' | 'badUrl';

export class WebDavError extends Error {
  kind: WebDavErrorKind;
  status: number;
  constructor(kind: WebDavErrorKind, message: string, status = 0) {
    super(message);
    this.name = 'WebDavError';
    this.kind = kind;
    this.status = status;
  }
}

export interface WebDavCredentials {
  url: string;
  username: string;
  password: string;
}

export interface DavEntry {
  /** Decoded last path segment. */
  name: string;
  isDir: boolean;
  etag: string | null;
  size: number;
}

type FetchLike = typeof fetch;

/** Normalises a user-entered server URL (adds https://, a trailing slash). Null if invalid. */
export const normalizeDavUrl = (input: string): string | null => {
  let s = (input || '').trim();
  if (!s) return null;
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) s = `https://${s}`;
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
    if (u.username || u.password) return null;
    u.hash = '';
    u.search = '';
    if (!u.pathname.endsWith('/')) u.pathname += '/';
    return u.toString();
  } catch {
    return null;
  }
};

/** True when credentials would travel unencrypted to another machine. */
export const isInsecureUrl = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  } catch {
    return false;
  }
};

const utf8ToBase64 = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  bytes.forEach(b => (bin += String.fromCharCode(b)));
  return btoa(bin);
};

const DAV_NS = 'DAV:';

/** Parses a PROPFIND multistatus body. The collection itself (first entry for Depth 1) is included. */
export const parsePropfind = (xml: string): (DavEntry & { href: string })[] => {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out: (DavEntry & { href: string })[] = [];
  const responses = Array.from(doc.getElementsByTagNameNS(DAV_NS, 'response'));
  for (const r of responses) {
    const href = r.getElementsByTagNameNS(DAV_NS, 'href')[0]?.textContent?.trim() || '';
    if (!href) continue;
    // only the propstat that succeeded
    const propstats = Array.from(r.getElementsByTagNameNS(DAV_NS, 'propstat'));
    const ok = propstats.find(ps => /\s200\s/.test(` ${ps.getElementsByTagNameNS(DAV_NS, 'status')[0]?.textContent || ''} `)) || propstats[0] || r;
    const prop = (name: string) => ok.getElementsByTagNameNS(DAV_NS, name)[0];
    const isDir = !!prop('resourcetype')?.getElementsByTagNameNS(DAV_NS, 'collection')[0];
    let path = href;
    try {
      path = new URL(href, 'http://x').pathname;
    } catch {
      /* relative */
    }
    const segs = path.split('/').filter(Boolean);
    let name = segs[segs.length - 1] || '';
    try {
      name = decodeURIComponent(name);
    } catch {
      /* keep raw */
    }
    out.push({
      href: path,
      name,
      isDir,
      etag: prop('getetag')?.textContent?.trim() || null,
      size: Number(prop('getcontentlength')?.textContent || 0) || 0,
    });
  }
  return out;
};

const PROPFIND_BODY =
  '<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/><d:getetag/><d:getcontentlength/></d:prop></d:propfind>';

export class WebDavClient {
  readonly base: string;
  private auth: string;
  private fetchImpl: FetchLike;

  constructor(creds: WebDavCredentials, fetchImpl?: FetchLike) {
    const base = normalizeDavUrl(creds.url);
    if (!base) throw new WebDavError('badUrl', 'Invalid server URL');
    this.base = base;
    this.auth = `Basic ${utf8ToBase64(`${creds.username}:${creds.password}`)}`;
    this.fetchImpl = fetchImpl || ((input, init) => fetch(input, init));
  }

  /** Absolute URL of a path relative to the base ("Penko/docs/x.bin"); segments are percent-encoded. */
  url(path: string) {
    return this.base + path.split('/').filter(Boolean).map(encodeURIComponent).join('/') + (path.endsWith('/') ? '/' : '');
  }

  private async request(method: string, path: string, init: { body?: BodyInit; headers?: Record<string, string> } = {}): Promise<Response> {
    let res: Response;
    try {
      res = await this.fetchImpl(this.url(path), {
        method,
        body: init.body,
        headers: { Authorization: this.auth, ...(init.headers || {}) },
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'follow',
      });
    } catch (e) {
      throw await this.classifyNetworkError(e);
    }
    if (res.status === 401) throw new WebDavError('auth', 'Wrong username or password', 401);
    if (res.status === 403) throw new WebDavError('forbidden', 'Access denied', 403);
    return res;
  }

  private async classifyNetworkError(e: unknown): Promise<WebDavError> {
    if (e instanceof WebDavError) return e;
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return new WebDavError('offline', 'You are offline');
    // A no-cors request isn't subject to CORS: if it goes through, the server is reachable and CORS is the problem.
    try {
      await this.fetchImpl(this.base, { method: 'GET', mode: 'no-cors', cache: 'no-store', credentials: 'omit' });
      return new WebDavError('cors', 'The server does not allow requests from this app (CORS)');
    } catch {
      return new WebDavError('network', 'Could not reach the server');
    }
  }

  private fail(res: Response, what: string): never {
    if (res.status === 404 || res.status === 409) throw new WebDavError('notFound', `${what}: not found`, res.status);
    if (res.status === 412) throw new WebDavError('precondition', `${what}: changed on the server`, 412);
    throw new WebDavError('http', `${what}: HTTP ${res.status}`, res.status);
  }

  async propfind(path: string, depth: 0 | 1 = 1): Promise<DavEntry[]> {
    const dirPath = path.endsWith('/') || !path ? path : `${path}/`;
    const res = await this.request('PROPFIND', dirPath, { body: PROPFIND_BODY, headers: { Depth: String(depth), 'Content-Type': 'application/xml; charset=utf-8' } });
    if (res.status !== 207 && res.status !== 200) this.fail(res, 'PROPFIND');
    const entries = parsePropfind(await res.text());
    const self = new URL(this.url(dirPath)).pathname.replace(/\/+$/, '');
    const selfDecoded = safeDecode(self);
    return entries
      .filter(e => {
        const p = e.href.replace(/\/+$/, '');
        return p !== self && safeDecode(p) !== selfDecoded;
      })
      .map(({ href: _href, ...rest }) => rest);
  }

  /** Null when the file doesn't exist. */
  async get(path: string): Promise<{ data: Uint8Array; etag: string | null } | null> {
    const res = await this.request('GET', path);
    if (res.status === 404) return null;
    if (!res.ok) this.fail(res, 'GET');
    return { data: new Uint8Array(await res.arrayBuffer()), etag: res.headers.get('ETag') };
  }

  /** `ifMatch`: only overwrite that version; `ifNoneMatch: true`: only create. Throws 'precondition' otherwise. */
  async put(path: string, data: Uint8Array | string, opts: { ifMatch?: string | null; ifNoneMatch?: boolean; contentType?: string } = {}): Promise<{ etag: string | null }> {
    const headers: Record<string, string> = { 'Content-Type': opts.contentType || 'application/octet-stream' };
    if (opts.ifMatch) headers['If-Match'] = opts.ifMatch;
    if (opts.ifNoneMatch) headers['If-None-Match'] = '*';
    const body = typeof data === 'string' ? data : new Blob([data as Uint8Array<ArrayBuffer>]);
    const res = await this.request('PUT', path, { body, headers });
    if (!res.ok) this.fail(res, 'PUT');
    return { etag: res.headers.get('ETag') || res.headers.get('OC-ETag') };
  }

  /** Deleting something that is already gone is not an error. */
  async delete(path: string): Promise<void> {
    const res = await this.request('DELETE', path);
    if (!res.ok && res.status !== 404) this.fail(res, 'DELETE');
  }

  /** Creates a folder; an existing folder is fine (405). */
  async mkcol(path: string): Promise<void> {
    const res = await this.request('MKCOL', path.endsWith('/') ? path : `${path}/`);
    if (res.ok || res.status === 405) return;
    this.fail(res, 'MKCOL');
  }

  /** Creates every missing folder of `path` ("a/b/c"). */
  async ensureDir(path: string): Promise<void> {
    const segs = path.split('/').filter(Boolean);
    for (let i = 1; i <= segs.length; i++) {
      const p = segs.slice(0, i).join('/');
      try {
        await this.propfind(p, 0);
      } catch (e) {
        if (e instanceof WebDavError && e.kind === 'notFound') await this.mkcol(p);
        else throw e;
      }
    }
  }
}

const safeDecode = (s: string) => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};
