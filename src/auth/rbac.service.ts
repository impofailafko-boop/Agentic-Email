import { UserRole } from '../models/user.model';
import winston from 'winston';

/**
 * Permission structure
 */
export interface Permission {
  resource: string;
  action: string;
  roles: UserRole[];
}

/**
 * RBAC (Role-Based Access Control) Service
 */
export class RBACService {
  private permissions: Map<string, Permission>;
  private logger: winston.Logger;

  constructor() {
    this.permissions = new Map();
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.json(),
      defaultMeta: { service: 'rbac-service' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple(),
        }),
      ],
    });

    this.initializeDefaultPermissions();
  }

  /**
   * Initialize default permissions
   */
  private initializeDefaultPermissions(): void {
    // Campaign permissions
    this.addPermission('campaigns', 'create', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('campaigns', 'read', [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]);
    this.addPermission('campaigns', 'update', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('campaigns', 'delete', [UserRole.ADMIN]);
    this.addPermission('campaigns', 'schedule', [UserRole.ADMIN, UserRole.MANAGER]);

    // Email permissions
    this.addPermission('emails', 'send', [UserRole.ADMIN, UserRole.MANAGER, UserRole.API_CONSUMER]);
    this.addPermission('emails', 'read', [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]);
    this.addPermission('emails', 'update', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('emails', 'delete', [UserRole.ADMIN]);

    // Draft permissions
    this.addPermission('drafts', 'generate', [UserRole.ADMIN, UserRole.MANAGER, UserRole.API_CONSUMER]);
    this.addPermission('drafts', 'read', [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]);
    this.addPermission('drafts', 'approve', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('drafts', 'delete', [UserRole.ADMIN, UserRole.MANAGER]);

    // Agent permissions
    this.addPermission('agents', 'read', [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]);
    this.addPermission('agents', 'configure', [UserRole.ADMIN]);

    // User management permissions
    this.addPermission('users', 'create', [UserRole.ADMIN]);
    this.addPermission('users', 'read', [UserRole.ADMIN]);
    this.addPermission('users', 'update', [UserRole.ADMIN]);
    this.addPermission('users', 'delete', [UserRole.ADMIN]);

    // API key permissions
    this.addPermission('api-keys', 'create', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('api-keys', 'read', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('api-keys', 'revoke', [UserRole.ADMIN, UserRole.MANAGER]);

    // Analytics permissions
    this.addPermission('analytics', 'read', [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]);
    this.addPermission('analytics', 'export', [UserRole.ADMIN, UserRole.MANAGER]);

    // Template permissions
    this.addPermission('templates', 'create', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('templates', 'read', [UserRole.ADMIN, UserRole.MANAGER, UserRole.USER]);
    this.addPermission('templates', 'update', [UserRole.ADMIN, UserRole.MANAGER]);
    this.addPermission('templates', 'delete', [UserRole.ADMIN]);

    this.logger.info(`Initialized ${this.permissions.size} default permissions`);
  }

  /**
   * Add a new permission
   */
  addPermission(resource: string, action: string, roles: UserRole[]): void {
    const key = this.getPermissionKey(resource, action);
    this.permissions.set(key, { resource, action, roles });
  }

  /**
   * Remove a permission
   */
  removePermission(resource: string, action: string): void {
    const key = this.getPermissionKey(resource, action);
    this.permissions.delete(key);
  }

  /**
   * Get permission key
   */
  private getPermissionKey(resource: string, action: string): string {
    return `${resource}:${action}`;
  }

  /**
   * Check if user has permission
   */
  hasPermission(userRoles: UserRole[], resource: string, action: string): boolean {
    const key = this.getPermissionKey(resource, action);
    const permission = this.permissions.get(key);

    if (!permission) {
      this.logger.warn(`Permission not found: ${key}`);
      return false;
    }

    // Admins have all permissions
    if (userRoles.includes(UserRole.ADMIN)) {
      return true;
    }

    // Check if any user role matches required roles
    return userRoles.some(role => permission.roles.includes(role));
  }

  /**
   * Check if user has any of the specified roles
   */
  hasRole(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
    return userRoles.some(role => requiredRoles.includes(role));
  }

  /**
   * Check if user has all of the specified roles
   */
  hasAllRoles(userRoles: UserRole[], requiredRoles: UserRole[]): boolean {
    return requiredRoles.every(role => userRoles.includes(role));
  }

  /**
   * Get all permissions for a role
   */
  getPermissionsForRole(role: UserRole): Permission[] {
    return Array.from(this.permissions.values()).filter(permission =>
      permission.roles.includes(role)
    );
  }

  /**
   * Get all permissions for user roles
   */
  getPermissionsForRoles(roles: UserRole[]): Permission[] {
    const permissions = new Set<Permission>();

    for (const role of roles) {
      const rolePermissions = this.getPermissionsForRole(role);
      rolePermissions.forEach(p => permissions.add(p));
    }

    return Array.from(permissions);
  }

  /**
   * Get all resources a user can access
   */
  getAccessibleResources(userRoles: UserRole[]): string[] {
    const resources = new Set<string>();

    for (const permission of this.permissions.values()) {
      if (this.hasRole(userRoles, permission.roles)) {
        resources.add(permission.resource);
      }
    }

    return Array.from(resources);
  }

  /**
   * Get all actions a user can perform on a resource
   */
  getAccessibleActions(userRoles: UserRole[], resource: string): string[] {
    const actions: string[] = [];

    for (const permission of this.permissions.values()) {
      if (
        permission.resource === resource &&
        this.hasRole(userRoles, permission.roles)
      ) {
        actions.push(permission.action);
      }
    }

    return actions;
  }
}
