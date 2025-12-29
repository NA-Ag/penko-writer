// P2P Collaboration using WebRTC and Yjs
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export interface CollaborationSession {
  doc: Y.Doc;
  provider: WebrtcProvider;
  roomId: string;
  awareness: any;
}

export interface Participant {
  id: number;
  name: string;
  color: string;
  cursor?: { line: number; ch: number };
}

/**
 * Generate a random room ID for collaboration
 */
export function generateRoomId(): string {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Generate a random color for user avatar
 */
function generateUserColor(): string {
  const colors = [
    '#3b82f6', // blue
    '#ef4444', // red
    '#10b981', // green
    '#f59e0b', // amber
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#14b8a6', // teal
    '#f97316', // orange
  ];
  return colors[Math.floor(Math.random() * colors.length)];
}

/**
 * Start a collaboration session
 */
export function startCollaborationSession(
  roomId: string,
  userName: string,
  onContentChange: (content: string) => void,
  initialContent?: string
): CollaborationSession {
  // Create a new Yjs document
  const ydoc = new Y.Doc();

  // Get the shared text type
  const ytext = ydoc.getText('content');

  // Set initial content if provided
  if (initialContent && ytext.toString() === '') {
    ytext.insert(0, initialContent);
  }

  // Create WebRTC provider for P2P connection
  const provider = new WebrtcProvider(roomId, ydoc, {
    signaling: [
      'wss://signaling.yjs.dev', // Default Yjs signaling server
      'wss://y-webrtc-signaling-eu.herokuapp.com',
      'wss://y-webrtc-signaling-us.herokuapp.com',
    ],
    password: null, // No password for now (can add encryption later)
    awareness: undefined, // Will be created automatically
    maxConns: 20 + Math.floor(Math.random() * 15), // Random max connections
    filterBcConns: true,
    peerOpts: {}, // Simple-peer options
  });

  // Get awareness (for showing cursors and presence)
  const awareness = provider.awareness;

  // Set local user info
  awareness.setLocalStateField('user', {
    name: userName,
    color: generateUserColor(),
  });

  // Listen for content changes
  ytext.observe((event) => {
    const content = ytext.toString();
    onContentChange(content);
  });

  // Log connection status
  provider.on('status', (event: any) => {
    console.log('[Collaboration] Status:', event.status);
  });

  provider.on('synced', (event: any) => {
    console.log('[Collaboration] Synced:', event);
  });

  provider.on('peers', (event: any) => {
    console.log('[Collaboration] Peers changed:', event);
  });

  return {
    doc: ydoc,
    provider,
    roomId,
    awareness,
  };
}

/**
 * Update the shared document content
 */
export function updateSharedContent(session: CollaborationSession, newContent: string): void {
  const ytext = session.doc.getText('content');
  const currentContent = ytext.toString();

  if (currentContent !== newContent) {
    // Replace entire content
    ytext.delete(0, currentContent.length);
    ytext.insert(0, newContent);
  }
}

/**
 * Get all participants in the session
 */
export function getParticipants(session: CollaborationSession): Participant[] {
  const participants: Participant[] = [];
  const states = session.awareness.getStates();

  states.forEach((state: any, clientId: number) => {
    if (state.user) {
      participants.push({
        id: clientId,
        name: state.user.name || 'Anonymous',
        color: state.user.color || '#gray',
        cursor: state.cursor,
      });
    }
  });

  return participants;
}

/**
 * Update cursor position for local user
 */
export function updateCursor(session: CollaborationSession, position: { line: number; ch: number }): void {
  session.awareness.setLocalStateField('cursor', position);
}

/**
 * Leave the collaboration session
 */
export function leaveCollaborationSession(session: CollaborationSession): void {
  console.log('[Collaboration] Leaving session:', session.roomId);

  // Disconnect provider
  session.provider.disconnect();
  session.provider.destroy();

  // Destroy document
  session.doc.destroy();
}

/**
 * Get connection status
 */
export function getConnectionStatus(session: CollaborationSession): {
  connected: boolean;
  synced: boolean;
  peers: number;
} {
  const states = session.awareness.getStates();

  return {
    connected: session.provider.connected,
    synced: session.provider.synced,
    peers: states.size - 1, // Exclude self
  };
}

/**
 * Export collaboration session data for debugging
 */
export function getSessionInfo(session: CollaborationSession): {
  roomId: string;
  content: string;
  participants: Participant[];
  status: ReturnType<typeof getConnectionStatus>;
} {
  return {
    roomId: session.roomId,
    content: session.doc.getText('content').toString(),
    participants: getParticipants(session),
    status: getConnectionStatus(session),
  };
}
