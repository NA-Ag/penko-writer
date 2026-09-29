# Penko Writer

A fully functional, offline-capable rich text editor built as a Progressive Web App (PWA). Penko Writer is a free, open-source alternative to Microsoft Word, Google Docs, LibreOffice, and OnlyOffice.

## Features

- **Privacy-First**: Documents stay in your browser (IndexedDB). No accounts, no tracking, no third-party requests at startup — fonts and styles are bundled.
- **Offline-Capable**: Installable PWA; works fully offline after the first visit.
- **Rich Text Editing** (built on [Tiptap](https://tiptap.dev) / ProseMirror): formatting, fonts, sizes, colours, highlight, paragraph shading, line spacing, lists, indentation, undo/redo.
- **Document Management**: multiple documents, autosave (also flushed when you switch documents or close the tab), version history with block-level compare & merge.
- **Advanced Features**:
  - Tables (insert grid, add/delete rows and columns, merge/split, header rows, cell shading, styles)
  - Images (drag & drop, paste, resize handles, align, rotate, borders, effects, alt text, gallery)
  - 26 templates, page layout (A4/Letter, orientation, margins, columns, page colour)
  - Real pages: paragraphs split across pages by line, page breaks, per-page headers/footers with page numbers (1 / i / "Page X of Y"), different first page, page indicator — and printing / Save as PDF that matches the screen page for page
  - Footnotes at the bottom of the page that references them (endnotes at the end of the document)
  - Section breaks: each section can have its own header/footer ("same as previous" by default), restart page numbering, a different first page and its own orientation (Layout → Orientation applies to the section at the cursor, so a wide table can sit on landscape pages in a portrait document) — shown, printed and exported to DOCX / PDF page for page, and Word sections are kept when importing a .docx
  - Citations & live bibliography (APA/MLA/Chicago/BibTeX), live table of contents, KaTeX equations, syntax-highlighted code blocks, diagrams
  - Comments with replies/resolve, track changes with accept/reject
  - Find & replace (regex, whole word, case, in selection)
  - Screenplay mode, Markdown mode, focus mode (typewriter, Pomodoro, word goals, ambiance), presentation view
  - Real-time peer-to-peer collaboration (Yjs + WebRTC, encrypted with the room password) and QR document transfer
  - Sync across your devices — end-to-end encrypted through your own WebDAV cloud (Nextcloud, ownCloud…) and/or directly between paired devices; concurrent offline edits are merged (see [Syncing between devices](#syncing-between-devices))
  - Import: DOCX, DOC (text), ODT, RTF, HTML, Markdown, TXT. Export: DOCX, PDF, HTML, Markdown, TXT, DOC, ZIP backup
  - Spell/grammar check via LanguageTool (opt-in; self-hostable server URL)
  - Dark mode, 13 UI languages, text-to-speech, mobile layout


## Run Locally

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev        # http://localhost:3100/
```

## Build for Production

```bash
npm run build          # output in dist/
npm run build:pages    # build for GitHub Pages (base path /penko-writer/)
```

Set `BASE_PATH` (e.g. `BASE_PATH=/my-subpath/ npm run build`) when hosting under a sub-path.

## Tests

```bash
npm run typecheck
npm test               # unit tests (Vitest)
npx playwright install chromium   # once
npm run test:e2e       # end-to-end tests (Playwright; starts the dev server if needed)
```



## Free & Open Source

Penko Writer is completely free to use with no costs for developers or users. Part of the larger Penko office suite.

## Documentation

- [ROADMAP.md](ROADMAP.md) - Development roadmap and future features
- [FEATURE_COMPARISON.md](FEATURE_COMPARISON.md) - Detailed comparison with Microsoft Word, Google Docs, LibreOffice, and OnlyOffice
- [LICENSE.md](LICENSE.md) - GPL v3 License

## Current Status

**Version**: Alpha
**Competitive Score**: 6/10 (Solid MVP with strong foundation)

Penko Writer is currently in alpha. It has a functional core with advanced features like track changes and comments, but there are critical gaps before it can compete head-to-head with established word processors. See [ROADMAP.md](ROADMAP.md) for development priorities.

## Unique Features (Not Found in Competitors)

- **Screenplay Formatting**: FREE alternative to Final Draft ($249)
- **Code Blocks**: Syntax highlighting for code snippets
- **Dual WYSIWYG/Markdown Mode**: Switch between visual and markdown editing
- **Local-First Privacy**: No cloud, no servers, no data collection
- **Serverless P2P Collaboration**: Real-time editing over WebRTC, no accounts

## Technology Stack

- **Framework**: React 19 + TypeScript, built with Vite
- **Editor**: Tiptap 3 (ProseMirror) with custom extensions in `editor/`
- **Styling**: Tailwind CSS (compiled at build time)
- **Storage**: IndexedDB (via idb-keyval), with a localStorage fallback
- **Collaboration**: Yjs + y-webrtc (+ Tiptap collaboration extensions)
- **Import/Export**: mammoth, docx, jsPDF + autotable, marked, turndown, JSZip
- **PWA**: vite-plugin-pwa (Workbox)


## Contributing

Contributions are welcome! Check [ROADMAP.md](ROADMAP.md) for Priority 1 and Priority 2 items that need attention.

### Development Guidelines
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

Penko Writer is licensed under the GNU General Public License v3.0. See [LICENSE.md](LICENSE.md) for details.

This means you can:
- Use it for any purpose
- Study and modify the source code
- Share copies
- Share your modifications

As long as you:
- Disclose the source code
- Keep the same GPL v3 license
- Document your changes

## Support

Found a bug? Have a feature request? Please open an issue on GitHub.

## Acknowledgments

Built with modern web technologies and a commitment to user privacy and data ownership.

## Self-hosting the collaboration signaling server

Live collaboration and QR document transfer are peer-to-peer (WebRTC via Yjs/y-webrtc). Peers still need a small WebSocket *signaling* server to find each other. It only relays connection offers, which Penko Writer encrypts with the room password, so the server never sees your document. The default is y-webrtc's public server `wss://y-webrtc-eu.fly.dev`.

To run your own:

```bash
PORT=4444 npm run signaling   # starts y-webrtc's bundled signaling server on ws://localhost:4444
```

Put it behind TLS (e.g. a reverse proxy serving `wss://signaling.example.com`) for use outside localhost, then open **Collaborate → Connection settings** in the app and list your server (one URL per line). Everyone in a session must use at least one common signaling server. Public STUN servers (Google, Cloudflare) are used for NAT traversal. If peers can't connect directly (strict corporate/mobile networks), add a TURN server in the same settings panel.

## Syncing between devices

Open **Sync** in the left rail (or Settings → Sync & devices). Two ways, usable together:

**Your own cloud (WebDAV).** Enter the WebDAV address (Nextcloud / ownCloud: `https://your-cloud/remote.php/dav/files/USERNAME/`), your username, an *app password* (create one in your cloud's security settings) and a **sync passphrase**. Use the same passphrase on every device. Penko syncs on startup, every minute, when the window regains focus, a few seconds after you edit, and when the connection comes back; changes made offline are queued and uploaded later.

The browser talks to the server directly, so the server must allow cross-origin requests (CORS) from the origin Penko runs on — the app detects a CORS block and says so:
- *Nextcloud*: install the **WebAppPassword** app and add Penko's origin (e.g. `https://penko.example.com`) to its CORS settings, or serve Penko from the same domain as Nextcloud through a reverse proxy.
- *Any other server / reverse proxy*: answer `OPTIONS` preflights and responses with `Access-Control-Allow-Origin: <penko origin>`, `Access-Control-Allow-Methods: GET, PUT, DELETE, MKCOL, PROPFIND, OPTIONS`, `Access-Control-Allow-Headers: Authorization, Content-Type, Depth, If-Match, If-None-Match` and `Access-Control-Expose-Headers: ETag`.

For testing, `node tests/e2e/fixtures/webdav-server.mjs 4918` runs a throwaway in-memory WebDAV server (user `penko`, password `secret`).

Server layout (folder `Penko/` by default): `penko-sync.json` (key-derivation parameters and an encrypted check value) and `data/` with one encrypted `<id>.state` snapshot plus `<id>.<device>.<n>.upd` update files per document and for the document index. Each device only creates new files, so devices never overwrite each other; long update logs are compacted with conditional (`If-Match`) writes.

**Paired devices (WebRTC).** Sync → Devices → *Pair a new device* shows a QR code / code; on the other device choose *Enter a pairing code*. Paired devices then sync all documents directly whenever both are open (and pass on what they received from other devices). Connections are set up through the signaling server configured under Collaborate → Connection settings. Rename or unpair devices in the same list.

**Merging.** Every document is kept as a CRDT (Yjs, the same model the live-collaboration mode uses). Edits made on two devices while they were apart — even in the same paragraph — are merged character by character, so neither side is lost; when one device deletes a paragraph that the other edited, the deletion wins. Title, page setup, header/footer and other settings are merged per field (the most recent change wins); comments and citations are merged per item. Deleting a document deletes it everywhere, unless another device edited it after the deletion. Changes arriving for the open document are applied in place (the caret stays where it is). A document changed by a newer app version is left untouched until this device is updated.

**Security model.**
- Documents, titles and all metadata are encrypted on the device before upload: AES-256-GCM with a fresh random IV per file, the file name bound as authenticated data, and a key derived from your passphrase with PBKDF2-SHA-256 (600 000 iterations, random salt). The server sees only file sizes, timestamps and random document/device ids.
- The passphrase itself is never stored. The derived key is kept on the device as a *non-extractable* WebCrypto key in IndexedDB, so sync keeps working after a restart without asking again, and the key's bytes can't be read out by scripts. Anyone who can run code in the app's origin on an unlocked device (or has full access to the browser profile) could still use it — as they could read the documents themselves. The app password and pairing secrets are stored encrypted with a separate non-extractable device key; that only protects against casual copying of the browser storage.
- There is no passphrase recovery: forget it and the server copy can't be decrypted (your local documents are unaffected). Pick a strong one — the key derivation slows guessing but can't save a weak passphrase if someone obtains the files.
- Pairing uses a one-time 80-bit code; the signaling traffic is encrypted with it (y-webrtc), and the devices then agree on a random 160-bit secret over the resulting DTLS channel. Each pair of devices has its own room derived from that secret, so an unpaired device can't reach the others. Documents travel over DTLS-encrypted WebRTC data channels; a TURN relay (if configured) only sees encrypted traffic.
- Rolling back or deleting files on the server can at worst hide recent changes or delete data it holds; it can't forge or read content. Clocks matter only for "most recent change wins" of settings fields.
