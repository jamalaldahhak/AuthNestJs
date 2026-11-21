
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { UserEntity } from './models/user.entity.js';
import { UserRoleEntity } from './models/user-role.entity.js';
import { UserRepository } from './repositories/user.repository.js';
import { UserService } from './services/user.service.js';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity, UserRoleEntity]),
  ],

  providers: [
    UserRepository,
    UserService,
  ],

  exports: [
    UserRepository,
    UserService,
  ],
})
export class UsersModule {}
