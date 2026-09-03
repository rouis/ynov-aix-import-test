import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty } from 'class-validator';

// L'invitation crée toujours un AGENT : le rôle n'est plus un choix du client.
// La promotion en ADMIN passe par PATCH /user/:id/role.
export class CreateUserDto {
  @ApiProperty({ example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email!: string;
}
