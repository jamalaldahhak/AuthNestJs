
import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { UserRepository } from '../repositories/user.repository.js';
import { UserEntity } from '../models/user.entity.js';

@Injectable()
export class UserService {

  constructor(
    private readonly userRepository: UserRepository,
  ) {}

  async findById(id: number): Promise<UserEntity> {
    const user = await this.userRepository.findById(id);

    if (!user) {
      throw new NotFoundException({
        errorCode: 'USER_NOT_FOUND',
        message: 'User not found',
      });
    }

    return user;
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email);
  }
}
