import { ApiProperty } from '@nestjs/swagger';
import { Role, UserStatus } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'org-uuid-here' })
  organizationId!: string;

  @ApiProperty({ example: 'john.doe@example.com' })
  email!: string;

  @ApiProperty({ example: 'John', nullable: true })
  firstname!: string | null;

  @ApiProperty({ example: 'Doe', nullable: true })
  lastname!: string | null;

  @ApiProperty({ enum: Role, example: Role.AGENT })
  role!: Role;

  @ApiProperty({ enum: UserStatus, example: UserStatus.PENDING })
  status!: UserStatus;
}
