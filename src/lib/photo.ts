// Shrinks a chosen photo to at most 1024px on its longest side and re-encodes it as JPEG (base64, no prefix).
// Accepts anything the browser can open (JPG, PNG, WebP, GIF, AVIF; HEIC on Safari) and keeps uploads small
// (~100-300KB) whatever the camera produced; the model only needs 224px.
export async function toJpegBase64(file: File, maxSide = 1024): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNG/WebP areas would otherwise turn black in a JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}
