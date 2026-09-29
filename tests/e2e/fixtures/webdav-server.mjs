// Minimal in-memory WebDAV server for sync tests (PROPFIND / GET / PUT / DELETE / MKCOL,
// conditional PUT with If-Match / If-None-Match, Basic auth, CORS for browser clients).
//
//   node tests/e2e/fixtures/webdav-server.mjs [port]      (user "penko", password "secret")
import http from 'node:http';
import crypto from 'node:crypto';

const CORS_HEADERS = {
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, MKCOL, PROPFIND, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Depth, If-Match, If-None-Match',
  'Access-Control-Expose-Headers': 'ETag',
  'Access-Control-Max-Age': '600',
};

const xmlEscape = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * @param {{ port?: number, username?: string, password?: string, cors?: boolean }} [opts]
 * @returns {Promise<{ url: string, port: number, files: Map<string, {data: Buffer, etag: string}>, dirs: Set<string>, requests: string[], setOffline: (v: boolean) => void, close: () => Promise<void> }>}
 */
export const startWebDavServer = (opts = {}) => {
  const { port = 0, username = 'penko', password = 'secret', cors = true } = opts;
  const files = new Map();
  const dirs = new Set(['/']);
  const requests = [];
  let offline = false;
  const expectedAuth = 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64');

  const norm = p => {
    let s = decodeURIComponent(p.split('?')[0]).replace(/\/+/g, '/');
    if (s.length > 1 && s.endsWith('/')) s = s.slice(0, -1);
    return s || '/';
  };
  const parent = p => (p.lastIndexOf('/') <= 0 ? '/' : p.slice(0, p.lastIndexOf('/')));
  const etagOf = data => `"${crypto.createHash('sha1').update(data).digest('hex').slice(0, 16)}-${Date.now().toString(36)}"`;

  const server = http.createServer((req, res) => {
    const origin = req.headers.origin;
    const headers = cors && origin ? { ...CORS_HEADERS, 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {};
    const send = (status, body = '', extra = {}) => {
      res.writeHead(status, { ...headers, ...extra });
      res.end(body);
    };
    if (offline) {
      req.socket.destroy();
      return;
    }
    if (req.method === 'OPTIONS') return send(204);
    requests.push(`${req.method} ${req.url}`);
    if (req.headers.authorization !== expectedAuth) return send(401, 'Unauthorized', { 'WWW-Authenticate': 'Basic realm="penko"' });

    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const path = norm(req.url || '/');
      switch (req.method) {
        case 'PROPFIND': {
          const depth = req.headers.depth === '0' ? 0 : 1;
          const isDir = dirs.has(path);
          if (!isDir && !files.has(path)) return send(404);
          const entries = [];
          const entry = (p, dir) => {
            const f = files.get(p);
            const href = p === '/' ? '/' : p.split('/').map(encodeURIComponent).join('/') + (dir ? '/' : '');
            return `<d:response><d:href>${xmlEscape(href)}</d:href><d:propstat><d:prop>${
              dir ? '<d:resourcetype><d:collection/></d:resourcetype>' : `<d:resourcetype/><d:getetag>${xmlEscape(f.etag)}</d:getetag><d:getcontentlength>${f.data.length}</d:getcontentlength>`
            }</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`;
          };
          entries.push(entry(path, isDir));
          if (isDir && depth === 1) {
            const prefix = path === '/' ? '/' : `${path}/`;
            dirs.forEach(d => d !== path && d.startsWith(prefix) && !d.slice(prefix.length).includes('/') && entries.push(entry(d, true)));
            files.forEach((_f, p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/') && entries.push(entry(p, false)));
          }
          return send(207, `<?xml version="1.0" encoding="utf-8"?><d:multistatus xmlns:d="DAV:">${entries.join('')}</d:multistatus>`, {
            'Content-Type': 'application/xml; charset=utf-8',
          });
        }
        case 'GET': {
          const f = files.get(path);
          if (!f) return send(404);
          return send(200, f.data, { 'Content-Type': 'application/octet-stream', ETag: f.etag });
        }
        case 'PUT': {
          if (!dirs.has(parent(path))) return send(409);
          const existing = files.get(path);
          const ifMatch = req.headers['if-match'];
          const ifNoneMatch = req.headers['if-none-match'];
          if (ifNoneMatch === '*' && existing) return send(412);
          if (ifMatch && (!existing || (ifMatch !== '*' && ifMatch !== existing.etag))) return send(412);
          const etag = etagOf(body);
          files.set(path, { data: body, etag });
          return send(existing ? 204 : 201, '', { ETag: etag });
        }
        case 'DELETE': {
          if (files.delete(path)) return send(204);
          if (dirs.has(path) && path !== '/') {
            const prefix = `${path}/`;
            [...files.keys()].forEach(p => p.startsWith(prefix) && files.delete(p));
            [...dirs].forEach(d => (d === path || d.startsWith(prefix)) && dirs.delete(d));
            return send(204);
          }
          return send(404);
        }
        case 'MKCOL': {
          if (dirs.has(path) || files.has(path)) return send(405);
          if (!dirs.has(parent(path))) return send(409);
          dirs.add(path);
          return send(201);
        }
        default:
          return send(405);
      }
    });
  });

  return new Promise(resolve => {
    server.listen(port, '127.0.0.1', () => {
      const actual = server.address().port;
      resolve({
        url: `http://127.0.0.1:${actual}/`,
        port: actual,
        files,
        dirs,
        requests,
        setOffline: v => (offline = v),
        close: () =>
          new Promise(r => {
            server.closeAllConnections?.();
            server.close(() => r());
          }),
      });
    });
  });
};

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.argv[2] || 4918);
  startWebDavServer({ port }).then(s => console.log(`WebDAV test server on ${s.url} (penko / secret)`));
}
