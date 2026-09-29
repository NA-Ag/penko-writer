import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { UI_STRINGS, t, loadLanguage, type LanguageCode } from '../../utils/translations';

const ALL: LanguageCode[] = ['es', 'fr', 'de', 'zh', 'ja', 'uk', 'pt', 'it', 'ru', 'ko', 'ar', 'hi'];
await Promise.all(ALL.map(loadLanguage));
import { EXTRA_EN } from '../../utils/i18n';

const ROOT = path.resolve(__dirname, '../..');
const en = UI_STRINGS['en-US']!;
const languages = ALL;
const placeholders = (s: string) => (s.match(/\{[A-Za-z_]+\}/g) || []).sort();

const sourceFiles = (dir: string): string[] =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (['node_modules', 'dist', 'tests', 'public'].includes(entry.name) || entry.name.startsWith('.')) return [];
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [full] : [];
  });

describe('UI translations', () => {
  it('has a non-trivial English source table', () => {
    expect(Object.keys(en).length).toBeGreaterThan(500);
  });

  it.each(languages)('%s has every English key with a non-empty value', lang => {
    const table = UI_STRINGS[lang]!;
    const missing = Object.keys(en).filter(k => typeof table[k] !== 'string' || !table[k].trim());
    expect(missing).toEqual([]);
  });

  it.each(languages)('%s has no keys that English lacks', lang => {
    expect(Object.keys(UI_STRINGS[lang]!).filter(k => !(k in en))).toEqual([]);
  });

  it.each(languages)('%s keeps the {placeholders} of the English strings', lang => {
    const broken = Object.keys(en).filter(k => UI_STRINGS[lang]![k] && placeholders(UI_STRINGS[lang]![k]).join() !== placeholders(en[k]).join());
    expect(broken).toEqual([]);
  });

  it('has no English values left pending in the per-area fallback files', () => {
    // Keys may be added there temporarily, but never shadow translated ones.
    expect(Object.keys(EXTRA_EN).filter(k => k in en)).toEqual([]);
  });

  it('every literal key passed to t() exists in en-US', () => {
    const re = [/\bt\([^,()]+,\s*'([^'\n]+)'\)/g, /\bt\([^,()]+,\s*"([^"\n]+)"\)/g];
    const unknown: string[] = [];
    for (const file of sourceFiles(ROOT)) {
      const src = fs.readFileSync(file, 'utf8');
      for (const r of re) {
        for (const m of src.matchAll(r)) {
          if (!(m[1] in en) && !(m[1] in EXTRA_EN)) unknown.push(`${path.relative(ROOT, file)}: ${m[1]}`);
        }
      }
    }
    expect(unknown).toEqual([]);
  });

  it('t() falls back to English, then to the key', () => {
    expect(t('es', 'files')).toBe(UI_STRINGS.es!.files);
    expect(t('ar', '__missing_key__')).toBe('__missing_key__');
  });
});
