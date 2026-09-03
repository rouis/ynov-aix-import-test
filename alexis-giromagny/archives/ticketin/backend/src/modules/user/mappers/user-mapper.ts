import { User } from '../entities/user.entity';
import { UserResponseDto } from '../dto/user-response.dto';

export class UserMapper {
  static toResponse(user: User): UserResponseDto {
    return {
      id: user.id,
      organizationId: user.organizationId,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      role: user.role,
      status: user.status,
    };
  }
}
