import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role, TokenType, User, UserStatus } from '@prisma/client';
import { LoginDto } from './dto/login.dto';
import { RegisterOrganizationDto } from './dto/register-organization.dto';
import { ActivateDto } from './dto/activate.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { UserRepository } from '../user/user.repository';
import { HashingUtil } from 'src/common/utils/hashing.util';
import { PrismaService } from '../../prisma.service';
import { AccountTokenService } from './account-token.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private userRepository: UserRepository,
    private hashingUtil: HashingUtil,
    private jwtService: JwtService,
    private accountTokenService: AccountTokenService,
    private mailService: MailService,
  ) {}

  /**
   * Inscription publique : crée une organisation et son premier administrateur
   * (compte PENDING), génère un token d'activation et envoie le lien par email.
   * Ne retourne PAS d'access_token : le compte n'est pas encore actif.
   */
  async registerOrganization(dto: RegisterOrganizationDto): Promise<{ message: string }> {
    let admin: User;
    try {
      admin = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({ data: { name: dto.organizationName } });
        return tx.user.create({
          data: { email: dto.adminEmail, role: Role.ADMIN, organizationId: organization.id },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw error;
    }

    const token = await this.accountTokenService.createForUser(admin.id, TokenType.ACTIVATION);
    await this.mailService.sendActivationLink(admin.email, token, admin.role);

    return { message: "Organisation créée. Un lien d'activation a été envoyé par email." };
  }

  /**
   * Pré-validation du token d'activation (pour pré-remplir le formulaire côté front).
   */
  async getActivation(rawToken: string): Promise<{ email: string; role: Role }> {
    const token = await this.accountTokenService.findValid(rawToken, TokenType.ACTIVATION);
    if (!token) {
      throw new BadRequestException('Token invalide ou expiré');
    }
    const user = await this.userRepository.findRawById(token.userId);
    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }
    return { email: user.email, role: user.role };
  }

  /**
   * Activation du compte : définit nom + mot de passe, passe le statut à ACTIVE,
   * marque le token comme utilisé (usage unique) et connecte l'utilisateur.
   */
  async activate(dto: ActivateDto): Promise<{ access_token: string }> {
    const token = await this.accountTokenService.findValid(dto.token, TokenType.ACTIVATION);
    if (!token) {
      throw new BadRequestException('Token invalide ou expiré');
    }

    const passwordHash = await this.hashingUtil.hashPassword(dto.password);
    const user = await this.userRepository.activateUser(token.userId, {
      firstname: dto.firstname,
      lastname: dto.lastname,
      password: passwordHash,
    });
    await this.accountTokenService.markUsed(token.id);

    return { access_token: await this.signToken(user) };
  }

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    const user = await this.userRepository.findUserByEmail(loginDto.email);
    if (!user) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    if (user.status === 'PENDING' || !user.password) {
      throw new UnauthorizedException('Compte non activé');
    }
    const isPasswordValid = await this.hashingUtil.hashComparePassword(user.password, loginDto.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Identifiants invalides');
    }
    return { access_token: await this.signToken(user) };
  }

  private static readonly GENERIC_FORGOT_MESSAGE = 'Si un compte existe pour cet email, un lien a été envoyé.';

  /**
   * Demande de reset : réponse TOUJOURS identique (anti-énumération d'emails).
   * Compte ACTIVE → lien de reset ; compte PENDING → renvoi du lien d'activation ;
   * email inconnu → aucune action.
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const user = await this.userRepository.findUserByEmail(dto.email);
    if (user) {
      if (user.status === UserStatus.PENDING) {
        const token = await this.accountTokenService.createForUser(user.id, TokenType.ACTIVATION);
        await this.mailService.sendActivationLink(user.email, token, user.role);
      } else {
        const token = await this.accountTokenService.createForUser(user.id, TokenType.PASSWORD_RESET);
        await this.mailService.sendPasswordResetLink(user.email, token);
      }
    }
    return { message: AuthService.GENERIC_FORGOT_MESSAGE };
  }

  /**
   * Pré-validation du token de reset (pour afficher le formulaire côté front).
   */
  async getResetPassword(rawToken: string): Promise<{ email: string }> {
    const token = await this.accountTokenService.findValid(rawToken, TokenType.PASSWORD_RESET);
    if (!token) {
      throw new BadRequestException('Token invalide ou expiré');
    }
    const user = await this.userRepository.findRawById(token.userId);
    if (!user) {
      throw new BadRequestException('Token invalide ou expiré');
    }
    return { email: user.email };
  }

  /**
   * Reset effectif : hash le nouveau mot de passe, consomme le token.
   * Ne retourne PAS d'access_token : l'utilisateur se reconnecte via /login.
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const token = await this.accountTokenService.findValid(dto.token, TokenType.PASSWORD_RESET);
    if (!token) {
      throw new BadRequestException('Token invalide ou expiré');
    }
    const passwordHash = await this.hashingUtil.hashPassword(dto.password);
    await this.userRepository.updatePassword(token.userId, passwordHash);
    await this.accountTokenService.markUsed(token.id);
    return { message: 'Mot de passe mis à jour. Vous pouvez vous connecter.' };
  }

  private signToken(user: User): Promise<string> {
    const payload = { sub: user.id, email: user.email, organizationId: user.organizationId, role: user.role };
    return this.jwtService.signAsync(payload);
  }
}
