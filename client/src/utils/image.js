// Reduce las fotos antes de subirlas: las del móvil suelen pesar 3-12 MB y tardan
// mucho o superan el límite. Se dejan en 1600 px como máximo (de sobra para la tienda).
export async function shrinkImage(file, { max = 1600, quality = 0.85 } = {}) {
  if (!file || !file.type.startsWith('image/') || /gif|svg/.test(file.type)) return file;
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return file; // formato que el navegador no sabe abrir (p. ej. HEIC en Chrome): se sube tal cual
  }
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size < 1.5 * 1024 * 1024) {
    bitmap.close?.();
    return file;
  }
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, quality));
  // WebP conserva la transparencia; si el navegador no sabe crearlo, PNG (con transparencia) o JPEG
  let blob = await toBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob(file.type === 'image/png' ? 'image/png' : 'image/jpeg');
  if (!blob || blob.size >= file.size) return file;
  const ext = blob.type.split('/')[1].replace('jpeg', 'jpg');
  return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'foto'}.${ext}`, { type: blob.type });
}
