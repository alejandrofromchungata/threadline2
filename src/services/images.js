import { File, Paths, Directory } from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { cutout } from '../api';

// Background removal runs on the phone when it can — iOS 17's Vision framework
// segments the garment locally, which is free, offline and much quicker than a
// round trip. The paid service stays as a fallback for older iOS, the
// simulator, and any image Vision can't find a subject in.
//
// Loaded lazily and defensively: until the next native build includes this
// module, touching it throws, and every cut-out must still work via the server.
let nativeRemover;
function getNativeRemover() {
  if (nativeRemover === undefined) {
    try {
      nativeRemover = require('@six33/react-native-bg-removal');
    } catch {
      nativeRemover = null;
    }
  }
  return nativeRemover;
}

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

/** Move a file the native remover wrote in the temp dir into the closet. */
async function adoptIntoCloset(tempUri, id) {
  const dest = new File(closetDir(), `${id}.png`);
  if (dest.exists) dest.delete();
  new File(tempUri).copy(dest);
  return dest.uri;
}

/**
 * Strip the background from a local image and store it in the closet, trying
 * the phone first and falling back to the paid service.
 *
 * `base64` is the already-encoded copy the caller made for tagging, passed in
 * so the fallback doesn't have to re-encode the same photo a second time.
 */
export async function removeBackgroundToCloset(uri, id, base64) {
  const native = getNativeRemover();
  if (native?.removeBackground) {
    try {
      if (await native.isNativeBackgroundRemovalSupported()) {
        const cutUri = await native.removeBackground(uri, { trim: true });
        return await adoptIntoCloset(cutUri, id);
      }
    } catch {
      // Simulator, iOS < 17, or no subject found — fall through to the service.
    }
  }
  const encoded = base64 ?? (await prepareForUpload(uri)).base64;
  const { pngBase64 } = await cutout(encoded);
  return saveCutout(pngBase64, id);
}

/**
 * Download a retailer's product image and strip its background, so an imported
 * garment sits on the card tint the same way a photographed one does instead of
 * carrying the retailer's white studio backdrop into the closet.
 *
 * Falls back to the untouched download if the cut-out service is unreachable or
 * out of credit — an import should never fail just because the background could
 * not be removed.
 */
export async function saveRemoteCutout(url, id) {
  const original = await saveRemoteImage(url, id);
  try {
    const cut = await removeBackgroundToCloset(original, id);
    if (cut !== original) await deleteImage(original);
    return cut;
  } catch {
    return original;
  }
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
