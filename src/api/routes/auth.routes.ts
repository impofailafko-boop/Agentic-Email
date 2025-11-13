import express, { Router } from 'express';
import { JWTService } from '../../auth/jwt.service';
import { PasswordService } from '../../auth/password.service';
import { APIKeyService } from '../../auth/api-key.service';
import { DatabaseService } from '../../services/database.service';
import { User, UserRole, CreateUserSchema, LoginSchema, CreateAPIKeySchema } from '../../models/user.model';
import { AuthMiddleware, AuthenticatedRequest } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';
import winston from 'winston';

export function createAuthRoutes(
  database: DatabaseService,
  jwtService: JWTService,
  passwordService: PasswordService,
  apiKeyService: APIKeyService,
  authMiddleware: AuthMiddleware,
  logger: winston.Logger
): Router {
  const router = express.Router();

  /**
   * Register a new user
   */
  router.post('/register', async (req, res) => {
    try {
      const result = CreateUserSchema.safeParse(req.body);

      if (!result.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: result.error.errors,
        });
        return;
      }

      const { email, password, roles, metadata } = result.data;

      // Check if user already exists
      const existingUser = await database.getUserByEmail(email);
      if (existingUser) {
        res.status(409).json({ error: 'User already exists' });
        return;
      }

      // Check password strength
      const passwordStrength = passwordService.checkPasswordStrength(password);
      if (!passwordStrength.isStrong) {
        res.status(400).json({
          error: 'Password is too weak',
          feedback: passwordStrength.feedback,
          score: passwordStrength.score,
        });
        return;
      }

      // Hash password
      const passwordHash = await passwordService.hashPassword(password);

      // Create user
      const user: User = {
        id: uuidv4(),
        email,
        passwordHash,
        roles: roles || [UserRole.USER],
        apiKeys: [],
        isActive: true,
        metadata,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await database.createUser(user);

      // Generate tokens
      const accessToken = jwtService.generateAccessToken(user.id, user.email, user.roles);
      const refreshToken = jwtService.generateRefreshToken(user.id, user.email, user.roles);

      logger.info(`User registered: ${user.email}`);

      res.status(201).json({
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          createdAt: user.createdAt,
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      logger.error('Registration failed', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Registration failed',
      });
    }
  });

  /**
   * Login
   */
  router.post('/login', async (req, res) => {
    try {
      const result = LoginSchema.safeParse(req.body);

      if (!result.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: result.error.errors,
        });
        return;
      }

      const { email, password } = result.data;

      // Get user
      const user = await database.getUserByEmail(email);
      if (!user) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Check if user is active
      if (!user.isActive) {
        res.status(403).json({ error: 'Account is inactive' });
        return;
      }

      // Verify password
      const isValid = await passwordService.verifyPassword(password, user.passwordHash);
      if (!isValid) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }

      // Update last login
      await database.updateUser(user.id, { lastLogin: new Date() });

      // Generate tokens
      const accessToken = jwtService.generateAccessToken(user.id, user.email, user.roles);
      const refreshToken = jwtService.generateRefreshToken(user.id, user.email, user.roles);

      logger.info(`User logged in: ${user.email}`);

      res.json({
        user: {
          id: user.id,
          email: user.email,
          roles: user.roles,
          lastLogin: new Date(),
        },
        accessToken,
        refreshToken,
      });
    } catch (error) {
      logger.error('Login failed', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Login failed',
      });
    }
  });

  /**
   * Refresh access token
   */
  router.post('/refresh', async (req, res) => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({ error: 'Refresh token is required' });
        return;
      }

      const accessToken = jwtService.refreshAccessToken(refreshToken);

      res.json({ accessToken });
    } catch (error) {
      logger.error('Token refresh failed', error);
      res.status(401).json({
        error: error instanceof Error ? error.message : 'Invalid refresh token',
      });
    }
  });

  /**
   * Get current user
   */
  router.get('/me', authMiddleware.requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const user = await database.getUserById(req.user.userId);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({
        id: user.id,
        email: user.email,
        roles: user.roles,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        metadata: user.metadata,
      });
    } catch (error) {
      logger.error('Failed to get user', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to get user',
      });
    }
  });

  /**
   * Create API key
   */
  router.post('/api-keys', authMiddleware.requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const result = CreateAPIKeySchema.safeParse(req.body);

      if (!result.success) {
        res.status(400).json({
          error: 'Validation failed',
          details: result.error.errors,
        });
        return;
      }

      const { name, permissions, expiresAt } = result.data;

      // Create API key
      const { key, apiKeyObject } = apiKeyService.createAPIKeyObject(
        req.user.userId,
        name,
        permissions,
        expiresAt
      );

      await database.createAPIKey(apiKeyObject);

      logger.info(`API key created: ${name} for user ${req.user.email}`);

      res.status(201).json({
        id: apiKeyObject.id,
        name: apiKeyObject.name,
        key, // Only returned once!
        permissions: apiKeyObject.permissions,
        createdAt: apiKeyObject.createdAt,
        expiresAt: apiKeyObject.expiresAt,
      });
    } catch (error) {
      logger.error('Failed to create API key', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to create API key',
      });
    }
  });

  /**
   * List API keys
   */
  router.get('/api-keys', authMiddleware.requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const apiKeys = await database.listAPIKeys(req.user.userId);

      res.json({
        apiKeys: apiKeys.map(k => ({
          id: k.id,
          name: k.name,
          key: apiKeyService.maskAPIKey(k.key),
          permissions: k.permissions,
          createdAt: k.createdAt,
          lastUsedAt: k.lastUsedAt,
          expiresAt: k.expiresAt,
          isActive: k.isActive,
        })),
      });
    } catch (error) {
      logger.error('Failed to list API keys', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to list API keys',
      });
    }
  });

  /**
   * Revoke API key
   */
  router.delete('/api-keys/:id', authMiddleware.requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user) {
        res.status(401).json({ error: 'Not authenticated' });
        return;
      }

      const apiKey = await database.getAPIKeyById(req.params.id);

      if (!apiKey) {
        res.status(404).json({ error: 'API key not found' });
        return;
      }

      // Check ownership
      if (apiKey.userId !== req.user.userId) {
        res.status(403).json({ error: 'Not authorized to revoke this API key' });
        return;
      }

      await database.revokeAPIKey(req.params.id);

      logger.info(`API key revoked: ${apiKey.name} for user ${req.user.email}`);

      res.json({ success: true });
    } catch (error) {
      logger.error('Failed to revoke API key', error);
      res.status(500).json({
        error: error instanceof Error ? error.message : 'Failed to revoke API key',
      });
    }
  });

  return router;
}
