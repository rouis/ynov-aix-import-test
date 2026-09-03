import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, Role, TokenType, User } from '@prisma/client';
import { UserRepository } from './user.repository';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMapper } from './mappers/user-mapper';
import { AccountTokenService } from '../auth/account-token.service';
import { MailService } from '../mail/mail.service';

@Injectable()
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private accountTokenService: AccountTokenService,
    private mailService: MailService,
  ) {}

  /**
   * Création d'un membre par un admin : crée un compte PENDING dans l'organisation
   * de l'admin, génère un token d'activation et envoie le lien par email.
   */
  async createUser(createUserDto: CreateUserDto, organizationId: string): Promise<UserResponseDto> {
    let user: User;
    try {
      user = await this.userRepository.createPendingUser({
        email: createUserDto.email,
        role: Role.AGENT,
        organizationId,
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Cet email est déjà utilisé');
      }
      throw error;
    }

    const token = await this.accountTokenService.createForUser(user.id, TokenType.ACTIVATION);
    await this.mailService.sendActivationLink(user.email, token, user.role);

    return UserMapper.toResponse(user);
  }

  async findUserById(id: string, organizationId: string): Promise<UserResponseDto> {
    return this.userRepository.findUserById(id, organizationId);
  }

  async getAllUsers(organizationId: string): Promise<UserResponseDto[]> {
    return this.userRepository.getAllUser(organizationId);
  }

  async deleteUserById(id: string, organizationId: string): Promise<void> {
    return this.userRepository.deleteUserById(id, organizationId);
  }

  /**
   * Change le rôle d'un membre (ADMIN ou AGENT uniquement). Refuse de toucher
   * aux CLIENT (demandeurs email internes) et de rétrograder le dernier admin actif.
   */
  async updateUserRole(id: string, role: Role, organizationId: string): Promise<UserResponseDto> {
    const member = await this.userRepository.findMemberById(id, organizationId);
    if (!member) throw new NotFoundException('Utilisateur introuvable');
    if (member.role === Role.CLIENT) {
      throw new BadRequestException("Ce compte n'est pas un membre de l'équipe");
    }
    // Seul un admin ACTIF compte comme "dernier admin" : rétrograder un admin
    // encore PENDING ne réduit pas le nombre d'admins capables de se connecter.
    if (member.role === Role.ADMIN && member.status === 'ACTIVE' && role === Role.AGENT) {
      const admins = await this.userRepository.countActiveAdmins(organizationId);
      if (admins <= 1) {
        throw new BadRequestException('Impossible de rétrograder le dernier administrateur');
      }
    }
    const updated = await this.userRepository.updateRole(id, role);
    return UserMapper.toResponse(updated);
  }

  /** Renvoie l'email d'activation d'un membre encore en attente (token régénéré). */
  async resendInvitation(id: string, organizationId: string): Promise<void> {
    const member = await this.userRepository.findMemberById(id, organizationId);
    if (!member) throw new NotFoundException('Utilisateur introuvable');
    if (member.role === Role.CLIENT) {
      throw new BadRequestException("Ce compte n'est pas un membre de l'équipe");
    }
    if (member.status !== 'PENDING') {
      throw new BadRequestException('Ce membre a déjà activé son compte');
    }
    const token = await this.accountTokenService.createForUser(member.id, TokenType.ACTIVATION);
    await this.mailService.sendActivationLink(member.email, token, member.role);
  }
}
