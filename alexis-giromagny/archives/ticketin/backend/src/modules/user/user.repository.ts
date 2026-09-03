import { PrismaService } from '../../prisma.service';
import { UserResponseDto } from './dto/user-response.dto';
import { UserMapper } from './mappers/user-mapper';
import { Injectable, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';

@Injectable()
export class UserRepository {
  constructor(private prisma: PrismaService) {}

  /** Crée un membre en attente d'activation (sans mot de passe ; prénom optionnel). */
  async createPendingUser(data: {
    email: string;
    role: Role;
    organizationId: string;
    firstname?: string | null;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        role: data.role,
        organizationId: data.organizationId,
        firstname: data.firstname ?? null,
        // lastname / password restent null jusqu'à l'activation.
      },
    });
  }

  async findUserById(id: string, organizationId: string): Promise<UserResponseDto> {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    return UserMapper.toResponse(user);
  }

  /** Liste les membres de l'équipe (les CLIENT, demandeurs email internes, sont exclus). */
  async getAllUser(organizationId: string): Promise<UserResponseDto[]> {
    const users = await this.prisma.user.findMany({
      where: { organizationId, role: { not: Role.CLIENT } },
    });
    return users.map((user) => UserMapper.toResponse(user));
  }

  async deleteUserById(id: string, organizationId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id, organizationId } });
    if (!user) {
      throw new NotFoundException('Utilisateur introuvable');
    }
    await this.prisma.user.delete({ where: { id } });
  }

  /** Membre brut de l'organisation (null si introuvable ou hors organisation). */
  async findMemberById(id: string, organizationId: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, organizationId } });
  }

  async countActiveAdmins(organizationId: string): Promise<number> {
    return this.prisma.user.count({
      where: { organizationId, role: Role.ADMIN, status: 'ACTIVE' },
    });
  }

  async updateRole(id: string, role: Role): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  async findUserByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findRawById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  /** Met à jour le mot de passe (déjà hashé) d'un utilisateur. */
  async updatePassword(id: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { password: passwordHash },
    });
  }

  /** Active un compte : renseigne nom + mot de passe et passe le statut à ACTIVE. */
  async activateUser(id: string, data: { firstname: string; lastname: string; password: string }): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: {
        firstname: data.firstname,
        lastname: data.lastname,
        password: data.password,
        status: 'ACTIVE',
      },
    });
  }
}
