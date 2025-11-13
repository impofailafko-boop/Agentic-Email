import { z } from 'zod';

/**
 * User roles for RBAC
 */
export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  USER = 'user',
  API_CONSUMER = 'api-consumer',
}

/**
 * API Key interface
 */
export interface APIKey {
  id: string;
  key: string;
  name: string;
  userId: string;
  permissions: string[];
  createdAt: Date;
  lastUsedAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
}

/**
 * User interface
 */
export interface User {
  id: string;
  email: string;
  passwordHash: string;
  roles: UserRole[];
  apiKeys: APIKey[];
  createdAt: Date;
  updatedAt: Date;
  lastLogin?: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

/**
 * Token payload interface
 */
export interface TokenPayload {
  userId: string;
  email: string;
  roles: UserRole[];
  iat: number;
  exp: number;
}

/**
 * Zod schemas for validation
 */
export const UserRoleSchema = z.enum([
  UserRole.ADMIN,
  UserRole.MANAGER,
  UserRole.USER,
  UserRole.API_CONSUMER,
]);

export const APIKeySchema = z.object({
  id: z.string().uuid(),
  key: z.string().min(32),
  name: z.string().min(1).max(100),
  userId: z.string().uuid(),
  permissions: z.array(z.string()),
  createdAt: z.date(),
  lastUsedAt: z.date().optional(),
  expiresAt: z.date().optional(),
  isActive: z.boolean(),
});

export const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  passwordHash: z.string(),
  roles: z.array(UserRoleSchema),
  apiKeys: z.array(APIKeySchema),
  createdAt: z.date(),
  updatedAt: z.date(),
  lastLogin: z.date().optional(),
  isActive: z.boolean(),
  metadata: z.record(z.any()).optional(),
});

export const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(UserRoleSchema).default([UserRole.USER]),
  metadata: z.record(z.any()).optional(),
});

export const UpdateUserSchema = z.object({
  email: z.string().email().optional(),
  password: z.string().min(8).optional(),
  roles: z.array(UserRoleSchema).optional(),
  isActive: z.boolean().optional(),
  metadata: z.record(z.any()).optional(),
});

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export const CreateAPIKeySchema = z.object({
  name: z.string().min(1).max(100),
  permissions: z.array(z.string()),
  expiresAt: z.date().optional(),
});

export type CreateUserInput = z.infer<typeof CreateUserSchema>;
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type CreateAPIKeyInput = z.infer<typeof CreateAPIKeySchema>;
