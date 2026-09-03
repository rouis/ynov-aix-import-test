import { ConfigService } from '@nestjs/config';
import { TokenType } from '@prisma/client';
import { AccountTokenService } from './account-token.service';
import { PrismaService } from '../../prisma.service';

describe('AccountTokenService', () => {
  let service: AccountTokenService;
  let prisma: {
    accountToken: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
  };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    prisma = {
      accountToken: {
        create: jest.fn().mockResolvedValue(undefined),
        findUnique: jest.fn(),
        update: jest.fn().mockResolvedValue(undefined),
        updateMany: jest.fn().mockResolvedValue(undefined),
      },
    };
    configService = { get: jest.fn().mockReturnValue(undefined) };
    service = new AccountTokenService(prisma as unknown as PrismaService, configService as unknown as ConfigService);
  });

  describe('createForUser', () => {
    it("n'invalide que les anciens tokens du même type", async () => {
      await service.createForUser('user-1', TokenType.PASSWORD_RESET);
      expect(prisma.accountToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', used_at: null, type: TokenType.PASSWORD_RESET },
        data: { used_at: expect.any(Date) },
      });
    });

    it('crée un token PASSWORD_RESET avec un TTL de 1h par défaut', async () => {
      const before = Date.now();
      await service.createForUser('user-1', TokenType.PASSWORD_RESET);

      const { data } = (
        prisma.accountToken.create.mock.calls as Array<[{ data: { type: TokenType; expires_at: Date } }]>
      )[0][0];
      expect(data.type).toBe(TokenType.PASSWORD_RESET);
      const ttlMs = data.expires_at.getTime() - before;
      expect(ttlMs).toBeGreaterThan(0);
      expect(ttlMs).toBeLessThanOrEqual(60 * 60 * 1000 + 1000); // ~1h
    });

    it('crée un token ACTIVATION avec un TTL de 48h par défaut', async () => {
      const before = Date.now();
      await service.createForUser('user-1', TokenType.ACTIVATION);

      const { data } = (
        prisma.accountToken.create.mock.calls as Array<[{ data: { type: TokenType; expires_at: Date } }]>
      )[0][0];
      expect(data.type).toBe(TokenType.ACTIVATION);
      const ttlMs = data.expires_at.getTime() - before;
      expect(ttlMs).toBeGreaterThan(47 * 60 * 60 * 1000);
      expect(ttlMs).toBeLessThanOrEqual(48 * 60 * 60 * 1000 + 1000);
    });
  });

  describe('findValid', () => {
    const baseToken = {
      id: 'tok-1',
      tokenHash: 'hash',
      userId: 'user-1',
      type: TokenType.PASSWORD_RESET,
      used_at: null,
      expires_at: new Date(Date.now() + 60_000),
      created_at: new Date(),
    };

    it('retourne null si le type ne correspond pas', async () => {
      prisma.accountToken.findUnique.mockResolvedValue({ ...baseToken, type: TokenType.ACTIVATION });
      expect(await service.findValid('raw', TokenType.PASSWORD_RESET)).toBeNull();
    });

    it('retourne le token quand type, expiration et usage sont valides', async () => {
      prisma.accountToken.findUnique.mockResolvedValue(baseToken);
      expect(await service.findValid('raw', TokenType.PASSWORD_RESET)).toEqual(baseToken);
    });

    it('retourne null si le token est expiré ou déjà utilisé', async () => {
      prisma.accountToken.findUnique.mockResolvedValue({ ...baseToken, expires_at: new Date(Date.now() - 1000) });
      expect(await service.findValid('raw', TokenType.PASSWORD_RESET)).toBeNull();

      prisma.accountToken.findUnique.mockResolvedValue({ ...baseToken, used_at: new Date() });
      expect(await service.findValid('raw', TokenType.PASSWORD_RESET)).toBeNull();
    });
  });
});
