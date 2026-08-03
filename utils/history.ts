
import { DocumentData, HistorySnapshot } from '../types';

const HISTORY_KEY_PREFIX = 'penko_writer_history_';
const OLD_HISTORY_KEY_PREFIX = 'cloudword_history_'; // For migration

export const saveSnapshot = (doc: DocumentData) => {
  try {
    const key = `${HISTORY_KEY_PREFIX}${doc.id}`;
    let existingData = localStorage.getItem(key);

    // Migrate from old key if no new data exists
    if (!existingData) {
      const oldKey = `${OLD_HISTORY_KEY_PREFIX}${doc.id}`;
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        localStorage.setItem(key, oldData);
        existingData = oldData;
      }
    }

    let history: HistorySnapshot[] = existingData ? JSON.parse(existingData) : [];

    // Avoid saving duplicate content if it hasn't changed from the last snapshot
    if (history.length > 0) {
      const lastSnapshot = history[0];

      // Don't save if content is identical
      if (lastSnapshot.content === doc.content) {
        return;
      }

      // Calculate text difference to ensure meaningful change
      const stripHTML = (html: string) => {
        const div = document.createElement('div');
        div.innerHTML = html;
        return div.textContent || '';
      };

      const oldText = stripHTML(lastSnapshot.content);
      const newText = stripHTML(doc.content);
      const charDiff = Math.abs(newText.length - oldText.length);

      // Only save if there's a meaningful change (at least 20 characters difference)
      // OR if it's been a significant amount of time (30+ minutes)
      const timeDiff = Date.now() - lastSnapshot.timestamp;
      const significantTimePassed = timeDiff > 30 * 60 * 1000; // 30 minutes

      if (charDiff < 20 && !significantTimePassed) {
        return;
      }
    }

    const newSnapshot: HistorySnapshot = {
      timestamp: Date.now(),
      content: doc.content,
      title: doc.title
    };

    // Add to front, limit to 50 snapshots
    history = [newSnapshot, ...history].slice(0, 50);

    localStorage.setItem(key, JSON.stringify(history));
  } catch (e) {
    console.error("Failed to save snapshot", e);
  }
};

export const loadHistory = (docId: string): HistorySnapshot[] => {
  try {
    const key = `${HISTORY_KEY_PREFIX}${docId}`;
    let data = localStorage.getItem(key);

    // Migrate from old key if no new data exists
    if (!data) {
      const oldKey = `${OLD_HISTORY_KEY_PREFIX}${docId}`;
      const oldData = localStorage.getItem(oldKey);
      if (oldData) {
        localStorage.setItem(key, oldData);
        data = oldData;
      }
    }

    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};
