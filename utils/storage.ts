import { DocumentData } from '../types';

const STORAGE_KEY = 'penko_writer_docs';
const OLD_STORAGE_KEY = 'cloudword_docs'; // For migration

export const loadFromStorage = (): DocumentData[] => {
  try {
    // Try new key first
    let data = localStorage.getItem(STORAGE_KEY);

    // If no data, try migrating from old key
    if (!data) {
      const oldData = localStorage.getItem(OLD_STORAGE_KEY);
      if (oldData) {
        console.log('[Storage] Migrating from cloudword_docs to penko_writer_docs');
        localStorage.setItem(STORAGE_KEY, oldData);
        // Keep old data for now as backup
        data = oldData;
      }
    }

    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.error("Failed to load docs", e);
    return [];
  }
};

export const saveToStorage = (doc: DocumentData) => {
  const docs = loadFromStorage();
  const index = docs.findIndex(d => d.id === doc.id);
  
  let newDocs;
  if (index >= 0) {
    newDocs = [...docs];
    newDocs[index] = doc;
  } else {
    newDocs = [doc, ...docs];
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(newDocs));
};

export const deleteFromStorage = (docId: string) => {
  const docs = loadFromStorage();
  const filtered = docs.filter(d => d.id !== docId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
};

export const createNewDocument = (): DocumentData => {
  return {
    id: crypto.randomUUID(),
    title: '',
    content: '<p>Start typing here...</p>',
    createdAt: Date.now(),
    lastModified: Date.now(),
    pageConfig: {
      size: 'A4',
      orientation: 'portrait',
      margins: 'normal',
      cols: 1
    },
    language: 'en-US'
  };
};