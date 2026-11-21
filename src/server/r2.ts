import { randomUUID } from "node:crypto";
import { AwsClient } from "aws4fetch";

// Uploaded inspiration photos live in a Cloudflare R2 bucket (S3-compatible), served from R2_PUBLIC_URL.
const env = () => ({
  bucket: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`,
  publicUrl: process.env.R2_PUBLIC_URL ?? "",
  client: new AwsClient({
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? "",
    service: "s3",
    region: "auto",
  }),
});

// Saves a JPEG and returns its public URL.
export async function uploadImage(jpeg: Uint8Array<ArrayBuffer>) {
  const { bucket, publicUrl, client } = env();
  const key = `references/${randomUUID()}.jpg`;
  // sign, then send with plain fetch: aws4fetch's own fetch streams the body, and R2 requires a Content-Length
  const signed = await client.sign(`${bucket}/${key}`, { method: "PUT", body: jpeg, headers: { "content-type": "image/jpeg" } });
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: jpeg });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
  return `${publicUrl}/${key}`;
}

// Deletes an uploaded photo by its public URL (anything else, like a pasted link's image, is left alone).
export async function deleteImage(imageUrl: string) {
  const { bucket, publicUrl, client } = env();
  if (!publicUrl || !imageUrl.startsWith(`${publicUrl}/`)) return;
  await client.fetch(`${bucket}/${imageUrl.slice(publicUrl.length + 1)}`, { method: "DELETE" }).catch(() => {});
}
