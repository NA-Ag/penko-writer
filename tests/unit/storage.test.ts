import { describe, it, expect, beforeEach } from 'vitest';
import { writeEmergencyBackup, readEmergencyBackup, pruneEmergencyBackup, loadAllDocuments, createNewDocument } from '../../utils/storage';

// jsdom has no IndexedDB, so storage uses its localStorage fallback here.
describe('emergency backup', () => {
  beforeEach(() => localStorage.clear());

  it('keeps unsaved docs and prunes them once saved', () => {
    const a = { ...createNewDocument(), content: '<p>a</p>', lastModified: 100 };
    const b = { ...createNewDocument(), content: '<p>b</p>', lastModified: 200 };
    writeEmergencyBackup([a, b]);
    expect(readEmergencyBackup().map(d => d.content).sort()).toEqual(['<p>a</p>', '<p>b</p>']);
    pruneEmergencyBackup(a);
    expect(readEmergencyBackup().map(d => d.id)).toEqual([b.id]);
    // an older saved copy does not prune a newer backup
    pruneEmergencyBackup({ ...b, lastModified: 150 });
    expect(readEmergencyBackup()).toHaveLength(1);
  });

  it('newer backup wins over the stored copy on load', async () => {
    const doc = { ...createNewDocument(), content: '<p>old</p>', lastModified: 100 };
    localStorage.setItem('penko_writer_doc_' + doc.id, JSON.stringify(doc));
    writeEmergencyBackup([{ ...doc, content: '<p>new</p>', lastModified: 200 }]);
    const { docs } = await loadAllDocuments();
    expect(docs.find(d => d.id === doc.id)?.content).toBe('<p>new</p>');
    expect(readEmergencyBackup()).toHaveLength(0);
  });

  it('corrupt legacy data is kept, not overwritten', async () => {
    localStorage.setItem('penko_writer_docs', '{not json');
    const { docs, error } = await loadAllDocuments();
    expect(docs).toEqual([]);
    expect(error).toBeTruthy();
    expect(localStorage.getItem('penko_writer_docs_unreadable_backup')).toBe('{not json');
  });
});
