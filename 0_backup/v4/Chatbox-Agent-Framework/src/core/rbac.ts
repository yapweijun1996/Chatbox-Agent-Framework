/**
 * RBAC policy helpers.
 */

export interface RBACPolicy {
    roles: Record<string, string[]>;
    defaultRoles?: string[];
}

export interface RBACContext {
    roles: string[];
    permissions: Record<string, boolean>;
}

export function resolveRoles(policy: RBACPolicy, roles?: string[]): string[] {
    if (roles && roles.length > 0) return roles;
    return policy.defaultRoles ? [...policy.defaultRoles] : [];
}

export function resolvePermissions(policy: RBACPolicy, roles: string[]): Record<string, boolean> {
    const permissions: Record<string, boolean> = {};

    for (const role of roles) {
        const grants = policy.roles[role] || [];
        for (const permission of grants) {
            permissions[permission] = true;
        }
    }

    return permissions;
}
