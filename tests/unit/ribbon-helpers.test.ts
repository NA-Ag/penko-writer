import { describe, it, expect } from 'vitest';
import { lengthToMm, rulerGeometry, fontOptionsWith, sizeOptionsWith, lineSpacingFromStyle } from '../../utils/ribbonHelpers';

describe('ribbon helpers', () => {
  it('converts CSS lengths to millimetres', () => {
    expect(lengthToMm('210mm')).toBe(210);
    expect(lengthToMm('2.54cm')).toBeCloseTo(25.4);
    expect(lengthToMm('1in')).toBeCloseTo(25.4);
    expect(lengthToMm('96px')).toBeCloseTo(25.4);
    expect(lengthToMm('0mm')).toBe(0);
  });

  it('computes ruler geometry from page size, orientation and margins', () => {
    const a4 = rulerGeometry({ size: 'A4', orientation: 'portrait', margins: 'normal' });
    expect(a4.widthMm).toBe(210);
    expect(a4.marginMm).toBeCloseTo(25.4);
    expect(a4.ticks).toBe(Math.ceil((210 - 50.8) / 10));
    const land = rulerGeometry({ size: 'Letter', orientation: 'landscape', margins: 'wide' });
    expect(land.widthMm).toBe(279);
    expect(land.marginMm).toBeCloseTo(50.8);
    expect(rulerGeometry(undefined).widthMm).toBe(210);
    expect(rulerGeometry({ margins: 'none' } as any).marginMm).toBe(0);
  });

  it('keeps the current font visible even when it is not in the list', () => {
    expect(fontOptionsWith(['Arial', 'Inter'], 'Calibri')).toEqual({ options: ['Calibri', 'Arial', 'Inter'], value: 'Calibri' });
    expect(fontOptionsWith(['Arial', 'Inter'], 'arial')).toEqual({ options: ['Arial', 'Inter'], value: 'Arial' });
  });

  it('inserts unusual font sizes in order', () => {
    expect(sizeOptionsWith(['10', '11', '12'], '10.5')).toEqual(['10', '10.5', '11', '12']);
    expect(sizeOptionsWith(['10', '11'], '11')).toEqual(['10', '11']);
  });

  it('maps a block line-height style onto the select options', () => {
    expect(lineSpacingFromStyle('line-height: 2')).toBe('2.0');
    expect(lineSpacingFromStyle('color: red; line-height: 1.15')).toBe('1.15');
    expect(lineSpacingFromStyle('line-height: 1.8')).toBe('1.8');
    expect(lineSpacingFromStyle('color: red')).toBeNull();
    expect(lineSpacingFromStyle(null)).toBeNull();
  });
});
