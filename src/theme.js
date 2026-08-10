/**
 * Design tokens pulled directly from the Figma file
 * (yBrV9irkTBm2wbnKIeSm3L). Three-font system: Cormorant Garamond for
 * display/serif headings, Geist for interface text, IBM Plex Mono for
 * data labels and eyebrow text.
 */
export const T = {
  paper: '#F7F3EB',
  card: '#FCFAF5',
  careStrip: '#FAF8F3',
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

export const FONTS = {
  display: 'CormorantGaramond_700Bold',
  displayRegular: 'CormorantGaramond_400Regular',
  sans: 'Geist_400Regular',
  sansMedium: 'Geist_500Medium',
  sansSemi: 'Geist_600SemiBold',
  sansBold: 'Geist_700Bold',
  mono: 'IBMPlexMono_400Regular',
  monoSemi: 'IBMPlexMono_600SemiBold',
};

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

export const STATUS = {
  clean: { label: 'Clean', dot: T.sage },
  dirty: { label: 'Worn', dot: T.ochre },
  laundry: { label: 'In laundry', dot: T.rust },
  storage: { label: 'Stored', dot: T.seamDark },
};

export const FORMALITY = ['gym', 'casual', 'smart casual', 'business', 'formal'];

/** Formality as filled/hollow dots, matching the "••••◦" pattern in the design. */
export const formalityDots = (level) => '●'.repeat(level) + '○'.repeat(5 - level);
