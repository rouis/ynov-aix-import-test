import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsIn } from 'class-validator';

// Seuls les rôles d'équipe sont attribuables : CLIENT est un rôle interne
// réservé aux demandeurs créés par l'ingestion email.
export class UpdateUserRoleDto {
  @ApiProperty({ enum: [Role.ADMIN, Role.AGENT], example: Role.ADMIN })
  @IsIn([Role.ADMIN, Role.AGENT])
  role!: Role;
}
