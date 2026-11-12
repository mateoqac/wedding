/** Port for generated files (Cloudflare R2 in production, local disk in dev and tests). */
export interface FileStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  /** Short-lived download URL (D6: 5 minutes). */
  signedUrl(key: string): Promise<string>;
}

export const SIGNED_URL_TTL_SECONDS = 5 * 60;

export function exportKey(invitationId: string, format: string, contentHash: string, extension: string) {
  return `exports/${invitationId}/${format}-${contentHash}.${extension}`;
}
