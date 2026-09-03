import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, Role, TokenType, UserStatus } from '@prisma/client';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { AccountTokenService } from '../auth/account-token.service';
import { MailService } from '../mail/mail.service';

describe('UserService', () => {
  let service: UserService;
  let userRepository: jest.Mocked<Pick<UserRepository, 'createPendingUser'>>;
  let accountTokenService: jest.Mocked<Pick<AccountTokenService, 'createForUser'>>;
  let mailService: jest.Mocked<Pick<MailService, 'sendActivationLink'>>;

  const orgId = 'org-1';
  const pendingUser = {
    id: 'user-1',
    organizationId: orgId,
    email: 'agent@acme.com',
    firstname: null,
    lastname: null,
    password: null,
    role: Role.AGENT,
    status: UserStatus.PENDING,
    created_at: new Date(),
  };

  beforeEach(() => {
    userRepository = { createPendingUser: jest.fn().mockResolvedValue(pendingUser) };
    accountTokenService = { createForUser: jest.fn().mockResolvedValue('raw-token') };
    mailService = { sendActivationLink: jest.fn().mockResolvedValue(undefined) };
    service = new UserService(
      userRepository as unknown as UserRepository,
      accountTokenService as unknown as AccountTokenService,
      mailService as unknown as MailService,
    );
  });

  it("crée un membre PENDING dans l'organisation de l'admin, génère un token et envoie le mail", async () => {
    const result = await service.createUser({ email: 'agent@acme.com' }, orgId);

    expect(userRepository.createPendingUser).toHaveBeenCalledWith({
      email: 'agent@acme.com',
      role: Role.AGENT,
      organizationId: orgId,
    });
    expect(accountTokenService.createForUser).toHaveBeenCalledWith('user-1', TokenType.ACTIVATION);
    expect(mailService.sendActivationLink).toHaveBeenCalledWith('agent@acme.com', 'raw-token', Role.AGENT);
    expect(result).toMatchObject({ id: 'user-1', role: Role.AGENT, status: UserStatus.PENDING });
    expect(result).not.toHaveProperty('password');
  });

  it("renvoie 409 si l'email est déjà utilisé", async () => {
    userRepository.createPendingUser.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: '6' }),
    );
    await expect(service.createUser({ email: 'agent@acme.com' }, orgId)).rejects.toBeInstanceOf(ConflictException);
    expect(accountTokenService.createForUser).not.toHaveBeenCalled();
  });
});

