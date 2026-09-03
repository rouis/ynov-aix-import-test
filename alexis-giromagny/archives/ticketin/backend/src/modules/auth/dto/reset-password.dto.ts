import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ example: 'a1b2c3...' })
  @IsNotEmpty()
  @IsString()
  token!: string;

  @ApiProperty({ example: 'MyNewPassword123', minLength: 8 })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
