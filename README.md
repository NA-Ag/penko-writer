# Penko Writer

A fully functional, offline-capable rich text editor built as a Progressive Web App (PWA). Penko Writer is a free, open-source alternative to Microsoft Word, Google Docs, LibreOffice, and OnlyOffice.

## Features

- **Privacy-First**: All data stays local in your browser. No accounts, no cloud, no tracking.
- **Offline-Capable**: Works completely offline with localStorage persistence.
- **Rich Text Editing**: Full formatting support (bold, italic, underline, colors, fonts, etc.)
- **Document Management**: Create and manage multiple documents locally.
- **Advanced Features**:
  - Tables (insert, add/delete rows/columns)
  - Images (upload, resize, align)
  - Document templates
  - Page layout customization (A4/Letter, portrait/landscape, margins, columns)
  - Dark mode
  - Zen/Focus mode for distraction-free writing
  - Presentation view
  - Search & replace
  - Document statistics
  - Version history (auto-snapshots every 60 seconds)
  - Export to .doc format
  - Multi-language UI support
  - Text-to-speech reading

## Run Locally

**Prerequisites:** Node.js

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```

3. Open your browser to http://localhost:3000/

## Build for Production

```bash
npm run build
```

The built files will be in the `dist` directory, ready to be deployed to any static hosting service.

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
- **P2P Collaboration Infrastructure**: Real-time collaboration foundation (UI integration coming soon)

## Technology Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Storage**: Browser localStorage
- **Collaboration**: Yjs + WebRTC + simple-peer (infrastructure ready)
- **PWA**: Service Worker with offline support

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
