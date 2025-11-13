import crypto from 'crypto';
import { APIKey } from '../models/user.model';
import winston from 'winston';

export class APIKeyService {
  private logger: winston.Logger;
  private salt: string;

  constructor(salt?: string) {
    this.salt = salt || process.env.API_KEY_SALT || this.generateSalt();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'api-key-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });

    if (!process.env.API_KEY_SALT) {
      this.logger.warn('API_KEY_SALT not set in environment, using generated salt');
    }
  }

  private generateSalt(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate a new API key
   */
  generateAPIKey(prefix: string = 'sk'): string {
    const randomBytes = crypto.randomBytes(32);
    const key = `${prefix}_${randomBytes.toString('base64url')}`;
    return key;
  }

  /**
   * Hash an API key for storage
   */
  hashAPIKey(key: string): string {
    return crypto
      .createHmac('sha256', this.salt)
      .update(key)
      .digest('hex');
  }

  /**
   * Validate an API key against its hash
   */
  validateAPIKey(key: string, hash: string): boolean {
    const keyHash = this.hashAPIKey(key);
    return crypto.timingSafeEqual(
      Buffer.from(keyHash),
      Buffer.from(hash)
    );
  }

  /**
   * Check if API key is expired
   */
  isAPIKeyExpired(apiKey: APIKey): boolean {
    if (!apiKey.expiresAt) {
      return false;
    }
    return apiKey.expiresAt < new Date();
  }

  /**
   * Check if API key is valid and active
   */
  isAPIKeyValid(apiKey: APIKey): boolean {
    return apiKey.isActive && !this.isAPIKeyExpired(apiKey);
  }

  /**
   * Generate API key with metadata
   */
  createAPIKeyObject(
    userId: string,
    name: string,
    permissions: string[],
    expiresAt?: Date
  ): { key: string; apiKeyObject: APIKey } {
    const key = this.generateAPIKey();
    const apiKeyObject: APIKey = {
      id: crypto.randomUUID(),
      key: this.hashAPIKey(key),
      name,
      userId,
      permissions,
      createdAt: new Date(),
      expiresAt,
      isActive: true,
    };

    return { key, apiKeyObject };
  }

  /**
   * Mask API key for display
   */
  maskAPIKey(key: string): string {
    if (key.length < 12) {
      return '***';
    }
    const prefix = key.substring(0, 7);
    const suffix = key.substring(key.length - 4);
    return `${prefix}...${suffix}`;
  }

  /**
   * Extract prefix from API key
   */
  getAPIKeyPrefix(key: string): string {
    const parts = key.split('_');
    return parts[0] || '';
  }

  /**
   * Validate API key format
   */
  isValidAPIKeyFormat(key: string): boolean {
    return /^[a-z]{2}_[A-Za-z0-9_-]{32,}$/.test(key);
  }
}
