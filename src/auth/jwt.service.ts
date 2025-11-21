import jwt from 'jsonwebtoken';
import { TokenPayload, UserRole } from '../models/user.model';
import winston from 'winston';

export class JWTService {
  private secret: string;
  private accessTokenExpiry: string;
  private refreshTokenExpiry: string;
  private logger: winston.Logger;

  constructor(
    secret?: string,
    accessTokenExpiry: string = '1h',
    refreshTokenExpiry: string = '7d'
  ) {
    this.secret = secret || process.env.JWT_SECRET || this.generateSecret();
    if (!this.secret) {
      throw new Error('JWT secret must be provided');
    }
    this.accessTokenExpiry = accessTokenExpiry;
    this.refreshTokenExpiry = refreshTokenExpiry;

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'jwt-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });

    if (!process.env.JWT_SECRET) {
      this.logger.warn('JWT_SECRET not set in environment, using generated secret');
    }
  }

  private generateSecret(): string {
    return require('crypto').randomBytes(64).toString('hex');
  }

  /**
   * Generate access token
   */
  generateAccessToken(userId: string, email: string, roles: UserRole[]): string {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId,
      email,
      roles,
    };

    return jwt.sign(payload, this.secret as string, {
      expiresIn: this.accessTokenExpiry as any,
    });
  }

  /**
   * Generate refresh token
   */
  generateRefreshToken(userId: string, email: string, roles: UserRole[]): string {
    const payload: Omit<TokenPayload, 'iat' | 'exp'> = {
      userId,
      email,
      roles,
    };

    return jwt.sign(payload, this.secret as string, {
      expiresIn: this.refreshTokenExpiry as any,
    });
  }

  /**
   * Verify and decode token
   */
  verifyToken(token: string): TokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret) as TokenPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid token');
      }
      throw error;
    }
  }

  /**
   * Decode token without verification (for debugging)
   */
  decodeToken(token: string): TokenPayload | null {
    try {
      return jwt.decode(token) as TokenPayload;
    } catch (error) {
      this.logger.error('Failed to decode token', error);
      return null;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  refreshAccessToken(refreshToken: string): string {
    const payload = this.verifyToken(refreshToken);
    return this.generateAccessToken(payload.userId, payload.email, payload.roles);
  }

  /**
   * Check if token is expired
   */
  isTokenExpired(token: string): boolean {
    try {
      const decoded = this.decodeToken(token);
      if (!decoded || !decoded.exp) {
        return true;
      }
      return decoded.exp * 1000 < Date.now();
    } catch (error) {
      return true;
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.decodeToken(token);
    if (!decoded || !decoded.exp) {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }
}
