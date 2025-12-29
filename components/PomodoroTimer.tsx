import React from 'react';
import { Play, Pause, RotateCcw, X, Minimize2, Maximize2, Settings } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';

interface PomodoroTimerProps {
  darkMode: boolean;
  uiLanguage: LanguageCode;
  onClose: () => void;
  onStrictBreak?: (isBreak: boolean) => void;
}

type PomodoroPhase = 'work' | 'break';

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

  const [phase, setPhase] = React.useState<PomodoroPhase>('work');
  const [timeLeft, setTimeLeft] = React.useState(workDuration * 60);
  const [isRunning, setIsRunning] = React.useState(false);
  const [completedPomodoros, setCompletedPomodoros] = React.useState(0);

  // Notify parent about strict break mode
  React.useEffect(() => {
    if (onStrictBreak && strictBreakMode) {
      onStrictBreak(phase === 'break' && isRunning);
    }
  }, [phase, isRunning, strictBreakMode, onStrictBreak]);

  // Timer countdown logic
  React.useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Phase complete
          if (phase === 'work') {
            setCompletedPomodoros((c) => c + 1);
            setPhase('break');
            playNotificationSound();
            // Auto-start break if strict mode enabled
            if (strictBreakMode) {
              return breakDuration * 60;
            } else {
              setIsRunning(false);
              return breakDuration * 60;
            }
          } else {
            setPhase('work');
            setIsRunning(false);
            playNotificationSound();
            return workDuration * 60;
          }
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, phase, workDuration, breakDuration, strictBreakMode]);

  const playNotificationSound = () => {
    // Create a simple beep sound
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
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
  };

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
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
      <div
        className={`${bgColor} backdrop-blur-sm rounded-lg px-3 py-2 shadow-lg border ${borderColor} flex items-center gap-2 cursor-pointer opacity-60 hover:opacity-100 transition-opacity`}
        onClick={() => setIsMinimized(false)}
      >
        <div className="text-xs font-mono font-bold text-green-500">
          {formatTime(timeLeft)}
        </div>
        {isRunning && (
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        )}
      </div>
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
            title="Settings"
          >
            <Settings size={16} />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className={`p-1 rounded transition-colors ${buttonHover}`}
            title="Minimize"
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
            <label className="text-xs opacity-60 block mb-1">Work Duration (minutes)</label>
            <input
              type="number"
              min="1"
              max="120"
              value={workDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
                setWorkDuration(val);
                if (phase === 'work' && !isRunning) {
                  setTimeLeft(val * 60);
                }
              }}
              className={`w-full px-3 py-2 rounded-lg border ${borderColor} ${darkMode ? 'bg-gray-700' : 'bg-white'} outline-none focus:ring-2 focus:ring-blue-500`}
            />
          </div>
          <div>
            <label className="text-xs opacity-60 block mb-1">Break Duration (minutes)</label>
            <input
              type="number"
              min="1"
              max="60"
              value={breakDuration}
              onChange={(e) => {
                const val = parseInt(e.target.value) || 1;
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
              id="strictBreak"
              checked={strictBreakMode}
              onChange={(e) => setStrictBreakMode(e.target.checked)}
              className="w-4 h-4 accent-blue-600 cursor-pointer"
            />
            <label htmlFor="strictBreak" className="text-xs cursor-pointer">
              Strict Break Mode (disable writing during breaks)
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
