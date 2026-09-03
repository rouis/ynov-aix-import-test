import { Priority, Status } from '@prisma/client';
import { IsEnum, IsNotEmpty, IsUUID, IsOptional } from 'class-validator';

export class Ticket {
  @IsUUID()
  id!: string;
  @IsNotEmpty()
  organizationId!: string;
  @IsNotEmpty()
  title!: string;
  @IsNotEmpty()
  description!: string;
  @IsNotEmpty()
  @IsEnum(Status)
  status!: Status;
  @IsNotEmpty()
  @IsEnum(Priority)
  priority!: Priority;
  @IsNotEmpty()
  category!: string;
  @IsNotEmpty()
  requester_email!: string;
  @IsOptional()
  @IsUUID()
  assigned_to_id?: string | null;
  @IsNotEmpty()
  created_by_id!: string;
  created_at!: Date;
  updated_at!: Date;
  closed_at?: Date | null;
}
