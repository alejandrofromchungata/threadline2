import { File, Paths, Directory } from 'expo-file-system';

const COLUMNS = [
  'name', 'brand', 'category', 'colorName', 'material',
  'seasons', 'formality', 'tags', 'price', 'wears', 'lastWorn', 'status', 'sourceUrl',
];

/** Quote a value for CSV: double any quotes, wrap if it contains a delimiter. */
const cell = (value) => {
  const s = Array.isArray(value) ? value.join('; ') : value == null ? '' : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * Write the closet out as a CSV in the app's cache and return its file URI,
 * ready to hand to the share sheet. Cache rather than documents: this is a
 * throwaway export, not part of the wardrobe.
 */
export async function exportWardrobeCsv(items) {
  const rows = [
    COLUMNS.join(','),
    ...items.map((item) => COLUMNS.map((c) => cell(item[c])).join(',')),
  ];

  const dir = new Directory(Paths.cache, 'exports');
  if (!dir.exists) dir.create({ intermediates: true });

  const stamp = new Date().toISOString().slice(0, 10);
  const file = new File(dir, `threadline-wardrobe-${stamp}.csv`);
  if (file.exists) file.delete();
  file.create();
  await file.write(rows.join('\n'));
  return file.uri;
}
