import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { RolesGuard } from './roles.guard';
import { AuthUser } from '../types/auth-user.type';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Pick<Reflector, 'getAllAndOverride'>>;

  const contextWithUser = (user?: AuthUser): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
  });

  it("laisse passer si la route n'a pas de contrainte de rôle", () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    expect(guard.canActivate(contextWithUser({ sub: '1', email: 'a', organizationId: 'o', role: Role.CLIENT }))).toBe(
      true,
    );
  });

  it('autorise un utilisateur dont le rôle est requis', () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(guard.canActivate(contextWithUser({ sub: '1', email: 'a', organizationId: 'o', role: Role.ADMIN }))).toBe(
      true,
    );
  });

  it("refuse un utilisateur dont le rôle n'est pas requis", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(() =>
      guard.canActivate(contextWithUser({ sub: '1', email: 'a', organizationId: 'o', role: Role.AGENT })),
    ).toThrow(ForbiddenException);
  });

  it("refuse si aucun utilisateur n'est présent", () => {
    reflector.getAllAndOverride.mockReturnValue([Role.ADMIN]);
    expect(() => guard.canActivate(contextWithUser(undefined))).toThrow(ForbiddenException);
  });
});
