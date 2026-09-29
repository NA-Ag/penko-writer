import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import type { Editor as TiptapEditor } from '@tiptap/core';
import { X, Target, Clock, Volume2, VolumeX } from 'lucide-react';
import { PomodoroTimer } from './PomodoroTimer';
import { WordGoalTracker } from './WordGoalTracker';
import { LanguageCode, t } from '../utils/translations';
import { useApp } from '../AppContext';
import { createExtensions } from '../editor/extensions';
import { prepareHtmlForEditor, parseOptionsFor } from '../editor/sanitize';
import { putBlob, getBlob, deleteBlob } from '../utils/storage';
import { useSuppressDialogShortcuts } from '../utils/hooks';
import '../editor/editor.css';

interface FocusModeProps {
  onExit: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  typewriterMode: boolean;
  onToggleTypewriter: () => void;
  wordGoal?: number;
  onSetWordGoal: (goal: number | undefined) => void;
}

interface Track {
  id: string;
  name: string;
  url: string;
}

const PLAYLIST_KEY = 'penko_ambiance_playlist';
const ACTIVE_TRACK_KEY = 'penko_active_track_id';
const blobKey = (id: string) => `ambiance:${id}`;
const COMMIT_DEBOUNCE_MS = 400;

const readLS = (key: string) => {
  try { return localStorage.getItem(key); } catch { return null; }
};
const writeLS = (key: string, value: string | null) => {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage unavailable */ }
};

/** Editors created by focus mode (so a new instance never mistakes one for the main editor). */
const focusEditors = new WeakSet<TiptapEditor>();

const statsOf = (ed: TiptapEditor) => {
  const counter = (ed.storage as any).characterCount;
  return {
    words: counter?.words() ?? 0,
    characters: counter?.characters() ?? 0,
    text: ed.getText({ blockSeparator: '\n' }),
  };
};

