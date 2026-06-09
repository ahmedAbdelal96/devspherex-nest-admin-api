import { Injectable, ConflictException } from '@nestjs/common';
import { UsersRepository } from '../repositories/users.repository';
import { PasswordService } from '../../auth/services/password.service';
import { CreateUserDto, CreateUserResponseDto } from '../dto/create-user.dto';

@Injectable()
export class CreateUserUseCase {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async execute(dto: CreateUserDto): Promise<CreateUserResponseDto> {
    const existingUser = await this.usersRepository.findByEmail(dto.email);

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const passwordHash = await this.passwordService.hashPassword(dto.password);

    const user = await this.usersRepository.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      roleId: dto.roleId,
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      status: user.status,
      role: user.role
        ? { id: user.role.id, name: user.role.name }
        : null,
      createdAt: user.createdAt,
    };
  }
}
