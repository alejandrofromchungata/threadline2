/**
 * Design tokens pulled directly from the Figma file
 * (yBrV9irkTBm2wbnKIeSm3L, via the Figma API — exact values, not estimated).
 * Three-font system: Playfair Display for display/serif headings, Geist for
 * interface text, IBM Plex Mono for data labels and eyebrow text.
 */
export const LIGHT = {
  paper: '#F7F3EB',
  card: '#FCFAF5',
  careStrip: '#FAF8F3',
  photoBg: '#E9E2D8',
  heroBg: '#E9E2D8',
  cardArt: '#E3DCCF',  // closet card art tint, chosen over Figma's paper fill
  ink: '#262322',
  muted: '#7E756F',
  indigo: '#2A3C63',
  seam: '#DFD9CE',
  seamDark: '#C9C0AF',
  sage: '#2E7D32',
  ochre: '#D84315',
  rust: '#B71C1C',
  info: '#1565C0',
};

/** Dark-mode frames from Figma (closet-main-dark, item-detail-dark, etc). Note
 * status colours (sage/ochre/info) stay identical to light mode by design —
 * only rust is brightened for dark-background legibility. */
export const DARK = {
  paper: '#1A1816',
  card: '#2A2725',
  careStrip: '#35312E',
  photoBg: '#35312E',
  heroBg: '#2A2725',
  cardArt: '#35312E',
  ink: '#F0EDE6',
  muted: '#9B938A',
  indigo: '#4A6496',
  seam: '#3D3835',
  seamDark: '#4C4536',
  sage: '#2E7D32',
  ochre: '#D84315',
  rust: '#E53935',
  info: '#1565C0',
};

export const FONTS = {
  display: 'PlayfairDisplay_700Bold',
  displayRegular: 'PlayfairDisplay_400Regular',
  displayBlack: 'PlayfairDisplay_900Black',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemi: 'Geist_600SemiBold',
  sansBold: 'Geist_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoSemi: 'IBMPlexMono_600SemiBold',
};

/** Closet sort orders, shared by the closet header and the settings default. */
export const SORTS = [
  ['recent', 'Added'],
  ['worn', 'Most worn'],
  ['cpw', 'Cost per wear'],
  ['name', 'A–Z'],
];

export const CATEGORIES = [
  'headwear', 'tops', 'innerwear', 'outerwear',
  'pants', 'dresses', 'shoes', 'accessories',
];

export const STYLES = [
  'minimalist', 'classic tailoring', 'business casual', 'preppy', 'old money',
  'streetwear', 'skater', 'techwear', 'gorpcore', 'athleisure', 'sporty chic',
  'y2k', 'indie sleaze', 'grunge', 'punk', 'goth', 'whimsigoth',
  'boho', 'cottagecore', 'coastal', 'western', 'romantic', 'coquette', 'balletcore',
  'dark academia', 'light academia', 'mod', '70s vintage', '90s minimal',
  'normcore', 'clean girl', 'scandi', 'utilitarian', 'workwear',
  'maximalist', 'avant-garde', 'monochrome', 'colour blocking',
  'resort', 'festival', 'kawaii', 'androgynous', 'glam',
];

export const CONTEXTS = [
  'corporate office', 'business casual office', 'creative studio', 'remote work',
  'client meetings', 'sales & client-facing', 'conferences', 'teaching',
  'high school', 'college classes', 'grad school',
  'healthcare shifts', 'lab work', 'restaurant or bar shifts', 'retail floor',
  'trades & construction', 'outdoor work', 'warehouse',
  'gym', 'running & training', 'yoga or pilates', 'hiking & outdoors',
  'nights out', 'dates', 'weddings & events', 'concerts & gigs',
  'church or temple', 'court & formal appointments',
  'parenting & school run', 'errands', 'dog walking', 'commuting by bike',
  'travel days', 'weekends at home',
];

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

/** Status labels + dot colour, resolved against whichever palette is active. */
export const getStatus = (T) => ({
  clean: { label: 'Clean', dot: T.sage },
  dirty: { label: 'Worn', dot: T.ochre },
  laundry: { label: 'Laundry', dot: T.rust },
  storage: { label: 'Storage', dot: T.seamDark },
});

export const FORMALITY = ['gym', 'casual', 'smart casual', 'business', 'formal'];

/** Formality as filled/hollow dots, matching the "••••◦" pattern in the design. */
export const formalityDots = (level) => '●'.repeat(level) + '○'.repeat(5 - level);
