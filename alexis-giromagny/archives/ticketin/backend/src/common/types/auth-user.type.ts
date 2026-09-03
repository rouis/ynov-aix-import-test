import { Role } from '@prisma/client';

export interface AuthUser {
  sub: string;
  email: string;
  organizationId: string;
  role: Role;
}
