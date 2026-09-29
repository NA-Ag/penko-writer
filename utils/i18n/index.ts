import { strings as core } from './core';
import { strings as io } from './io';
import { strings as collab } from './collab';
import { strings as platform } from './platform';
import { strings as mobile } from './mobile';
import { strings as ribbon } from './ribbon';
import { strings as review } from './review';

/** English fallbacks for keys not yet present in translations.ts (per-area files are empty after each i18n merge). */
export const EXTRA_EN: Record<string, string> = { ...core, ...io, ...collab, ...platform, ...mobile, ...ribbon, ...review };
