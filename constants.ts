import React from 'react';

export const FONTS = [
  'Inter', 'Roboto', 'Playfair Display', 'Merriweather', 'Source Code Pro', 'Arial', 'Times New Roman', 'Courier New'
];

export const FONT_SIZES = [
  '8', '9', '10', '11', '12', '14', '16', '18', '20', '24', '28', '32', '36', '48', '60', '72', '96'
];

export const COLORS = [
  '#000000', '#444444', '#666666', '#999999', '#CCCCCC', '#EEEEEE', '#F3F3F3', '#FFFFFF',
  '#FF0000', '#FF9900', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#9900FF', '#FF00FF',
  '#F4CCCC', '#FCE5CD', '#FFF2CC', '#D9EAD3', '#D0E0E3', '#CFE2F3', '#D9D2E9', '#EAD1DC'
];

export const PAGE_SIZES = {
  A4: { width: '210mm', height: '297mm' },
  Letter: { width: '216mm', height: '279mm' }
};

export const PAGE_MARGINS = {
  normal: '2.54cm', // 1 inch
  narrow: '1.27cm', // 0.5 inch
  wide: '5.08cm',   // 2 inch
  none: '0mm'       // Full bleed
};

export const LANGUAGES = [
  { code: 'en-US', name: 'English (US)' },
  { code: 'en-GB', name: 'English (UK)' },
  { code: 'es', name: 'Spanish' },
  { code: 'fr', name: 'French' },
  { code: 'de', name: 'German' },
  { code: 'it', name: 'Italian' },
  { code: 'pt', name: 'Portuguese' },
  { code: 'ru', name: 'Russian' },
  { code: 'zh', name: 'Chinese' },
  { code: 'ja', name: 'Japanese' },
  { code: 'ko', name: 'Korean' },
];