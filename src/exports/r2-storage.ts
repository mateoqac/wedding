import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { SIGNED_URL_TTL_SECONDS, type FileStorage } from "./storage";

/** Cloudflare R2 through its S3-compatible API (design §2). */
export function createR2Storage({
  accountId,
  accessKeyId,
  secretAccessKey,
  bucket,
}: {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}): FileStorage {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  return {
    async put(key, body, contentType) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
    },
    async signedUrl(key) {
      return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
        expiresIn: SIGNED_URL_TTL_SECONDS,
      });
    },
  };
}
