import { File, Paths, Directory } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

const CLOSET_DIR = 'closet';

function closetDir() {
  const dir = new Directory(Paths.document, CLOSET_DIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

/** Shrink and re-encode a camera photo before it goes over the wire. */
export async function prepareForUpload(uri, maxWidth = 1200) {
  const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
  ctx.resize({ width: maxWidth });
  const image = await ctx.renderAsync();
  const result = await image.saveAsync({
    compress: 0.82,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  return { uri: result.uri, base64: result.base64 };
}

/** Persist a cut-out PNG into the app's document directory. */
export async function saveCutout(pngBase64, id) {
  const file = new File(closetDir(), `${id}.png`);
  if (file.exists) file.delete();
  file.create();
  await file.write(pngBase64, { encoding: 'base64' });
  return file.uri;
}

/** Download a retailer's product image into local storage. */
export async function saveRemoteImage(url, id) {
  const dest = new File(closetDir(), `${id}.jpg`);
  if (dest.exists) dest.delete();
  const file = await File.downloadFileAsync(url, dest);
  return file.uri;
}

/** Read a local file back as base64 (for re-tagging an existing photo). */
export async function readAsBase64(uri) {
  const file = new File(uri);
  return file.base64();
}

export async function deleteImage(uri) {
  if (!uri) return;
  try {
    const file = new File(uri);
    if (file.exists) file.delete();
  } catch {
    /* already gone */
  }
}
