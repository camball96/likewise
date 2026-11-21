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

// Saves a JPEG and returns its public URL. Each user's uploads share a folder (uploads/<user id>/), so
// everything one person uploaded can be found and deleted together.
export async function uploadImage(jpeg: Uint8Array<ArrayBuffer>, userId: string) {
  const { bucket, publicUrl, client } = env();
  const key = `uploads/${userId}/${randomUUID()}.jpg`;
  // sign, then send with plain fetch: aws4fetch's own fetch streams the body, and R2 requires a Content-Length
  const signed = await client.sign(`${bucket}/${key}`, { method: "PUT", body: jpeg, headers: { "content-type": "image/jpeg" } });
  const res = await fetch(signed.url, { method: "PUT", headers: signed.headers, body: jpeg });
  if (!res.ok) throw new Error(`R2 upload failed: ${res.status} ${await res.text()}`);
  return `${publicUrl}/${key}`;
}
