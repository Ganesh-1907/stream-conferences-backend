import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';

const R2_ENDPOINT = process.env.R2_ENDPOINT;
const R2_ACCESS_KEY = process.env.R2_ACCESS_KEY;
const R2_SECRET_KEY = process.env.R2_SECRET_KEY;
const R2_BUCKET = process.env.R2_BUCKET;

export const r2Enabled = Boolean(R2_ENDPOINT && R2_ACCESS_KEY && R2_SECRET_KEY && R2_BUCKET);

export const r2Client = r2Enabled
  ? new S3Client({
      endpoint: R2_ENDPOINT,
      region: 'auto',
      credentials: {
        accessKeyId: R2_ACCESS_KEY,
        secretAccessKey: R2_SECRET_KEY
      },
      requestHandler: { requestTimeout: 30000 }
    })
  : null;

export function r2Status() {
  return { enabled: r2Enabled, bucket: R2_BUCKET || null, endpoint: R2_ENDPOINT || null };
}

/**
 * Upload a buffer to Cloudflare R2.
 * @param {string} key - object key (e.g. "1787...-logo.png")
 * @param {Buffer} buffer
 * @param {string} contentType
 */
export async function uploadToR2(key, buffer, contentType) {
  if (!r2Client) throw new Error('R2 not configured');
  await r2Client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream'
    })
  );
  return key;
}

/**
 * Fetch an object from R2 (returns { Body, ContentType, ContentLength }).
 */
export async function getFromR2(key) {
  if (!r2Client) throw new Error('R2 not configured');
  const res = await r2Client.send(new GetObjectCommand({ Bucket: R2_BUCKET, Key: key }));
  return res;
}
