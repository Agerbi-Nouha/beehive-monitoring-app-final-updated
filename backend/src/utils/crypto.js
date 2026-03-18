import crypto from 'crypto';

export function generateApiKey() {
  return crypto.randomBytes(32).toString('base64url');
}

export function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}
