import React from 'react';
import { X, Target, Clock, Volume2, VolumeX } from 'lucide-react';
import { PomodoroTimer } from './PomodoroTimer';
import { WordGoalTracker } from './WordGoalTracker';
import { LanguageCode, t } from '../utils/translations';

interface FocusModeProps {
  content: string;
  onChange: (content: string) => void;
  onExit: () => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
  typewriterMode: boolean;
  onToggleTypewriter: () => void;
  wordGoal?: number;
  onSetWordGoal: (goal: number | undefined) => void;
}

export const FocusMode: React.FC<FocusModeProps> = ({
  content,
  onChange,
  onExit,
  darkMode,
  uiLanguage,
  typewriterMode,
  onToggleTypewriter,
  wordGoal,
  onSetWordGoal,
}) => {
  const [showPomodoro, setShowPomodoro] = React.useState(false);
  const [showWordGoal, setShowWordGoal] = React.useState(false);
  const [showAmbiance, setShowAmbiance] = React.useState(false);
  const [playlist, setPlaylist] = React.useState<Array<{ id: string; name: string; url: string }>>([]);
  const [activeTrackId, setActiveTrackId] = React.useState<string | null>(null);
  const [ambianceVolume, setAmbianceVolume] = React.useState(0.3);
  const [isOnStrictBreak, setIsOnStrictBreak] = React.useState(false);
  const editorRef = React.useRef<HTMLDivElement>(null);
  const audioRef = React.useRef<HTMLAudioElement | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const isUpdatingRef = React.useRef(false);

  // Load playlist from localStorage on mount
  React.useEffect(() => {
    const savedPlaylist = localStorage.getItem('penko_ambiance_playlist');
    const savedActiveTrack = localStorage.getItem('penko_active_track_id');
    if (savedPlaylist) {
      try {
        const parsed = JSON.parse(savedPlaylist);
        setPlaylist(parsed);
      } catch (e) {
        console.error('Failed to parse playlist:', e);
      }
    }
    if (savedActiveTrack) {
      setActiveTrackId(savedActiveTrack);
    }
  }, []);

  // Initialize editor content on mount
  React.useEffect(() => {
    if (editorRef.current && !editorRef.current.innerHTML) {
      isUpdatingRef.current = true;
      editorRef.current.innerHTML = content;
      isUpdatingRef.current = false;
    }
  }, []);

  // Word count calculation
  const wordCount = React.useMemo(() => {
    const div = document.createElement('div');
    div.innerHTML = content;
    const text = div.textContent || '';
    return text.trim().split(/\s+/).filter(w => w.length > 0).length;
  }, [content]);

  // Typewriter mode effect - scroll to keep cursor centered
  React.useEffect(() => {
    if (typewriterMode && editorRef.current) {
      const handleInput = () => {
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          const editorRect = editorRef.current?.getBoundingClientRect();

          if (editorRect) {
            const desiredTop = editorRect.top + editorRect.height / 2;
            const offset = rect.top - desiredTop;

            if (Math.abs(offset) > 50) {
              editorRef.current?.scrollBy({ top: offset, behavior: 'smooth' });
            }
          }
        }
      };

      editorRef.current.addEventListener('input', handleInput);
      editorRef.current.addEventListener('keyup', handleInput);

      return () => {
        editorRef.current?.removeEventListener('input', handleInput);
        editorRef.current?.removeEventListener('keyup', handleInput);
      };
    }
  }, [typewriterMode]);

  // Ambiance audio handling
  React.useEffect(() => {
    const activeTrack = playlist.find(t => t.id === activeTrackId);

    if (activeTrack) {
      if (!audioRef.current) {
        audioRef.current = new Audio();
        audioRef.current.src = activeTrack.url;
        audioRef.current.loop = true;
        audioRef.current.volume = ambianceVolume;
        audioRef.current.play().catch(() => {
          console.log('Audio playback failed - user interaction may be required');
        });
      } else if (audioRef.current.src !== activeTrack.url) {
        // Track changed, update src and restart
        audioRef.current.src = activeTrack.url;
        audioRef.current.play().catch(() => {
          console.log('Audio playback failed - user interaction may be required');
        });
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [activeTrackId, playlist]);

  // Update volume without restarting playback
  React.useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = ambianceVolume;
    }
  }, [ambianceVolume]);

  // Save playlist to localStorage whenever it changes
  React.useEffect(() => {
    localStorage.setItem('penko_ambiance_playlist', JSON.stringify(playlist));
  }, [playlist]);

  // Save active track ID to localStorage whenever it changes
  React.useEffect(() => {
    if (activeTrackId) {
      localStorage.setItem('penko_active_track_id', activeTrackId);
    } else {
      localStorage.removeItem('penko_active_track_id');
    }
  }, [activeTrackId]);

  // Handle track upload
  const handleTrackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|wav|ogg|m4a)$/i)) {
      alert('Please upload a valid audio file (MP3, WAV, OGG, or M4A)');
      return;
    }

    // Create object URL for the file
    const url = URL.createObjectURL(file);
    const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
    const id = Date.now().toString();

    // Add to playlist
    const newTrack = { id, name, url };
    setPlaylist(prev => [...prev, newTrack]);

    // Auto-select the newly uploaded track
    setActiveTrackId(id);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteTrack = (trackId: string) => {
    const track = playlist.find(t => t.id === trackId);

    // Revoke the object URL to free memory
    if (track) {
      URL.revokeObjectURL(track.url);
    }

    // Remove from playlist
    setPlaylist(prev => prev.filter(t => t.id !== trackId));

    // Deselect if it was active
    if (activeTrackId === trackId) {
      setActiveTrackId(null);
    }
  };

  const bgColor = darkMode ? 'bg-[#1a1a1a]' : 'bg-gray-50';
  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const toolbarBg = darkMode ? 'bg-black/40' : 'bg-white/80';
  const buttonHover = darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100';

  return (
    <div className={`fixed inset-0 z-50 ${bgColor} ${textColor} flex flex-col`}>
      {/* Top Toolbar */}
      <div className={`${toolbarBg} backdrop-blur-sm border-b ${darkMode ? 'border-gray-800' : 'border-gray-200'} px-6 py-3 flex items-center justify-between`}>
        <div className="flex items-center gap-4">
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

        <div className="text-sm opacity-60">
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
      <div className="flex-1 overflow-y-auto flex justify-center relative">
        {isOnStrictBreak && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-10">
            <div className={`${darkMode ? 'bg-gray-800' : 'bg-white'} px-8 py-6 rounded-xl shadow-2xl text-center`}>
              <div className="text-4xl mb-3">☕</div>
              <div className="text-xl font-semibold mb-2">Break Time!</div>
              <div className="text-sm opacity-60">Take a rest. Writing is disabled during break.</div>
            </div>
          </div>
        )}
        <div
          ref={editorRef}
          contentEditable={!isOnStrictBreak}
          suppressContentEditableWarning
          onInput={(e) => {
            if (!isUpdatingRef.current && !isOnStrictBreak) {
              onChange(e.currentTarget.innerHTML);
            }
          }}
          className={`
            w-full max-w-4xl px-12 py-16 outline-none
            ${typewriterMode ? 'pt-[50vh]' : ''}
            ${isOnStrictBreak ? 'pointer-events-none opacity-50' : ''}
            focus:outline-none
            prose prose-lg dark:prose-invert max-w-none
          `}
          style={{
            fontSize: '16px',
            lineHeight: '1.8',
            fontFamily: darkMode ? 'Georgia, serif' : 'Georgia, serif',
            minHeight: typewriterMode ? '200vh' : 'auto',
          }}
        />
      </div>

      {/* Bottom Widgets */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3 items-end">
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
                        title="Delete track"
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
                ➕ Upload Track
              </button>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*,.mp3,.wav,.ogg,.m4a"
                onChange={handleTrackUpload}
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
