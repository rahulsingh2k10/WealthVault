import { scryptSync, randomBytes, createCipheriv, createDecipheriv } from "crypto";

export function deriveKey(passphrase: string): string {
  const salt = Buffer.from(process.env.ENCRYPTION_SALT!, "hex");
  return scryptSync(passphrase, salt, 32).toString("hex");
}

export function encrypt(plaintext: string, keyHex: string): string {
  const key = Buffer.from(keyHex, "hex");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decrypt(encryptedStr: string, keyHex: string): string {
  const [ivHex, authTagHex, ciphertextHex] = encryptedStr.split(":");
  const key = Buffer.from(keyHex, "hex");
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
