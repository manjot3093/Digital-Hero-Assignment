/**
 * Object storage contract for winner proof screenshots.
 *
 * Images never go into PostgreSQL — the database stores only the object key,
 * so swapping the local driver for S3/R2/Supabase Storage is a config change.
 */
export class StorageProvider {
  get name() {
    throw new Error('name must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async put(_key, _buffer, _options) {
    throw new Error('put must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async get(_key) {
    throw new Error('get must be implemented');
  }

  // eslint-disable-next-line no-unused-vars
  async remove(_key) {
    throw new Error('remove must be implemented');
  }

  /** Time-limited URL an admin can open to review a proof. */
  // eslint-disable-next-line no-unused-vars
  async signedUrl(_key, _expiresInSeconds) {
    throw new Error('signedUrl must be implemented');
  }
}

export const ALLOWED_PROOF_TYPES = Object.freeze([
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
]);

export default StorageProvider;
