import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { UserService } from './user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from 'src/common/types/auth-user.type';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
@Controller('user')
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Post()
  @ApiOperation({ summary: "Inviter un agent et envoyer le lien d'activation" })
  @ApiResponse({ status: 201, description: 'Membre créé (PENDING)', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Données invalides' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé aux administrateurs' })
  @ApiResponse({ status: 409, description: 'Email déjà utilisé' })
  async createUser(@Body() createUserDto: CreateUserDto, @CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.userService.createUser(createUserDto, user.organizationId);
  }

  @Get(':id')
  @ApiOperation({ summary: "Récupérer un membre de l'organisation par ID" })
  @ApiResponse({ status: 200, description: 'Membre trouvé', type: UserResponseDto })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async findUserById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<UserResponseDto> {
    return this.userService.findUserById(id, user.organizationId);
  }

  @Get()
  @ApiOperation({ summary: "Lister les membres de l'organisation" })
  @ApiResponse({ status: 200, description: 'Liste des membres', type: [UserResponseDto] })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé aux administrateurs' })
  async getAllUser(@CurrentUser() user: AuthUser): Promise<UserResponseDto[]> {
    return this.userService.getAllUsers(user.organizationId);
  }

  @Patch(':id/role')
  @ApiOperation({ summary: "Changer le rôle d'un membre (ADMIN ou AGENT)" })
  @ApiResponse({ status: 200, description: 'Rôle mis à jour', type: UserResponseDto })
  @ApiResponse({ status: 400, description: 'Cible invalide ou dernier administrateur' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async updateUserRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthUser,
  ): Promise<UserResponseDto> {
    return this.userService.updateUserRole(id, dto.role, user.organizationId);
  }

  @Post(':id/resend-invitation')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Renvoyer l'email d'activation d'un membre en attente" })
  @ApiResponse({ status: 204, description: 'Invitation renvoyée' })
  @ApiResponse({ status: 400, description: 'Membre déjà actif' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async resendInvitation(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser): Promise<void> {
    return this.userService.resendInvitation(id, user.organizationId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Supprimer un membre de l'organisation" })
  @ApiResponse({ status: 204, description: 'Membre supprimé' })
  @ApiResponse({ status: 401, description: 'Non authentifié' })
  @ApiResponse({ status: 403, description: 'Réservé aux administrateurs' })
  @ApiResponse({ status: 404, description: 'Membre introuvable' })
  async deleteUserById(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: AuthUser) {
    return this.userService.deleteUserById(id, user.organizationId);
  }
}
