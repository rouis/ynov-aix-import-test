import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ActivateDto {
  @ApiProperty({ example: 'a1b2c3...' })
  @IsNotEmpty()
  @IsString()
  token!: string;

  @ApiProperty({ example: 'John' })
  @IsNotEmpty()
  @IsString()
  firstname!: string;

  @ApiProperty({ example: 'Doe' })
  @IsNotEmpty()
  @IsString()
  lastname!: string;

  @ApiProperty({ example: 'MyPassword123', minLength: 8 })
  @IsNotEmpty()
  @MinLength(8)
  password!: string;
}
