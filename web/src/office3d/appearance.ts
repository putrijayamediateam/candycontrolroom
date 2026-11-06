/**
 * Reads a staff member's editable avatar brief (skin tone, hair or hijab, outfit) into
 * simple low-poly parameters. Pure, so new or edited briefs can be tested.
 * Respectful by design: natural proportions, no exaggerated features.
 */
export interface Appearance {
  skin: string;
  hairStyle: 'short' | 'buzz' | 'long' | 'bob' | 'ponytail' | 'braid' | 'locs' | 'curly' | 'hijab' | 'pixie' | 'undercut';
  hairColour: string;
  hijabColour: string | null;
  outfit: string;
  accent: string;
  glasses: boolean;
  beard: boolean;
  /** Slight height variety so people are not clones. */
  height: number;
}

const SKIN: [RegExp, string][] = [
  [/medium-deep/, '#8d5a3b'], [/medium-tan/, '#b07a52'], [/light-medium/, '#d9a982'],
  [/deep/, '#6b4128'], [/medium/, '#c08a62'], [/light/, '#efc9a8'],
];

const COLOURS: [RegExp, string][] = [
  [/dusty rose/, '#c98a96'], [/soft pink|pink/, '#f2a7c3'], [/navy/, '#24345e'], [/light blue/, '#9cc3e6'],
  [/charcoal/, '#3a3a3f'], [/black/, '#222226'], [/white/, '#f1f1ee'], [/cream/, '#eee3c8'], [/grey|gray/, '#8d9096'],
  [/green/, '#4f8a5b'], [/olive/, '#6f7a3a'], [/teal/, '#2b8f88'], [/lilac/, '#b9a2d6'], [/mustard/, '#c9a12c'],
  [/denim/, '#4a6a93'], [/orange/, '#d9792e'], [/checked/, '#a2543f'], [/blue/, '#3f77c9'],
  [/paint/, '#9a8f7c'],
];

function colourFrom(text: string): string | null {
  // The colour named first wins ("white blazer, pink accent" is a white outfit).
  const t = text.toLowerCase();
  let best: { at: number; hex: string } | null = null;
  for (const [re, hex] of COLOURS) {
    const at = t.search(re);
    if (at >= 0 && (!best || at < best.at)) best = { at, hex };
  }
  return best?.hex ?? null;
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function appearanceFor(id: string, colour: string, avatar: Record<string, unknown> | null | undefined): Appearance {
  const a = avatar ?? {};
  const skinTone = String(a.skinTone ?? a.skin_tone ?? 'medium').toLowerCase();
  const hair = String(a.hair ?? '').toLowerCase();
  const outfit = String(a.outfit ?? '');
  const skin = SKIN.find(([re]) => re.test(skinTone))?.[1] ?? '#c08a62';
  const isHijab = /hijab|tudung/.test(hair);
  const hairStyle: Appearance['hairStyle'] = isHijab ? 'hijab'
    : /locs/.test(hair) ? 'locs'
    : /braid/.test(hair) ? 'braid'
    : /ponytail|tied/.test(hair) ? 'ponytail'
    : /bob/.test(hair) ? 'bob'
    : /pixie/.test(hair) ? 'pixie'
    : /undercut/.test(hair) ? 'undercut'
    : /buzz/.test(hair) ? 'buzz'
    : /curly|wavy/.test(hair) ? 'curly'
    : /long|shoulder/.test(hair) ? 'long'
    : 'short';
  return {
    skin,
    hairStyle,
    hairColour: /grey hair|silver/.test(hair) ? '#9a9a9a' : '#1f1a17',
    hijabColour: isHijab ? colourFrom(hair) ?? '#7a6a8a' : null,
    outfit: colourFrom(outfit) ?? colour,
    accent: colour,
    glasses: /glasses/.test(hair) || /glasses/.test(String(a.note ?? '').toLowerCase()),
    beard: /beard/.test(hair),
    height: 0.96 + (hash(id) % 9) / 100,
  };
}
