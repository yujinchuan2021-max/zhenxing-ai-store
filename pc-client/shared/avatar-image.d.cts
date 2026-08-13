export const MAX_AVATAR_BYTES: number;
export function parseAvatarDataUrl(value: unknown): {
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  data: Buffer;
} | null;
