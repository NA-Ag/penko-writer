import React, { useState, useEffect } from 'react';
import { Users, Copy, X, CheckCircle, AlertCircle, Wifi, WifiOff, User } from 'lucide-react';
import {
  generateRoomId,
  startCollaborationSession,
  leaveCollaborationSession,
  getParticipants,
  getConnectionStatus,
  type CollaborationSession,
  type Participant,
} from '../utils/collaboration';
import { LanguageCode, t } from '../utils/translations';

interface CollaborationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  currentContent: string;
  onContentChange: (content: string) => void;
  userName: string;
  darkMode: boolean;
  uiLanguage: LanguageCode;
}

const CollaborationDialog: React.FC<CollaborationDialogProps> = ({
  isOpen,
  onClose,
  currentContent,
  onContentChange,
  userName,
  darkMode,
  uiLanguage,
}) => {
  const [mode, setMode] = useState<'menu' | 'host' | 'join' | 'active'>('menu');
  const [roomId, setRoomId] = useState('');
  const [inputRoomId, setInputRoomId] = useState('');
  const [session, setSession] = useState<CollaborationSession | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState({ connected: false, synced: false, peers: 0 });
  const [copied, setCopied] = useState(false);

  // Update participants and status
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      setParticipants(getParticipants(session));
      setStatus(getConnectionStatus(session));
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const handleStartHosting = () => {
    const newRoomId = generateRoomId();
    setRoomId(newRoomId);

    const newSession = startCollaborationSession(
      newRoomId,
      userName,
      onContentChange,
      currentContent
    );

    setSession(newSession);
    setMode('active');
  };

  const handleJoinSession = () => {
    if (!inputRoomId.trim()) return;

    const newSession = startCollaborationSession(
      inputRoomId.trim().toUpperCase(),
      userName,
      onContentChange
    );

    setSession(newSession);
    setRoomId(inputRoomId.trim().toUpperCase());
    setMode('active');
  };

  const handleLeaveSession = () => {
    if (session) {
      leaveCollaborationSession(session);
      setSession(null);
    }
    setMode('menu');
    setRoomId('');
    setInputRoomId('');
    onClose();
  };

  const handleCopyRoomId = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 backdrop-blur-sm p-4">
      <div className={`
        max-w-md w-full rounded-2xl shadow-2xl overflow-hidden
        ${darkMode ? 'bg-[#1e1e1e]' : 'bg-white'}
      `}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white relative">
          <button
            onClick={mode === 'active' ? handleLeaveSession : onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>

          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">{t(uiLanguage, 'collaborate')}</h2>
              <p className="text-blue-100 text-sm">
                {mode === 'active' ? t(uiLanguage, 'liveSession') : t(uiLanguage, 'p2pEditing')}
              </p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Menu Mode */}
          {mode === 'menu' && (
            <div className="space-y-4">
              <button
                onClick={handleStartHosting}
                className="w-full p-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors"
              >
                <div className="text-left">
                  <div className="font-semibold mb-1">{t(uiLanguage, 'startSession')}</div>
                  <div className="text-sm text-blue-100">
                    {t(uiLanguage, 'createRoom')}
                  </div>
                </div>
              </button>

              <button
                onClick={() => setMode('join')}
                className={`
                  w-full p-4 rounded-xl transition-colors text-left
                  ${darkMode
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                  }
                `}
              >
                <div className="font-semibold mb-1">{t(uiLanguage, 'joinSession')}</div>
                <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                  {t(uiLanguage, 'enterRoomCode')}
                </div>
              </button>

              <div className={`
                p-4 rounded-xl border
                ${darkMode ? 'border-gray-700 bg-gray-800/50' : 'border-gray-200 bg-gray-50'}
              `}>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  <strong>{t(uiLanguage, 'howItWorks')}</strong> {t(uiLanguage, 'p2pDescription')}
                </p>
              </div>
            </div>
          )}

          {/* Join Mode */}
          {mode === 'join' && (
            <div className="space-y-4">
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t(uiLanguage, 'roomCode')}
                </label>
                <input
                  type="text"
                  value={inputRoomId}
                  onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                  placeholder={t(uiLanguage, 'enterCode')}
                  maxLength={8}
                  className={`
                    w-full px-4 py-3 rounded-lg font-mono text-lg tracking-wider text-center
                    ${darkMode
                      ? 'bg-gray-700 text-white border-gray-600'
                      : 'bg-gray-100 text-gray-900 border-gray-300'
                    }
                    border-2 focus:border-blue-500 outline-none transition-colors
                  `}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleJoinSession}
                  disabled={inputRoomId.length < 8}
                  className="flex-1 px-6 py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t(uiLanguage, 'joinBtn')}
                </button>
                <button
                  onClick={() => setMode('menu')}
                  className={`
                    px-6 py-3 rounded-xl font-semibold transition-colors
                    ${darkMode
                      ? 'bg-gray-700 hover:bg-gray-600 text-white'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-900'
                    }
                  `}
                >
                  {t(uiLanguage, 'back')}
                </button>
              </div>
            </div>
          )}

          {/* Active Session */}
          {mode === 'active' && (
            <div className="space-y-4">
              {/* Room ID */}
              <div>
                <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                  {t(uiLanguage, 'roomCode')}
                </label>
                <div className="flex gap-2">
                  <div className={`
                    flex-1 px-4 py-3 rounded-lg font-mono text-lg tracking-wider text-center
                    ${darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'}
                  `}>
                    {roomId}
                  </div>
                  <button
                    onClick={handleCopyRoomId}
                    className="px-4 py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                    title="Copy room code"
                  >
                    {copied ? <CheckCircle className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Connection Status */}
              <div className={`
                p-3 rounded-lg flex items-center gap-3
                ${status.connected
                  ? (darkMode ? 'bg-green-900/30 border border-green-700' : 'bg-green-50 border border-green-200')
                  : (darkMode ? 'bg-yellow-900/30 border border-yellow-700' : 'bg-yellow-50 border border-yellow-200')
                }
              `}>
                {status.connected ? (
                  <Wifi className={`w-5 h-5 ${darkMode ? 'text-green-400' : 'text-green-600'}`} />
                ) : (
                  <WifiOff className={`w-5 h-5 ${darkMode ? 'text-yellow-400' : 'text-yellow-600'}`} />
                )}
                <div>
                  <div className={`text-sm font-medium ${darkMode ? 'text-white' : 'text-gray-900'}`}>
                    {status.connected ? t(uiLanguage, 'connected') : t(uiLanguage, 'connecting')}
                  </div>
                  <div className={`text-xs ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
                    {status.peers} {status.peers === 1 ? t(uiLanguage, 'peers').slice(0, -1) : t(uiLanguage, 'peers')} {t(uiLanguage, 'online')}
                  </div>
                </div>
              </div>

              {/* Participants */}
              {participants.length > 0 && (
                <div>
                  <label className={`block text-sm font-medium mb-2 ${darkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                    {t(uiLanguage, 'participants')} ({participants.length})
                  </label>
                  <div className="space-y-2">
                    {participants.map((participant) => (
                      <div
                        key={participant.id}
                        className={`
                          flex items-center gap-3 p-2 rounded-lg
                          ${darkMode ? 'bg-gray-700' : 'bg-gray-100'}
                        `}
                      >
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-semibold"
                          style={{ backgroundColor: participant.color }}
                        >
                          {participant.name[0].toUpperCase()}
                        </div>
                        <span className={darkMode ? 'text-white' : 'text-gray-900'}>
                          {participant.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Leave Button */}
              <button
                onClick={handleLeaveSession}
                className="w-full px-6 py-3 rounded-xl font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors"
              >
                {t(uiLanguage, 'leaveSession')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CollaborationDialog;
