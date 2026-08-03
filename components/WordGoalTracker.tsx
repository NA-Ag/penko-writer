import React from 'react';
import { Target, X, Check } from 'lucide-react';
import { LanguageCode, t } from '../utils/translations';

interface WordGoalTrackerProps {
  currentWords: number;
  goalWords?: number;
  onSetGoal: (goal: number | undefined) => void;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

export const WordGoalTracker: React.FC<WordGoalTrackerProps> = ({
  currentWords,
  goalWords,
  onSetGoal,
  darkMode,
  uiLanguage,
}) => {
  const [isEditingGoal, setIsEditingGoal] = React.useState(false);
  const [goalInput, setGoalInput] = React.useState(goalWords?.toString() || '');

  const handleSetGoal = () => {
    const goal = parseInt(goalInput);
    if (!isNaN(goal) && goal > 0) {
      onSetGoal(goal);
      setIsEditingGoal(false);
    }
  };

  const handleClearGoal = () => {
    onSetGoal(undefined);
    setGoalInput('');
    setIsEditingGoal(false);
  };

  const progress = goalWords ? Math.min((currentWords / goalWords) * 100, 100) : 0;
  const isComplete = goalWords ? currentWords >= goalWords : false;
  const remaining = goalWords ? Math.max(goalWords - currentWords, 0) : 0;

  const bgColor = darkMode ? 'bg-black/40' : 'bg-white/80';
  const borderColor = darkMode ? 'border-gray-800' : 'border-gray-200';
  const inputBg = darkMode ? 'bg-gray-800' : 'bg-white';
  const buttonHover = darkMode ? 'hover:bg-white/10' : 'hover:bg-gray-100';

  return (
    <div className={`${bgColor} backdrop-blur-sm border-b ${borderColor} px-6 py-3`}>
      {isEditingGoal ? (
        // Edit Mode
        <div className="flex items-center gap-3 max-w-2xl mx-auto">
          <Target size={20} className="text-blue-600" />
          <input
            type="number"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSetGoal()}
            placeholder={t(uiLanguage, 'enterWordGoal')}
            className={`flex-1 px-3 py-1.5 rounded-lg border ${borderColor} ${inputBg} outline-none focus:ring-2 focus:ring-blue-500`}
            autoFocus
          />
          <button
            onClick={handleSetGoal}
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            title={t(uiLanguage, 'setGoal')}
          >
            <Check size={18} />
          </button>
          <button
            onClick={() => setIsEditingGoal(false)}
            className={`p-2 rounded-lg transition-colors ${buttonHover}`}
            title={t(uiLanguage, 'cancel')}
          >
            <X size={18} />
          </button>
        </div>
      ) : goalWords ? (
        // Display Mode with Goal
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Target size={18} className={isComplete ? 'text-green-500' : 'text-blue-600'} />
              <span className="text-sm font-medium">
                {currentWords} / {goalWords} {t(uiLanguage, 'words')}
                {isComplete && <span className="ml-2 text-green-500">✓ {t(uiLanguage, 'goalComplete')}</span>}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {!isComplete && (
                <span className="text-xs opacity-60">
                  {remaining} {t(uiLanguage, 'remaining')}
                </span>
              )}
              <button
                onClick={() => setIsEditingGoal(true)}
                className={`text-xs px-2 py-1 rounded transition-colors ${buttonHover}`}
              >
                {t(uiLanguage, 'edit')}
              </button>
              <button
                onClick={handleClearGoal}
                className={`text-xs px-2 py-1 rounded transition-colors ${buttonHover}`}
              >
                {t(uiLanguage, 'clear')}
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          <div className={`w-full h-2 rounded-full overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-gray-200'}`}>
            <div
              className={`h-full transition-all duration-500 ${
                isComplete ? 'bg-green-500' : 'bg-blue-600'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        // No Goal Set
        <div className="flex items-center justify-center gap-2 max-w-2xl mx-auto">
          <Target size={18} className="opacity-60" />
          <button
            onClick={() => setIsEditingGoal(true)}
            className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${buttonHover}`}
          >
            {t(uiLanguage, 'setWordGoal')}
          </button>
        </div>
      )}
    </div>
  );
};
