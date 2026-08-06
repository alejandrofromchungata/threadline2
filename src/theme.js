export const T = {
  paper: '#EFEDE6',
  card: '#FBFAF6',
  ink: '#1A1C20',
  muted: '#6C6A63',
  indigo: '#2B3A7E',
  sage: '#7C9A78',
  ochre: '#C9903A',
  rust: '#A6462F',
  seam: '#CFCABB',
  seamDark: '#A5A196',
};

export const CATEGORIES = [
  'headwear', 'tops', 'innerwear', 'outerwear',
  'pants', 'dresses', 'shoes', 'accessories',
];

export const STYLES = [
  'minimalist', 'streetwear', 'business casual', 'boho', 'y2k',
  'preppy', 'athleisure', 'classic tailoring', 'grunge', 'cottagecore',
];

export const CONTEXTS = [
  'office', 'school', 'gym', 'remote work', 'service job', 'creative studio', 'nights out',
];

export const SEASONS = ['spring', 'summer', 'fall', 'winter'];

export const STATUS = {
  clean: { label: 'Clean', dot: T.sage },
  dirty: { label: 'Worn', dot: T.ochre },
  laundry: { label: 'In laundry', dot: T.rust },
  storage: { label: 'Stored', dot: T.seamDark },
};

export const FORMALITY = ['gym', 'casual', 'smart casual', 'business', 'formal'];