describe('UserService.updateUserRole', () => {
  const orgId = 'org-1';
  const activeAgent = {
    id: 'agent-1',
    organizationId: orgId,
    email: 'agent@acme.com',
    firstname: 'A',
    lastname: 'Gent',
    password: 'hash',
    role: Role.AGENT,
    status: UserStatus.ACTIVE,
    created_at: new Date(),
  };
  const activeAdmin = { ...activeAgent, id: 'admin-1', email: 'admin@acme.com', role: Role.ADMIN };

  function makeService(overrides: {
    findMemberById?: jest.Mock;
    countActiveAdmins?: jest.Mock;
    updateRole?: jest.Mock;
  }) {
    const repo = {
      findMemberById: overrides.findMemberById ?? jest.fn(),
      countActiveAdmins: overrides.countActiveAdmins ?? jest.fn().mockResolvedValue(2),
      updateRole: overrides.updateRole ?? jest.fn(),
    };
    const service = new UserService(
      repo as unknown as UserRepository,
      { createForUser: jest.fn() } as unknown as AccountTokenService,
      { sendActivationLink: jest.fn() } as unknown as MailService,
    );
    return { service, repo };
  }

  it('promeut un agent en admin', async () => {
    const { service, repo } = makeService({
      findMemberById: jest.fn().mockResolvedValue(activeAgent),
      updateRole: jest.fn().mockResolvedValue({ ...activeAgent, role: Role.ADMIN }),
    });

    const result = await service.updateUserRole('agent-1', Role.ADMIN, orgId);

    expect(repo.updateRole).toHaveBeenCalledWith('agent-1', Role.ADMIN);
    expect(result.role).toBe(Role.ADMIN);
  });

  it('renvoie 404 si la cible est hors organisation', async () => {
    const { service } = makeService({ findMemberById: jest.fn().mockResolvedValue(null) });
    await expect(service.updateUserRole('ghost', Role.ADMIN, orgId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it("refuse de changer le rôle d'un CLIENT", async () => {
    const { service } = makeService({
      findMemberById: jest.fn().mockResolvedValue({ ...activeAgent, role: Role.CLIENT }),
    });
    await expect(service.updateUserRole('agent-1', Role.ADMIN, orgId)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('refuse de rétrograder le dernier admin actif', async () => {
    const { service, repo } = makeService({
      findMemberById: jest.fn().mockResolvedValue(activeAdmin),
      countActiveAdmins: jest.fn().mockResolvedValue(1),
    });
    await expect(service.updateUserRole('admin-1', Role.AGENT, orgId)).rejects.toBeInstanceOf(BadRequestException);
    expect(repo.updateRole).not.toHaveBeenCalled();
  });

  it('rétrograde un admin quand il en reste un autre', async () => {
    const { service, repo } = makeService({
      findMemberById: jest.fn().mockResolvedValue(activeAdmin),
      countActiveAdmins: jest.fn().mockResolvedValue(2),
      updateRole: jest.fn().mockResolvedValue({ ...activeAdmin, role: Role.AGENT }),
    });
    const result = await service.updateUserRole('admin-1', Role.AGENT, orgId);
    expect(repo.updateRole).toHaveBeenCalledWith('admin-1', Role.AGENT);
    expect(result.role).toBe(Role.AGENT);
  });

  it("rétrograde un admin PENDING même s'il ne reste qu'un admin actif", async () => {
    const pendingAdmin = { ...activeAdmin, status: UserStatus.PENDING };
    const { service, repo } = makeService({
      findMemberById: jest.fn().mockResolvedValue(pendingAdmin),
      countActiveAdmins: jest.fn().mockResolvedValue(1),
      updateRole: jest.fn().mockResolvedValue({ ...pendingAdmin, role: Role.AGENT }),
    });
    const result = await service.updateUserRole('admin-1', Role.AGENT, orgId);
    expect(repo.updateRole).toHaveBeenCalledWith('admin-1', Role.AGENT);
    expect(result.role).toBe(Role.AGENT);
  });
});

describe('UserService.resendInvitation', () => {
  const orgId = 'org-1';
  const pendingAgent = {
    id: 'agent-1',
    organizationId: orgId,
    email: 'agent@acme.com',
    firstname: null,
    lastname: null,
    password: null,
    role: Role.AGENT,
    status: UserStatus.PENDING,
    created_at: new Date(),
  };

  function makeService(member: unknown) {
    const repo = { findMemberById: jest.fn().mockResolvedValue(member) };
    const tokens = { createForUser: jest.fn().mockResolvedValue('raw-token') };
    const mail = { sendActivationLink: jest.fn().mockResolvedValue(undefined) };
    const service = new UserService(
      repo as unknown as UserRepository,
      tokens as unknown as AccountTokenService,
      mail as unknown as MailService,
    );
    return { service, tokens, mail };
  }

  it("régénère un token et renvoie l'email d'activation d'un membre PENDING", async () => {
    const { service, tokens, mail } = makeService(pendingAgent);
    await service.resendInvitation('agent-1', orgId);
    expect(tokens.createForUser).toHaveBeenCalledWith('agent-1', TokenType.ACTIVATION);
    expect(mail.sendActivationLink).toHaveBeenCalledWith('agent@acme.com', 'raw-token', Role.AGENT);
  });

  it('renvoie 404 si le membre est hors organisation', async () => {
    const { service } = makeService(null);
    await expect(service.resendInvitation('ghost', orgId)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('refuse pour un membre déjà actif', async () => {
    const { service, tokens } = makeService({ ...pendingAgent, status: UserStatus.ACTIVE });
    await expect(service.resendInvitation('agent-1', orgId)).rejects.toBeInstanceOf(BadRequestException);
    expect(tokens.createForUser).not.toHaveBeenCalled();
  });

  it('refuse pour un CLIENT', async () => {
    const { service } = makeService({ ...pendingAgent, role: Role.CLIENT });
    await expect(service.resendInvitation('agent-1', orgId)).rejects.toBeInstanceOf(BadRequestException);
  });
});
