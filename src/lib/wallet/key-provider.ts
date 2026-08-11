export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
  keyVersion: number;
}

export interface KeyEncryptionProvider {
  encrypt(plaintext: string): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload): Promise<string>;
}
