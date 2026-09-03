import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { Role, TokenType, UserStatus } from '@prisma/client';
import { AuthService } from './auth.service';
import { UserRepository } from '../user/user.repository';
import { HashingUtil } from 'src/common/utils/hashing.util';
import { PrismaService } from '../../prisma.service';
import { AccountTokenService } from './account-token.service';
import { MailService } from '../mail/mail.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: { $transaction: jest.Mock };
  let userRepository: jest.Mocked<
    Pick<UserRepository, 'findUserByEmail' | 'findRawById' | 'activateUser' | 'updatePassword'>
  >;
  let hashingUtil: jest.Mocked<Pick<HashingUtil, 'hashPassword' | 'hashComparePassword'>>;
  let jwtService: { signAsync: jest.Mock };
  let accountTokenService: jest.Mocked<Pick<AccountTokenService, 'createForUser' | 'findValid' | 'markUsed'>>;
  let mailService: jest.Mocked<Pick<MailService, 'sendActivationLink' | 'sendPasswordResetLink'>>;

  const admin = {
    id: 'admin-1',
    organizationId: 'org-1',
    email: 'admin@acme.com',
    firstname: null,
    lastname: null,
    password: null,
    role: Role.ADMIN,
    status: UserStatus.PENDING,
    created_at: new Date(),
  };

  beforeEach(() => {
    prisma = {
      $transaction: jest.fn().mockImplementation((cb: (tx: unknown) => unknown) =>
        cb({
          organization: { create: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Acme' }) },
          user: { create: jest.fn().mockResolvedValue(admin) },
        }),
      ),
    };
    userRepository = {
      findUserByEmail: jest.fn(),
      findRawById: jest.fn(),
      activateUser: jest.fn(),
      updatePassword: jest.fn(),
    };
    hashingUtil = {
      hashPassword: jest.fn().mockResolvedValue('hashed'),
      hashComparePassword: jest.fn(),
    };
    jwtService = { signAsync: jest.fn().mockResolvedValue('jwt') };
    accountTokenService = {
      createForUser: jest.fn().mockResolvedValue('raw-token'),
      findValid: jest.fn(),
      markUsed: jest.fn(),
    };
    mailService = {
      sendActivationLink: jest.fn().mockResolvedValue(undefined),
      sendPasswordResetLink: jest.fn().mockResolvedValue(undefined),
    };

    service = new AuthService(
      prisma as unknown as PrismaService,
      userRepository as unknown as UserRepository,
      hashingUtil as unknown as HashingUtil,
      jwtService as never,
      accountTokenService as unknown as AccountTokenService,
      mailService as unknown as MailService,
    );
  });

  describe('registerOrganization', () => {
    it('crée org + admin, génère un token et envoie le lien (sans access_token)', async () => {
      const result = await service.registerOrganization({ organizationName: 'Acme', adminEmail: 'admin@acme.com' });

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(accountTokenService.createForUser).toHaveBeenCalledWith('admin-1', TokenType.ACTIVATION);
      expect(mailService.sendActivationLink).toHaveBeenCalledWith('admin@acme.com', 'raw-token', Role.ADMIN);
      expect(result).not.toHaveProperty('access_token');
    });
  });

  describe('activate', () => {
    it('rejette un token invalide / expiré / déjà utilisé', async () => {
      accountTokenService.findValid.mockResolvedValue(null);
      await expect(
        service.activate({ token: 'bad', firstname: 'J', lastname: 'D', password: 'password1' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(userRepository.activateUser).not.toHaveBeenCalled();
    });

    it('active le compte, marque le token utilisé et renvoie un access_token', async () => {
      accountTokenService.findValid.mockResolvedValue({ id: 'tok-1', userId: 'admin-1' } as never);
      userRepository.activateUser.mockResolvedValue({ ...admin, status: UserStatus.ACTIVE, password: 'hashed' });

      const result = await service.activate({ token: 'good', firstname: 'J', lastname: 'D', password: 'password1' });

      expect(userRepository.activateUser).toHaveBeenCalledWith('admin-1', {
        firstname: 'J',
        lastname: 'D',
        password: 'hashed',
      });
      expect(accountTokenService.markUsed).toHaveBeenCalledWith('tok-1');
      expect(result).toEqual({ access_token: 'jwt' });
    });
  });

  describe('login', () => {
    it('rejette un compte PENDING (non activé)', async () => {
      userRepository.findUserByEmail.mockResolvedValue(admin);
      await expect(service.login({ email: 'admin@acme.com', password: 'password1' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('rejette un mot de passe invalide', async () => {
      userRepository.findUserByEmail.mockResolvedValue({ ...admin, status: UserStatus.ACTIVE, password: 'hashed' });
      hashingUtil.hashComparePassword.mockResolvedValue(false);
      await expect(service.login({ email: 'admin@acme.com', password: 'wrong' })).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('connecte un compte actif avec le bon mot de passe', async () => {
      userRepository.findUserByEmail.mockResolvedValue({ ...admin, status: UserStatus.ACTIVE, password: 'hashed' });
      hashingUtil.hashComparePassword.mockResolvedValue(true);
      const result = await service.login({ email: 'admin@acme.com', password: 'password1' });
      expect(result).toEqual({ access_token: 'jwt' });
    });
  });

  describe('forgotPassword', () => {
    const genericMessage = 'Si un compte existe pour cet email, un lien a été envoyé.';

    it('compte ACTIVE : crée un token PASSWORD_RESET et envoie le mail de reset', async () => {
      userRepository.findUserByEmail.mockResolvedValue({ ...admin, status: UserStatus.ACTIVE, password: 'hashed' });

      const result = await service.forgotPassword({ email: 'admin@acme.com' });

      expect(accountTokenService.createForUser).toHaveBeenCalledWith('admin-1', TokenType.PASSWORD_RESET);
      expect(mailService.sendPasswordResetLink).toHaveBeenCalledWith('admin@acme.com', 'raw-token');
      expect(mailService.sendActivationLink).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });

    it("compte PENDING : renvoie un lien d'activation (pas de reset)", async () => {
      userRepository.findUserByEmail.mockResolvedValue(admin);

      const result = await service.forgotPassword({ email: 'admin@acme.com' });

      expect(accountTokenService.createForUser).toHaveBeenCalledWith('admin-1', TokenType.ACTIVATION);
      expect(mailService.sendActivationLink).toHaveBeenCalledWith('admin@acme.com', 'raw-token', Role.ADMIN);
      expect(mailService.sendPasswordResetLink).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });

    it('email inconnu : aucune action, même réponse générique', async () => {
      userRepository.findUserByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({ email: 'ghost@acme.com' });

      expect(accountTokenService.createForUser).not.toHaveBeenCalled();
      expect(mailService.sendActivationLink).not.toHaveBeenCalled();
      expect(mailService.sendPasswordResetLink).not.toHaveBeenCalled();
      expect(result).toEqual({ message: genericMessage });
    });
  });

  describe('getResetPassword', () => {
    it("retourne l'email pour un token de reset valide", async () => {
      accountTokenService.findValid.mockResolvedValue({ id: 'tok-1', userId: 'admin-1' } as never);
      userRepository.findRawById.mockResolvedValue({ ...admin, status: UserStatus.ACTIVE });

      const result = await service.getResetPassword('good');

      expect(accountTokenService.findValid).toHaveBeenCalledWith('good', TokenType.PASSWORD_RESET);
      expect(result).toEqual({ email: 'admin@acme.com' });
    });

    it('rejette un token invalide', async () => {
      accountTokenService.findValid.mockResolvedValue(null);
      await expect(service.getResetPassword('bad')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('resetPassword', () => {
    it('met à jour le mot de passe hashé et consomme le token, sans access_token', async () => {
      accountTokenService.findValid.mockResolvedValue({ id: 'tok-1', userId: 'admin-1' } as never);

      const result = await service.resetPassword({ token: 'good', password: 'NewPassword1' });

      expect(accountTokenService.findValid).toHaveBeenCalledWith('good', TokenType.PASSWORD_RESET);
      expect(hashingUtil.hashPassword).toHaveBeenCalledWith('NewPassword1');
      expect(userRepository.updatePassword).toHaveBeenCalledWith('admin-1', 'hashed');
      expect(accountTokenService.markUsed).toHaveBeenCalledWith('tok-1');
      expect(result).not.toHaveProperty('access_token');
    });

    it('rejette un token invalide / expiré / déjà utilisé / du mauvais type', async () => {
      accountTokenService.findValid.mockResolvedValue(null);
      await expect(service.resetPassword({ token: 'bad', password: 'NewPassword1' })).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(userRepository.updatePassword).not.toHaveBeenCalled();
    });
  });
});
