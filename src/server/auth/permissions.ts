// src/auth/permissions.ts
import type { Role } from './roles'

export const Permission = {
  MANAGE_SYSTEM_SETTINGS: 'MANAGE_SYSTEM_SETTINGS',
  MANAGE_ALL_USERS: 'MANAGE_ALL_USERS',
  MANAGE_TEAM_USERS: 'MANAGE_TEAM_USERS',
  VIEW_ALL_USERS: 'VIEW_ALL_USERS',
  CREATE_CONTENT: 'CREATE_CONTENT',
  EDIT_ALL_CONTENT: 'EDIT_ALL_CONTENT',
  EDIT_OWN_CONTENT: 'EDIT_OWN_CONTENT',
  DELETE_CONTENT: 'DELETE_CONTENT',
  PUBLISH_CONTENT: 'PUBLISH_CONTENT',
  VIEW_CONTENT: 'VIEW_CONTENT',
  VIEW_ANALYTICS: 'VIEW_ANALYTICS',
  MANAGE_BILLING: 'MANAGE_BILLING',
  VIEW_BILLING: 'VIEW_BILLING',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ADMIN: [
    Permission.MANAGE_SYSTEM_SETTINGS,
    Permission.MANAGE_ALL_USERS,
    Permission.MANAGE_TEAM_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.DELETE_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
  ],
  MANAGER: [
    Permission.MANAGE_TEAM_USERS,
    Permission.VIEW_ALL_USERS,
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
    Permission.VIEW_ANALYTICS,
  ],
  EDITOR: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_ALL_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.PUBLISH_CONTENT,
    Permission.VIEW_CONTENT,
  ],
  AUTHOR: [
    Permission.CREATE_CONTENT,
    Permission.EDIT_OWN_CONTENT,
    Permission.VIEW_CONTENT,
  ],
  VIEWER: [
    Permission.VIEW_CONTENT,
  ],
  BILLING: [
    Permission.MANAGE_BILLING,
    Permission.VIEW_BILLING,
  ],
  ANALYTICS: [
    Permission.VIEW_ANALYTICS,
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
