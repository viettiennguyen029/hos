import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import type { EncryptedPayload, KeyEncryptionProvider } from "@/lib/wallet/key-provider";

const ALGORITHM = "aes-256-gcm";
const KEY_VERSION = 1;

/**
 * AES-256-GCM encryption using a single master key. Interim
 * implementation pending a Cloud KMS-backed provider implementing the
 * same KeyEncryptionProvider interface -- see .claude/rules/env-secrets.md.
 */
export class AppLevelKeyProvider implements KeyEncryptionProvider {
  constructor(private readonly masterKey: Buffer) {
    if (masterKey.length !== 32) {
      throw new Error(`WALLET_MASTER_KEY must decode to 32 bytes, got ${masterKey.length}`);
    }
  }

  async encrypt(plaintext: string): Promise<EncryptedPayload> {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      keyVersion: KEY_VERSION,
    };
  }

  async decrypt(payload: EncryptedPayload): Promise<string> {
    const decipher = createDecipheriv(ALGORITHM, this.masterKey, Buffer.from(payload.iv, "base64"));
    decipher.setAuthTag(Buffer.from(payload.authTag, "base64"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, "base64")),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  }
}

let singleton: AppLevelKeyProvider | undefined;

/** Production entry point -- reads WALLET_MASTER_KEY (base64, 32 bytes) from the environment. */
export function getKeyProvider(): AppLevelKeyProvider {
  if (!singleton) {
    const raw = process.env.WALLET_MASTER_KEY;
    if (!raw) throw new Error("WALLET_MASTER_KEY is not set");
    singleton = new AppLevelKeyProvider(Buffer.from(raw, "base64"));
  }
  return singleton;
}
