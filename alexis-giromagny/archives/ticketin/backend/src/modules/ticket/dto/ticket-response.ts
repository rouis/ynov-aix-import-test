import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority, Status } from '@prisma/client';

export class TicketResponseDto {
  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  id!: string;

  @ApiProperty({ example: 'org-uuid-here' })
  organizationId!: string;

  @ApiProperty({ example: 'Impossible de se connecter au VPN' })
  title!: string;

  @ApiProperty({ example: 'Depuis ce matin, je ne peux plus me connecter au VPN depuis mon poste Windows.' })
  description!: string;

  @ApiProperty({ enum: Status, example: Status.OPEN })
  status!: Status;

  @ApiProperty({ enum: Priority, example: Priority.HIGH })
  priority!: Priority;

  @ApiProperty({ example: 'Réseau' })
  category!: string;

  @ApiProperty({ example: 'user@client.com' })
  requester_email!: string;

  @ApiPropertyOptional({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', nullable: true })
  assigned_to_id!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: { id: 'uuid', firstname: 'Jane', lastname: 'Doe', email: 'jane@acme.com' },
  })
  assignee!: { id: string; firstname: string | null; lastname: string | null; email: string } | null;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  created_by_id!: string;

  @ApiProperty()
  created_at!: Date;

  @ApiProperty()
  updated_at!: Date;

  @ApiPropertyOptional()
  closed_at?: Date | null;

  @ApiProperty({
    isArray: true,
    example: [{ id: 'uuid', filename: 'capture.png', contentType: 'image/png', url: 'https://...' }],
  })
  attachments!: { id: string; filename: string; contentType: string; url: string }[];

  @ApiPropertyOptional({ nullable: true, example: 'Diagnostic : carte réseau HS, remplacement prévu.' })
  technician_note!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: { firstname: 'Bruno', lastname: 'Leclerc', email: 'bruno@msp.com' },
  })
  reporter!: { firstname: string | null; lastname: string | null; email: string } | null;
}
