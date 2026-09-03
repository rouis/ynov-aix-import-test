import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Restreint l'accès d'une route aux rôles fournis.
 * À utiliser avec `JwtAuthGuard` + `RolesGuard`.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
