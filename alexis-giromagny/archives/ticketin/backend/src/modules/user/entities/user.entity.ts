import { Role, UserStatus } from '@prisma/client';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUUID } from 'class-validator';

export class User {
  @IsUUID()
  id!: string;
  @IsNotEmpty()
  organizationId!: string;
  @IsEmail()
  @IsNotEmpty()
  email!: string;
  @IsOptional()
  firstname!: string | null;
  @IsOptional()
  lastname!: string | null;
  @IsOptional()
  password!: string | null;
  @IsEnum(Role)
  role!: Role;
  @IsEnum(UserStatus)
  status!: UserStatus;
}
