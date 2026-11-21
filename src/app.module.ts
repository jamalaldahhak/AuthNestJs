
import { Module } from '@nestjs/common';
import {
  APP_FILTER,
  APP_GUARD,
  APP_INTERCEPTOR,
} from '@nestjs/core';

import {
  ConfigModule,
  ConfigService,
} from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';

import { ResponseInterceptor } from './common/interceptors/response.interceptor.js';
import { HttpExceptionFilter } from './common/filters/http-exception.filter.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { AuthorizationModule } from './modules/authorization/authorization.module.js';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AddDynamicAuthorization1795263120000 } from './database/migrations/1795263120000-AddDynamicAuthorization.js';
import { AddUserPermissions1795275000000 } from './database/migrations/1795275000000-AddUserPermissions.js';
import { MoveUserRoleToUserRoles1795280000000 } from './database/migrations/1795280000000-MoveUserRoleToUserRoles.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),

    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),

    TypeOrmModule.forRootAsync({
      inject: [ConfigService],

      useFactory: (config: ConfigService) => ({
        type: 'mysql',

        host: config.get<string>('DB_HOST'),
        port: config.get<number>('DB_PORT', 3306),
        username: config.get<string>('DB_USERNAME'),
        password: config.get<string>('DB_PASSWORD'),
        database: config.get<string>('DB_DATABASE'),

        autoLoadEntities: true,

        synchronize: false,

        migrations: [
          AddDynamicAuthorization1795263120000,
          AddUserPermissions1795275000000,
          MoveUserRoleToUserRoles1795280000000,
        ],
        migrationsRun:
          config.get<string>('APP_ENV') === 'development',
      }),
    }),

    AuthModule,

    UsersModule,

    AuthorizationModule,
  ],

  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ResponseInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
