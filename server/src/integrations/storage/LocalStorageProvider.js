import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { StorageProvider } from './StorageProvider.js';

/**
 * Development driver: writes to a directory outside the repo tree and serves
 * files through a signed, expiring API route. Same interface as S3 so nothing
 * upstream changes when the driver is swapped.
 */
export class LocalStorageProvider extends StorageProvider {
  constructor({ directory, signingSecret, publicBaseUrl }) {
    super();
    this.directory = path.resolve(directory);
    this.signingSecret = signingSecret;
    this.publicBaseUrl = publicBaseUrl;
  }

  get name() {
    return 'local';
  }

  async #ensureDir(key) {
    await fs.mkdir(path.dirname(path.join(this.directory, key)), { recursive: true });
  }

  #resolve(key) {
    const resolved = path.resolve(this.directory, key);
    if (!resolved.startsWith(this.directory)) throw new Error('Invalid storage key');
    return resolved;
  }

  async put(key, buffer) {
    await this.#ensureDir(key);
    await fs.writeFile(this.#resolve(key), buffer);
    return { key, size: buffer.length };
  }

  async get(key) {
    return fs.readFile(this.#resolve(key));
  }

  async remove(key) {
    await fs.rm(this.#resolve(key), { force: true });
  }

  async signedUrl(key, expiresInSeconds = 900) {
    const expires = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const signature = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`)
      .digest('hex');
    const query = new URLSearchParams({ key, expires: String(expires), signature });
    return `${this.publicBaseUrl}/api/files?${query.toString()}`;
  }

  verifySignature(key, expires, signature) {
    if (Number(expires) < Math.floor(Date.now() / 1000)) return false;
    const expected = crypto
      .createHmac('sha256', this.signingSecret)
      .update(`${key}:${expires}`)
      .digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(String(signature)));
  }
}

export default LocalStorageProvider;
