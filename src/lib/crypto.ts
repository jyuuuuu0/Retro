import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * GitHub 토큰 암호화 (AES-256-GCM).
 * 저장 형식: "v1:" + base64(iv[12] | authTag[16] | ciphertext)
 * 사용자 id를 AAD로 묶어서, 암호문을 다른 사용자 행에 옮겨 붙여도 복호화되지 않게 한다.
 */
const PREFIX = "v1:";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("TOKEN_ENCRYPTION_KEY 환경변수가 설정되지 않았어요");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY는 base64로 인코딩한 32바이트여야 해요");
  return key;
}

export function encryptToken(plain: string, userId: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  cipher.setAAD(Buffer.from(userId, "utf8"));
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), ct]).toString("base64");
}

export type Decrypted = { token: string; legacy: boolean } | null;

/** 복호화. 예전에 평문으로 저장된 값은 legacy: true 로 그대로 돌려준다. 실패하면 null. */
export function decryptToken(stored: string, userId: string): Decrypted {
  if (!stored.startsWith(PREFIX)) return { token: stored, legacy: true };
  try {
    const buf = Buffer.from(stored.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAAD(Buffer.from(userId, "utf8"));
    decipher.setAuthTag(tag);
    const token = Buffer.concat([decipher.update(ct), decipher.final()]).toString("utf8");
    return { token, legacy: false };
  } catch {
    return null; // 키가 바뀌었거나 값이 손상됨 → 다시 로그인
  }
}
