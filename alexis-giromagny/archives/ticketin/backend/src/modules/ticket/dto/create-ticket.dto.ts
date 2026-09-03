import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, Status } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsEmail, IsUUID, IsOptional } from 'class-validator';

export class CreateTicketDto {
  @ApiProperty({ example: 'Impossible de se connecter au VPN' })
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'Depuis ce matin, je ne peux plus me connecter au VPN depuis mon poste Windows.' })
  @IsNotEmpty()
  description!: string;

  @ApiProperty({ enum: Status, example: Status.OPEN })
  @IsNotEmpty()
  @IsEnum(Status)
  status!: Status;

  @ApiPropertyOptional({
    enum: Priority,
    example: Priority.HIGH,
    description: 'Optionnel : déduite automatiquement si absente.',
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiProperty({ example: 'Réseau' })
  @IsNotEmpty()
  category!: string;

  @ApiProperty({ example: 'user@client.com' })
  @IsNotEmpty()
  @IsEmail()
  requester_email!: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  @IsOptional()
  @IsUUID()
  assigned_to_id?: string;
}
