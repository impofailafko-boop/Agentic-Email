import { Request, Response, NextFunction } from 'express';
import { JWTService } from '../../auth/jwt.service';
import { APIKeyService } from '../../auth/api-key.service';
import { RBACService } from '../../auth/rbac.service';
import { UserRole, TokenPayload } from '../../models/user.model';
import { DatabaseService } from '../../services/database.service';
import winston from 'winston';

/**
 * Extended Express Request with user information
 */
export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
  apiKey?: {
    id: string;
    userId: string;
    permissions: string[];
  };
}

/**
 * Authentication middleware
 */
export class AuthMiddleware {
  private jwtService: JWTService;
  private apiKeyService: APIKeyService;
  private rbacService: RBACService;
  private database: DatabaseService;
  private logger: winston.Logger;

  constructor(
    database: DatabaseService,
    jwtService?: JWTService,
    apiKeyService?: APIKeyService,
    rbacService?: RBACService
  ) {
    this.database = database;
    this.jwtService = jwtService || new JWTService();
    this.apiKeyService = apiKeyService || new APIKeyService();
    this.rbacService = rbacService || new RBACService();

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'auth-middleware' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });
  }

  /**
   * Require authentication (JWT or API Key)
   */
  requireAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        res.status(401).json({ error: 'No authorization header provided' });
        return;
      }

      // Check if it's a Bearer token (JWT) or API key
      if (authHeader.startsWith('Bearer ')) {
        await this.authenticateJWT(req, res, next);
      } else if (authHeader.startsWith('ApiKey ')) {
        await this.authenticateAPIKey(req, res, next);
      } else {
        res.status(401).json({ error: 'Invalid authorization header format' });
      }
    } catch (error) {
      this.logger.error('Authentication error', error);
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Authentication failed'
      });
    }
  };

  /**
   * Authenticate using JWT
   */
  private authenticateJWT = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(401).json({ error: 'No token provided' });
        return;
      }

      const payload = this.jwtService.verifyToken(token);

      // Verify user still exists and is active
      const user = await this.database.getUserById(payload.userId);
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      req.user = payload;
      next();
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Invalid token'
      });
    }
  };

  /**
   * Authenticate using API Key
   */
  private authenticateAPIKey = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const apiKey = req.headers.authorization?.replace('ApiKey ', '');

      if (!apiKey) {
        res.status(401).json({ error: 'No API key provided' });
        return;
      }

      // Validate API key format
      if (!this.apiKeyService.isValidAPIKeyFormat(apiKey)) {
        res.status(401).json({ error: 'Invalid API key format' });
        return;
      }

      // Get API key from database
      const storedAPIKey = await this.database.getAPIKeyByKey(
        this.apiKeyService.hashAPIKey(apiKey)
      );

      if (!storedAPIKey) {
        res.status(401).json({ error: 'Invalid API key' });
        return;
      }

      // Validate API key
      if (!this.apiKeyService.isAPIKeyValid(storedAPIKey)) {
        res.status(401).json({ error: 'API key is expired or inactive' });
        return;
      }

      // Update last used timestamp
      await this.database.updateAPIKeyLastUsed(storedAPIKey.id);

      // Get user
      const user = await this.database.getUserById(storedAPIKey.userId);
      if (!user || !user.isActive) {
        res.status(401).json({ error: 'User not found or inactive' });
        return;
      }

      req.apiKey = {
        id: storedAPIKey.id,
        userId: storedAPIKey.userId,
        permissions: storedAPIKey.permissions,
      };

      // Set user context for RBAC
      req.user = {
        userId: user.id,
        email: user.email,
        roles: user.roles,
        iat: Date.now(),
        exp: Date.now() + 3600000, // 1 hour
      };

      next();
    } catch (error) {
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Invalid API key'
      });
    }
  };

  /**
   * Require specific roles
   */
  requireRole = (...roles: UserRole[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!this.rbacService.hasRole(req.user.roles, roles)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: roles,
          current: req.user.roles,
        });
        return;
      }

      next();
    };
  };

  /**
   * Require specific permission
   */
  requirePermission = (resource: string, action: string) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
      if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      if (!this.rbacService.hasPermission(req.user.roles, resource, action)) {
        res.status(403).json({
          error: 'Insufficient permissions',
          required: { resource, action },
          current: this.rbacService.getAccessibleActions(req.user.roles, resource),
        });
        return;
      }

      next();
    };
  };

  /**
   * Optional authentication (doesn't fail if not authenticated)
   */
  optionalAuth = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader) {
        next();
        return;
      }

      if (authHeader.startsWith('Bearer ')) {
        await this.authenticateJWT(req, res, next);
      } else if (authHeader.startsWith('ApiKey ')) {
        await this.authenticateAPIKey(req, res, next);
      } else {
        next();
      }
    } catch (error) {
      // Ignore errors for optional auth
      next();
    }
  };
}
