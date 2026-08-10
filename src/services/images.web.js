function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function canvasToJpeg(img, maxWidth) {
  const scale = Math.min(1, maxWidth / img.width);
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { uri: dataUrl, base64: dataUrl.split(',')[1] };
}

/** Shrink and re-encode a photo before it goes over the wire. */
export async function prepareForUpload(uri, maxWidth = 1200) {
  const img = await loadImage(uri);
  return canvasToJpeg(img, maxWidth);
}

/** Persist a cut-out PNG as a data URL so it survives SQLite reloads. */
export async function saveCutout(pngBase64, id) {
  return `data:image/png;base64,${pngBase64}`;
}

/** Download a retailer's product image; returns a data URL when CORS allows. */
export async function saveRemoteImage(url, id) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download image (${res.status})`);
  const blob = await res.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
  return dataUrl;
}

/** Read a local file back as base64 (for re-tagging an existing photo). */
export async function readAsBase64(uri) {
  if (uri.startsWith('data:')) return uri.split(',')[1];
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function deleteImage(uri) {
  /* data URLs and blob URLs need no filesystem cleanup */
}