export const FocusMode: React.FC<FocusModeProps> = ({
  onExit,
  darkMode,
  uiLanguage,
  typewriterMode,
  onToggleTypewriter,
  wordGoal,
  onSetWordGoal,
}) => {
  const {
    currentDoc,
    editor: mainEditor,
    setActiveEditor,
    flushPendingEdits,
    updateCurrentDoc,
    handleContentChange,
    setStats,
    collabSession,
    contentRevision,
    toast,
  } = useApp();

  const [showPomodoro, setShowPomodoro] = React.useState(false);
  const [showWordGoal, setShowWordGoal] = React.useState(false);
  const [showAmbiance, setShowAmbiance] = React.useState(false);
  const [showSetup, setShowSetup] = React.useState(true);
  const [tempGoal, setTempGoal] = React.useState<string>(() => String(wordGoal ?? 500));
  const [enableTimer, setEnableTimer] = React.useState(false);
  const [playlist, setPlaylist] = React.useState<Track[]>([]);
  const [activeTrackId, setActiveTrackId] = React.useState<string | null>(null);
  const [ambianceVolume, setAmbianceVolume] = React.useState(0.3);
  const [isOnStrictBreak, setIsOnStrictBreak] = React.useState(false);
  const [wordCount, setWordCount] = React.useState(0);
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const playlistLoaded = React.useRef(false);

  const docId = currentDoc?.id;
  const collab = collabSession && currentDoc && collabSession.docId === currentDoc.id ? collabSession : null;

  // The main editor (hidden underneath) is restored as the active editor on
  // exit. When focus mode is re-created for another document the active
  // editor is still the previous focus editor, which must not be used.
  const mainEditorRef = React.useRef(mainEditor && !focusEditors.has(mainEditor) ? mainEditor : null);
  // Computed once: sanitizing a long document on every render would be expensive
  const [initialHtml] = React.useState(() => {
    // Take the freshest content: the live main editor if it shows this doc.
    const main = mainEditorRef.current;
    if (main && !main.isDestroyed && !currentDoc?.isMarkdownMode) return prepareHtmlForEditor(main.getHTML());
    return prepareHtmlForEditor(currentDoc?.content || '');
  });

  // --- the focus editor ---
  const dirty = React.useRef(false);
  const commitTimer = React.useRef(0);
  const typewriterRef = React.useRef(typewriterMode);
  typewriterRef.current = typewriterMode;
  const centerCaretRef = React.useRef<() => void>(() => {});

  const editor = useEditor(
    {
      extensions: createExtensions({ paginate: false, collaboration: collab }),
      content: collab ? undefined : initialHtml,
      parseOptions: parseOptionsFor(initialHtml),
      shouldRerenderOnTransaction: false,
      immediatelyRender: true,
      editorProps: {
        attributes: {
          class: 'penko-prosemirror outline-none',
          role: 'textbox',
          'aria-label': t(uiLanguage, 'focusMode'),
          'aria-multiline': 'true',
        },
        transformPastedHTML: html => prepareHtmlForEditor(html),
      },
      onCreate: ({ editor: ed }) => {
        focusEditors.add(ed);
        ed.commands.setReferenceData({ citations: currentDoc?.citations || [], tocTitle: t(uiLanguage, 'tableOfContents'), tocEmpty: t(uiLanguage, 'noHeadingsFoundInDoc') });
      },
      onUpdate: () => {
        dirty.current = true;
        window.clearTimeout(commitTimer.current);
        commitTimer.current = window.setTimeout(() => commitRef.current(), COMMIT_DEBOUNCE_MS);
      },
      onSelectionUpdate: () => {
        if (typewriterRef.current) centerCaretRef.current();
      },
      onTransaction: ({ transaction }) => {
        if (transaction.docChanged && typewriterRef.current) centerCaretRef.current();
      },
    },
    [docId, collab?.document],
  );

  // Commit to the document store without making the (hidden) main editor
  // reload; it reloads once when focus mode closes.
  const commitRef = React.useRef<() => void>(() => {});
  commitRef.current = () => {
    window.clearTimeout(commitTimer.current);
    if (!editor || editor.isDestroyed || !dirty.current) return;
    dirty.current = false;
    const st = statsOf(editor);
    setWordCount(st.words);
    setStats(st);
    if (collab) return; // the shared Y.Doc already carries the change
    const html = editor.getHTML();
    updateCurrentDoc(d => (d.id === docId ? { content: html } : {}));
  };

  React.useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    flushPendingEdits();
    setActiveEditor(editor);
    if (!editor.isDestroyed) {
      const initial = statsOf(editor);
      setWordCount(initial.words);
      setStats(initial);
    }
    const main = mainEditorRef.current;
    return () => {
      const wasDirty = dirty.current;
      commitRef.current();
      if (!collab && !editor.isDestroyed && (wasDirty || editor.getHTML() !== initialHtml)) {
        // One external change → the main editor reloads exactly once. The
        // document id is explicit: focus mode may be closing because another
        // document was opened.
        handleContentChange(editor.getHTML(), docId);
      }
      setActiveEditor(main && !main.isDestroyed ? main : null);
      if (main && !main.isDestroyed) setStats(statsOf(main));
    };
  }, [editor]);

  // Content replaced from outside while focus mode is open (e.g. restore)
  const lastRevision = React.useRef(contentRevision);
  React.useEffect(() => {
    if (!editor || contentRevision === lastRevision.current) return;
    lastRevision.current = contentRevision;
    if (collab || !currentDoc) return;
    dirty.current = false;
    const html = prepareHtmlForEditor(currentDoc.content);
    editor.commands.setContent(html, { emitUpdate: false, parseOptions: parseOptionsFor(html) });
    const st = statsOf(editor);
    setWordCount(st.words);
    setStats(st);
  }, [contentRevision, editor]);

  // Screenplay behaviour follows the document
  React.useEffect(() => {
    const sp = editor && !editor.isDestroyed ? (editor.storage as any).screenplay : null;
    if (sp) sp.enabled = !!currentDoc?.isScreenplay;
  }, [editor, currentDoc?.isScreenplay]);

  // Strict pomodoro break locks writing
  React.useEffect(() => {
    // no update event: locking is not an edit
    if (editor && !editor.isDestroyed) editor.setEditable(!isOnStrictBreak, false);
  }, [editor, isOnStrictBreak]);

  // Focus the editor once the setup dialog is dismissed
  React.useEffect(() => {
    if (!showSetup && editor && !editor.isDestroyed) editor.commands.focus();
  }, [showSetup, editor]);

  // Dialog shortcuts (import, find, link…) would open dialogs hidden underneath
  useSuppressDialogShortcuts(true);

  // --- typewriter mode: keep the caret line vertically centred in the scroller ---
  centerCaretRef.current = () => {
    requestAnimationFrame(() => {
      const scroller = scrollRef.current;
      if (!editor || editor.isDestroyed || !scroller) return;
      let caret: { top: number; bottom: number };
      try {
        caret = editor.view.coordsAtPos(editor.state.selection.head);
      } catch {
        return;
      }
      const box = scroller.getBoundingClientRect();
      const offset = (caret.top + caret.bottom) / 2 - (box.top + box.height / 2);
      if (Math.abs(offset) > 2) scroller.scrollBy({ top: offset, behavior: Math.abs(offset) > 120 ? 'smooth' : 'auto' });
    });
  };
  React.useEffect(() => {
    if (typewriterMode) centerCaretRef.current();
  }, [typewriterMode]);

  // --- ambiance: tracks live in IndexedDB, object URLs are recreated on load ---
  React.useEffect(() => {
    let cancelled = false;
    const created: string[] = [];
    (async () => {
      let saved: Array<{ id: string; name: string }> = [];
      try {
        saved = JSON.parse(readLS(PLAYLIST_KEY) || '[]');
      } catch {
        saved = [];
      }
      const tracks: Track[] = [];
      for (const item of Array.isArray(saved) ? saved : []) {
        if (!item?.id) continue;
        const blob = await getBlob(blobKey(item.id)).catch(() => undefined);
        if (!blob) continue; // legacy blob: URLs from older versions cannot be recovered
        const url = URL.createObjectURL(blob);
        created.push(url);
        tracks.push({ id: item.id, name: String(item.name || ''), url });
      }
      if (cancelled) {
        created.forEach(u => URL.revokeObjectURL(u));
        return;
      }
      playlistLoaded.current = true;
      // keep tracks uploaded while the saved ones were loading
      setPlaylist(prev => [...tracks, ...prev.filter(p => !tracks.some(tr => tr.id === p.id))]);
      const savedActive = readLS(ACTIVE_TRACK_KEY);
      if (savedActive && tracks.some(tr => tr.id === savedActive)) setActiveTrackId(savedActive);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Revoke object URLs when focus mode closes
  const playlistRef = React.useRef(playlist);
  playlistRef.current = playlist;
  React.useEffect(() => () => playlistRef.current.forEach(tr => URL.revokeObjectURL(tr.url)), []);

  // Persist playlist metadata (never the object URLs)
  React.useEffect(() => {
    if (!playlistLoaded.current) return;
    writeLS(PLAYLIST_KEY, JSON.stringify(playlist.map(({ id, name }) => ({ id, name }))));
  }, [playlist]);

  React.useEffect(() => {
    if (!playlistLoaded.current) return;
    writeLS(ACTIVE_TRACK_KEY, activeTrackId);
  }, [activeTrackId]);

  // A single Audio element for the whole session
  const activeUrl = playlist.find(tr => tr.id === activeTrackId)?.url || null;
  React.useEffect(() => {
    if (!activeUrl) {
      audioRef.current?.pause();
      return;
    }
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.loop = true;
    }
    const audio = audioRef.current;
    audio.volume = ambianceVolume;
    if (audio.src !== activeUrl) audio.src = activeUrl;
    audio.play().catch(() => {
      /* playback may need a user gesture */
    });
  }, [activeUrl]);

  // Stop audio on exit
  React.useEffect(() => () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    audioRef.current = null;
  }, []);

  // Update volume without restarting playback
  React.useEffect(() => {
    if (audioRef.current) audioRef.current.volume = ambianceVolume;
  }, [ambianceVolume]);

  // Handle track upload
  const handleTrackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a', 'audio/mp4', 'audio/x-m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      toast.error(t(uiLanguage, 'invalidAudioFile'));
      return;
    }

    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
    try {
      await putBlob(blobKey(id), file);
    } catch {
      toast.error(t(uiLanguage, 'audioSaveFailed'));
      return;
    }
    playlistLoaded.current = true;
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, '');
    setPlaylist(prev => [...prev, { id, name, url }]);
    setActiveTrackId(id);
  };

  const handleDeleteTrack = (trackId: string) => {
    const track = playlist.find(tr => tr.id === trackId);
    if (activeTrackId === trackId) setActiveTrackId(null);
    setPlaylist(prev => prev.filter(tr => tr.id !== trackId));
    void deleteBlob(blobKey(trackId)).catch(() => {});
    if (track) {
      // Revoke after the audio element let go of it
      window.setTimeout(() => URL.revokeObjectURL(track.url), 0);
    }
  };

  const bgColor = darkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50';
  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const toolbarBg = darkMode ? 'bg-black/40' : 'bg-white/80';
  const buttonHover = darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100';

  return (
    <div className={`fixed inset-0 z-50 ${bgColor} ${textColor} flex flex-col`}>
      {showSetup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-fade-in">
          <div className={`w-full max-w-md rounded-2xl border p-6 shadow-2xl flex flex-col relative ${
            darkMode ? 'bg-zinc-900 border-zinc-800 text-gray-200 shadow-zinc-950/50' : 'bg-white border-gray-200 text-gray-900'
          }`}>
            <h2 className="text-xl font-bold mb-1 flex items-center gap-2">
              <Target className="text-blue-500" />
              {t(uiLanguage, 'enterZenSpace')}
            </h2>
            <p className="text-xs opacity-60 mb-6 font-medium">{t(uiLanguage, 'zenSetupHint')}</p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs font-semibold block mb-1.5">{t(uiLanguage, 'wordObjective')}</label>
                <input
                  type="number"
                  value={tempGoal}
                  onChange={(e) => setTempGoal(e.target.value)}
                  placeholder={t(uiLanguage, 'wordObjectivePlaceholder')}
                  className={`w-full text-sm p-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all ${
                    darkMode ? 'bg-zinc-950 border-zinc-800 text-gray-200' : 'bg-gray-50 border-gray-200'
                  }`}
                />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-gray-150 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Clock size={16} className="text-blue-500" />
                  <div>
                    <div className="text-xs font-semibold">{t(uiLanguage, 'enablePomodoro')}</div>
                    <div className="text-[10px] opacity-60">{t(uiLanguage, 'enablePomodoroHint')}</div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={enableTimer}
                  aria-label={t(uiLanguage, 'enablePomodoro')}
                  onChange={(e) => setEnableTimer(e.target.checked)}
                  className="accent-blue-600 w-4 h-4 cursor-pointer"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={onExit}
                className="flex-1 py-3 rounded-xl border text-xs font-semibold hover:bg-black/5 dark:hover:bg-white/5 transition-all text-center"
              >
                {t(uiLanguage, 'cancel')}
              </button>
              <button
                onClick={() => {
                  const goalNum = parseInt(tempGoal, 10);
                  const goal = goalNum > 0 ? goalNum : undefined;
                  onSetWordGoal(goal);
                  if (goal) setShowWordGoal(true);
                  if (enableTimer) setShowPomodoro(true);
                  setShowSetup(false);
                }}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md text-center"
              >
                {t(uiLanguage, 'enterZenSpace')}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Top Toolbar */}
      <div className={`${toolbarBg} backdrop-blur-sm border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} px-3 sm:px-6 py-3 flex items-center justify-between gap-2`}>
        <div className="flex items-center gap-1 sm:gap-4 min-w-0">
          <button
            onClick={onExit}
            className={`p-2 rounded-lg transition-colors ${buttonHover}`}
            title={t(uiLanguage, 'exitFocusMode')}
          >
            <X size={20} />
          </button>

          <div className="h-6 w-px bg-gray-300 dark:bg-gray-700" />

          <button
            onClick={() => setShowWordGoal(!showWordGoal)}
            className={`p-2 rounded-lg transition-colors ${buttonHover} ${showWordGoal ? 'bg-blue-600 text-white' : ''}`}
            title={t(uiLanguage, 'wordGoal')}
          >
            <Target size={20} />
          </button>

          <button
            onClick={() => setShowPomodoro(!showPomodoro)}
            className={`p-2 rounded-lg transition-colors ${buttonHover} ${showPomodoro ? 'bg-blue-600 text-white' : ''}`}
            title={t(uiLanguage, 'pomodoroTimer')}
          >
            <Clock size={20} />
          </button>

          <button
            onClick={() => {
              if (activeTrackId) {
                // Stop the sound
                setActiveTrackId(null);
              } else {
                // Show the menu
                setShowAmbiance(!showAmbiance);
              }
            }}
            className={`p-2 rounded-lg transition-colors ${buttonHover} ${activeTrackId ? 'bg-blue-600 text-white' : ''}`}
            title={t(uiLanguage, 'ambiance')}
          >
            {activeTrackId ? <Volume2 size={20} /> : <VolumeX size={20} />}
          </button>

          <button
            onClick={onToggleTypewriter}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${buttonHover} ${typewriterMode ? 'bg-blue-600 text-white' : ''}`}
            title={t(uiLanguage, 'typewriterMode')}
          >
            {t(uiLanguage, 'typewriterMode')}
          </button>
        </div>

        <div className="text-sm opacity-60 shrink-0 whitespace-nowrap">
          {wordCount} {t(uiLanguage, 'words')}
        </div>
      </div>

      {/* Word Goal Tracker */}
      {showWordGoal && (
        <WordGoalTracker
          currentWords={wordCount}
          goalWords={wordGoal}
          onSetGoal={onSetWordGoal}
          darkMode={darkMode}
          uiLanguage={uiLanguage}
        />
      )}

      {/* Main Editor Area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto flex justify-center relative">
        {isOnStrictBreak && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} px-8 py-6 rounded-xl shadow-2xl text-center`}>
              <div className="text-4xl mb-3">☕</div>
              <div className="text-xl font-semibold mb-2">{t(uiLanguage, 'breakTimeTitle')}</div>
              <div className="text-sm opacity-60">{t(uiLanguage, 'breakTimeHint')}</div>
            </div>
          </div>
        )}
        <EditorContent
          editor={editor}
          lang={currentDoc?.language || 'en-US'}
          spellCheck
          onClick={e => {
            if (e.target === e.currentTarget && editor && !isOnStrictBreak) editor.commands.focus('end');
          }}
          className={`
            penko-doc w-full max-w-4xl px-12 py-16 outline-none
            ${typewriterMode ? 'pt-[50vh] pb-[50vh] self-start' : ''}
            ${isOnStrictBreak ? 'pointer-events-none opacity-50' : ''}
            ${currentDoc?.isScreenplay ? 'screenplay-mode' : ''}
            ${darkMode ? 'penko-doc-dark' : ''}
            focus:outline-none
            prose prose-lg dark:prose-invert max-w-none
          `}
          style={{
            fontSize: '16px',
            lineHeight: '1.8',
            fontFamily: 'Georgia, serif',
            minHeight: typewriterMode ? '200vh' : 'auto',
          }}
        />
      </div>

      {/* Bottom Widgets */}
      <div className="absolute bottom-6 right-6 z-20 flex flex-col gap-3 items-end">
        {/* Pomodoro Timer */}
        {showPomodoro && (
          <PomodoroTimer
            darkMode={darkMode}
            uiLanguage={uiLanguage}
            onClose={() => setShowPomodoro(false)}
            onStrictBreak={setIsOnStrictBreak}
          />
        )}

        {/* Ambiance Controls */}
        {showAmbiance && (
          <div className={`${toolbarBg} backdrop-blur-sm rounded-xl p-4 shadow-xl border ${darkMode ? 'border-gray-800' : 'border-gray-200'} w-[280px] max-h-[400px] overflow-y-auto`}>
            <div className="text-sm font-semibold mb-3">{t(uiLanguage, 'ambiance')}</div>
            <div className="space-y-2">
              {/* Playlist */}
              {playlist.length > 0 && (
                <div className="space-y-1 mb-2">
                  {playlist.map((track) => (
                    <div key={track.id} className="relative">
                      <button
                        onClick={() => setActiveTrackId(activeTrackId === track.id ? null : track.id)}
                        className={`w-full px-3 py-2 rounded-lg text-sm transition-colors text-left overflow-hidden ${
                          activeTrackId === track.id ? 'bg-blue-600 text-white' : buttonHover
                        } pr-8`}
                      >
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className="flex-shrink-0">{activeTrackId === track.id ? '▶' : '🎵'}</span>
                          <span className="marquee-container overflow-hidden flex-1">
                            <span className="marquee-text inline-block whitespace-nowrap" data-text={track.name}>
                              {track.name}
                            </span>
                          </span>
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeleteTrack(track.id)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded transition-colors ${
                          darkMode ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-600'
                        }`}
                        title={t(uiLanguage, 'deleteTrack')}
                        aria-label={t(uiLanguage, 'deleteTrack')}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload button - always visible */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className={`w-full px-3 py-2 rounded-lg text-sm transition-colors border-2 border-dashed ${
                  darkMode ? 'border-gray-600 hover:border-blue-500 hover:bg-blue-500/10' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50'
                }`}
              >
                ➕ {t(uiLanguage, 'uploadTrack')}
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                onChange={e => void handleTrackUpload(e)}
                className="hidden"
              />

              {activeTrackId && (
                <div className="pt-2 border-t border-gray-300 dark:border-gray-700">
                  <label className="text-xs opacity-60 block mb-1">
                    {t(uiLanguage, 'audioVolume')}: {Math.round(ambianceVolume * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="1"
                    value={ambianceVolume * 100}
                    onChange={(e) => setAmbianceVolume(parseInt(e.target.value) / 100)}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-600"
                    style={{
                      background: `linear-gradient(to right, rgb(37, 99, 235) 0%, rgb(37, 99, 235) ${ambianceVolume * 100}%, ${darkMode ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)'} ${ambianceVolume * 100}%, ${darkMode ? 'rgb(55, 65, 81)' : 'rgb(229, 231, 235)'} 100%)`
                    }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
