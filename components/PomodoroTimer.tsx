import React from 'react';
import { Play, Pause, RotateCcw, X, Minimize2, Settings } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';

interface PomodoroTimerProps {
  darkMode: boolean;
  uiLanguage: LanguageCode;
  onClose: () => void;
  onStrictBreak?: (isBreak: boolean) => void;
}

type PomodoroPhase = 'work' | 'break';

/** Parses a minutes input, clamped to [1, max]. */
const clampMinutes = (value: string, max: number) => Math.min(max, Math.max(1, parseInt(value, 10) || 1));

export const PomodoroTimer: React.FC<PomodoroTimerProps> = ({
  darkMode,
  uiLanguage,
  onClose,
  onStrictBreak,
}) => {
  const [workDuration, setWorkDuration] = React.useState(25);
  const [breakDuration, setBreakDuration] = React.useState(5);
  const [strictBreakMode, setStrictBreakMode] = React.useState(false);
  const [isMinimized, setIsMinimized] = React.useState(false);
  const [showSettings, setShowSettings] = React.useState(false);
  const strictId = React.useId();

  const [phase, setPhase] = React.useState<PomodoroPhase>('work');
  const [timeLeft, setTimeLeft] = React.useState(workDuration * 60);
  const [isRunning, setIsRunning] = React.useState(false);
  const [completedPomodoros, setCompletedPomodoros] = React.useState(0);

  // Absolute end time of the running phase: immune to interval drift and
  // background-tab throttling.
  const endAtRef = React.useRef(0);
  const audioCtxRef = React.useRef<AudioContext | null>(null);
  const onStrictBreakRef = React.useRef(onStrictBreak);
  onStrictBreakRef.current = onStrictBreak;

  // Tell the parent whether writing is locked (always report, so unticking
  // strict mode or closing the timer releases the lock).
  const locked = strictBreakMode && phase === 'break' && isRunning;
  React.useEffect(() => {
    onStrictBreakRef.current?.(locked);
  }, [locked]);
  React.useEffect(() => () => {
    onStrictBreakRef.current?.(false);
    void audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
  }, []);

  const playNotificationSound = () => {
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      if (!audioCtxRef.current) audioCtxRef.current = new Ctor();
      const audioContext = audioCtxRef.current;
      void audioContext.resume?.().catch(() => {});
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
      oscillator.onended = () => {
        oscillator.disconnect();
        gainNode.disconnect();
      };
    } catch {
      /* audio unavailable */
    }
  };

  // Phase transition (runs once per completed phase, outside state updaters)
  const completePhase = () => {
    playNotificationSound();
    if (phase === 'work') {
      setCompletedPomodoros(c => c + 1);
      setPhase('break');
      setTimeLeft(breakDuration * 60);
      if (strictBreakMode) {
        // Auto-start the break in strict mode
        endAtRef.current = Date.now() + breakDuration * 60 * 1000;
      } else {
        endAtRef.current = 0;
        setIsRunning(false);
      }
    } else {
      endAtRef.current = 0;
      setPhase('work');
      setTimeLeft(workDuration * 60);
      setIsRunning(false);
    }
  };
  const completePhaseRef = React.useRef(completePhase);
  completePhaseRef.current = completePhase;

  // Timer countdown logic
  React.useEffect(() => {
    if (!isRunning) return;
    const tick = () => {
      if (!endAtRef.current) return;
      const remaining = Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000));
      if (remaining <= 0) {
        completePhaseRef.current();
        return;
      }
      setTimeLeft(prev => (prev === remaining ? prev : remaining));
    };
    tick();
    const interval = window.setInterval(tick, 250);
    document.addEventListener('visibilitychange', tick);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [isRunning, phase]);

  const toggleTimer = () => {
    if (!isRunning) endAtRef.current = Date.now() + timeLeft * 1000;
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    endAtRef.current = 0;
    setIsRunning(false);
    setTimeLeft(phase === 'work' ? workDuration * 60 : breakDuration * 60);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = phase === 'work'
    ? ((workDuration * 60 - timeLeft) / (workDuration * 60)) * 100
    : ((breakDuration * 60 - timeLeft) / (breakDuration * 60)) * 100;

  const bgColor = darkMode ? 'bg-black/40' : 'bg-white/80';
  const borderColor = darkMode ? 'border-gray-800' : 'border-gray-200';
  const buttonHover = darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100';

  // Minimized view
  if (isMinimized) {
    return (
      <button
        type="button"
        className={`${bgColor} backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border ${borderColor} flex items-center gap-2 cursor-pointer opacity-60 hover:opacity-100 transition-opacity`}
        onClick={() => setIsMinimized(false)}
        title={t(uiLanguage, 'pomodoroTimer')}
        aria-label={`${t(uiLanguage, 'pomodoroTimer')} ${formatTime(timeLeft)}`}
      >
        <div className="text-xs font-mono font-bold text-green-500">
          {formatTime(timeLeft)}
        </div>
        {isRunning && (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </button>
    );
  }

  return (
    <div className={`${bgColor} backdrop-blur-sm rounded-xl p-6 shadow-xl border ${borderColor} w-[280px]`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm font-semibold">
          {t(uiLanguage, 'pomodoroTimer')}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1 rounded transition-colors ${buttonHover} ${showSettings ? 'bg-blue-600 text-white' : ''}`}
            title={t(uiLanguage, 'settings')}
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1 rounded transition-colors ${buttonHover}`}
            title={t(uiLanguage, 'minimize')}
          >
            <Minimize2 size={16} />
          </button>
          <button
            onClick={onClose}
            className={`p-1 rounded transition-colors ${buttonHover}`}
            title={t(uiLanguage, 'close')}
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Settings Panel */}
      {showSettings && (
        <div className={`mb-4 p-4 rounded-lg ${darkMode ? 'bg-gray-800/50' : 'bg-gray-100'} space-y-3`}>
          <div>
            <label className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'workDurationMinutes')}</label>
            <input
              type="number"
              min="1"
              max="120"
              value={workDuration}
              onChange={(e) => {
                const val = clampMinutes(e.target.value, 120);
                setWorkDuration(val);
                if (phase === 'work' && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
              className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700' : 'bg-white'} outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <div>
            <label className="text-xs opacity-60 block mb-1">{t(uiLanguage, 'breakDurationMinutes')}</label>
            <input
              type="number"
              min="1"
              max="60"
              value={breakDuration}
              onChange={(e) => {
                const val = clampMinutes(e.target.value, 60);
                setBreakDuration(val);
                if (phase === 'break' && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
              className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700' : 'bg-white'} outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={strictId}
              checked={strictBreakMode}
              onChange={(e) => setStrictBreakMode(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <label htmlFor={strictId} className="text-xs cursor-pointer">
              {t(uiLanguage, 'strictBreakMode')}
            </label>
          </div>
        </div>
      )}

      {/* Phase Indicator */}
      <div className="text-center mb-4">
        <div className={`inline-block px-4 py-1.5 rounded-full text-sm font-medium ${
          phase === 'work'
            ? 'bg-red-500/20 text-red-600 dark:text-red-400'
            : 'bg-green-500/20 text-green-600 dark:text-green-400'
        }`}>
          {phase === 'work' ? t(uiLanguage, 'workTime') : t(uiLanguage, 'breakTime')}
        </div>
      </div>

      {/* Timer Display */}
      <div className="text-center mb-4">
        <div className="text-5xl font-mono font-bold tracking-wider">
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Progress Bar */}
      <div className={`w-full h-2 rounded-full mb-6 overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
        <div
          className={`h-full transition-all duration-1000 ${
            phase === 'work' ? 'bg-red-500' : 'bg-green-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mb-4">
        <button
          onClick={toggleTimer}
          className={`p-3 rounded-lg transition-colors ${
            isRunning
              ? 'bg-yellow-500 hover:bg-yellow-600 text-white'
              : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
          title={isRunning ? t(uiLanguage, 'pause') : t(uiLanguage, 'start')}
        >
          {isRunning ? <Pause size={20} /> : <Play size={20} />}
        </button>

        <button
          onClick={resetTimer}
          className={`p-3 rounded-lg transition-colors ${buttonHover}`}
          title={t(uiLanguage, 'reset')}
        >
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Stats */}
      <div className="text-center text-sm opacity-60">
        {t(uiLanguage, 'completedPomodoros')}: {completedPomodoros}
      </div>
    </div>
  );
};
