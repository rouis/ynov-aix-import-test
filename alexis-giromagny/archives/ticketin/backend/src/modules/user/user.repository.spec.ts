import { Role } from '@prisma/client';
import { UserRepository } from './user.repository';
import { PrismaService } from '../../prisma.service';

describe('UserRepository.createPendingUser', () => {
  it('transmet le prénom optionnel à Prisma', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'u1' });
    const prisma = { user: { create } } as unknown as PrismaService;
    const repo = new UserRepository(prisma);

    await repo.createPendingUser({
      email: 'jean@ponticelli.com',
      role: Role.CLIENT,
      organizationId: 'org-1',
      firstname: 'Jean Dupont',
    });

    expect(create).toHaveBeenCalledWith({
      data: { email: 'jean@ponticelli.com', role: Role.CLIENT, organizationId: 'org-1', firstname: 'Jean Dupont' },
    });
  });

  it('met firstname à null quand non fourni', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'u2' });
    const prisma = { user: { create } } as unknown as PrismaService;
    const repo = new UserRepository(prisma);

    await repo.createPendingUser({ email: 'x@ponticelli.com', role: Role.CLIENT, organizationId: 'org-1' });

    expect(create).toHaveBeenCalledWith({
      data: { email: 'x@ponticelli.com', role: Role.CLIENT, organizationId: 'org-1', firstname: null },
    });
  });
});

describe('UserRepository.getAllUser', () => {
  it('exclut les utilisateurs CLIENT (demandeurs email internes)', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = { user: { findMany } } as unknown as PrismaService;
    const repo = new UserRepository(prisma);

    await repo.getAllUser('org-1');

    expect(findMany).toHaveBeenCalledWith({
      where: { organizationId: 'org-1', role: { not: Role.CLIENT } },
    });
  });
});
