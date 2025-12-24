// src/auth/permissions.ts
import type { Role } from './roles'

export const Permission = {
  // System Management
  MANAGE_SYSTEM_SETTINGS: 'MANAGE_SYSTEM_SETTINGS',

  // Tenant/Organization Management
  MANAGE_TENANT_SETTINGS: 'MANAGE_TENANT_SETTINGS',

  // User & Role Management
  MANAGE_ALL_USERS: 'MANAGE_ALL_USERS',
  MANAGE_TEAM_USERS: 'MANAGE_TEAM_USERS',
  VIEW_ALL_USERS: 'VIEW_ALL_USERS',

  // Billing & Subscription Management
  MANAGE_BILLING: 'MANAGE_BILLING',
  VIEW_BILLING: 'VIEW_BILLING',

  // Content Creation & Management
  CREATE_CONTENT: 'CREATE_CONTENT',
  EDIT_OWN_CONTENT: 'EDIT_OWN_CONTENT',
  EDIT_ALL_CONTENT: 'EDIT_ALL_CONTENT',
  PUBLISH_CONTENT: 'PUBLISH_CONTENT',
  UNPUBLISH_CONTENT: 'UNPUBLISH_CONTENT',
  DELETE_CONTENT: 'DELETE_CONTENT',

  // Media/Assets Management
  MANAGE_ASSETS: 'MANAGE_ASSETS',

  // Categories/Tags Management
  MANAGE_CATEGORIES_TAGS: 'MANAGE_CATEGORIES_TAGS',

  // Comments/Community Management
  MANAGE_COMMENTS: 'MANAGE_COMMENTS',

  // Content Viewing
  VIEW_CONTENT: 'VIEW_CONTENT',
  VIEW_OWN_CONTENT: 'VIEW_OWN_CONTENT',
  VIEW_PUBLISHED_CONTENT: 'VIEW_PUBLISHED_CONTENT',

  // Analytics & Reports
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  EXPORT_REPORTS: 'EXPORT_REPORTS',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    // Highest account-level role (no system settings - those require isSuperAdmin flag)
    Permission.MANAGE_TENANT_SETTINGS,
    Permission.MANAGE_ALL_USERS,
    Permission.MANAGE_TEAM_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.UNPUBLISH_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.MANAGE_ASSETS,
    Permission.MANAGE_CATEGORIES_TAGS,
    Permission.MANAGE_COMMENTS,
    Permission.VIEW_CONTENT,
    Permission.VIEW_OWN_CONTENT,
    Permission.VIEW_PUBLISHED_CONTENT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,
  ],
  MANAGER: [
    // Team & workflow management
    Permission.MANAGE_TEAM_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.UNPUBLISH_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.MANAGE_ASSETS,
    Permission.MANAGE_CATEGORIES_TAGS,
    Permission.MANAGE_COMMENTS,
    Permission.VIEW_CONTENT,
    Permission.VIEW_OWN_CONTENT,
    Permission.VIEW_PUBLISHED_CONTENT,
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,
  ],
  EDITOR: [
    // Edit and publish any content
    Permission.CREATE_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.UNPUBLISH_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.MANAGE_ASSETS,
    Permission.MANAGE_CATEGORIES_TAGS,
    Permission.MANAGE_COMMENTS,
    Permission.VIEW_CONTENT,
    Permission.VIEW_OWN_CONTENT,
    Permission.VIEW_PUBLISHED_CONTENT,
  ],
  AUTHOR: [
    // Create and edit own content only
    Permission.CREATE_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.MANAGE_ASSETS,
    Permission.VIEW_OWN_CONTENT,
    Permission.VIEW_PUBLISHED_CONTENT,
  ],
  VIEWER: [
    // Read-only access to published content
    Permission.VIEW_PUBLISHED_CONTENT,
  ],
  BILLING: [
    // Billing and subscription management only
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
  ],
  ANALYTICS: [
    // Analytics and reports access only
    Permission.VIEW_ANALYTICS,
    Permission.EXPORT_REPORTS,
  ],
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p))
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p))
}
