import { describe, it, expect } from 'vitest';
import { resolvePermissions, resolveRoles } from '../../src/core/rbac';

const policy = {
    roles: {
        admin: ['tool:run', 'memory:write'],
        reader: ['memory:read'],
    },
    defaultRoles: ['reader'],
};

describe('RBAC helpers', () => {
    it('should resolve default roles', () => {
        const roles = resolveRoles(policy, undefined);
        expect(roles).toEqual(['reader']);
    });

    it('should resolve permissions for roles', () => {
        const permissions = resolvePermissions(policy, ['admin']);
        expect(permissions['tool:run']).toBe(true);
        expect(permissions['memory:write']).toBe(true);
        expect(permissions['memory:read']).toBeUndefined();
    });
});
