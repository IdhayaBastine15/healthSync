// Mirrors shared/rbac.json exactly. UI gating only - the real enforcement
// happens server-side in each service's app/core/security.py; this just
// hides controls a user's token wouldn't be allowed to use anyway.
export const PERMISSIONS = {
  PATIENT_READ: ['NURSE', 'DOCTOR', 'CONSULTANT', 'ADMIN', 'DATA_PROTECTION_OFFICER'],
  PATIENT_WRITE: ['DOCTOR', 'CONSULTANT', 'ADMIN'],
  SENSITIVE_DATA: ['DOCTOR', 'CONSULTANT', 'ADMIN', 'DATA_PROTECTION_OFFICER'],
  RESULT_READ: ['NURSE', 'DOCTOR', 'CONSULTANT', 'LAB_TECH', 'ADMIN'],
  RESULT_FILE: ['LAB_TECH', 'ADMIN'],
  RESULT_ACKNOWLEDGE: ['NURSE', 'DOCTOR', 'CONSULTANT', 'ADMIN'],
  AUDIT_READ: ['ADMIN', 'DATA_PROTECTION_OFFICER'],
  ANALYTICS_READ: ['ADMIN', 'CONSULTANT'],
  USER_MANAGE: ['ADMIN'],
  GDPR_REPORT: ['DATA_PROTECTION_OFFICER'],
} as const

export type Permission = keyof typeof PERMISSIONS

export function hasPermission(roles: string[], permission: Permission): boolean {
  const allowedRoles: readonly string[] = PERMISSIONS[permission]
  return roles.some((role) => allowedRoles.includes(role))
}

// shared/rbac.json's "roles" array - the full set a signup form may offer.
export const ROLES = ['NURSE', 'DOCTOR', 'CONSULTANT', 'LAB_TECH', 'ADMIN', 'DATA_PROTECTION_OFFICER'] as const
