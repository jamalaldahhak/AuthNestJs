import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddDynamicAuthorization1795263120000
  implements MigrationInterface
{
  name = 'AddDynamicAuthorization1795263120000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) {
      await queryRunner.query(`
        UPDATE users SET phone = NULL WHERE phone IS NOT NULL AND TRIM(phone) = ''
      `);
      const duplicatePhones = await queryRunner.query(`
        SELECT phone
        FROM users
        WHERE phone IS NOT NULL
        GROUP BY phone
        HAVING COUNT(*) > 1
        LIMIT 1
      `);
      if (duplicatePhones.length > 0) {
        throw new Error(
          'Cannot add unique phone numbers: resolve duplicate user phone values first',
        );
      }
    }

    await queryRunner.query(`
      CREATE TABLE roles (
        id int NOT NULL AUTO_INCREMENT,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        slug varchar(80) NOT NULL,
        name varchar(100) NOT NULL,
        description varchar(500) NULL,
        loginMethod enum('EMAIL', 'PHONE') NOT NULL DEFAULT 'EMAIL',
        selfRegistrationEnabled tinyint NOT NULL DEFAULT 0,
        isActive tinyint NOT NULL DEFAULT 1,
        isSystem tinyint NOT NULL DEFAULT 0,
        isSuperAdmin tinyint NOT NULL DEFAULT 0,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_ROLES_SLUG (slug)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE permissions (
        id int NOT NULL AUTO_INCREMENT,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`key\` varchar(120) NOT NULL,
        name varchar(120) NOT NULL,
        description varchar(500) NULL,
        isActive tinyint NOT NULL DEFAULT 1,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_PERMISSIONS_KEY (\`key\`)
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      CREATE TABLE role_permissions (
        roleId int NOT NULL,
        permissionId int NOT NULL,
        PRIMARY KEY (roleId, permissionId),
        KEY IDX_ROLE_PERMISSIONS_PERMISSION_ID (permissionId),
        CONSTRAINT FK_ROLE_PERMISSIONS_ROLE
          FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE CASCADE,
        CONSTRAINT FK_ROLE_PERMISSIONS_PERMISSION
          FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);

    await queryRunner.query(`
      INSERT INTO roles
        (slug, name, description, loginMethod, selfRegistrationEnabled, isActive, isSystem, isSuperAdmin)
      VALUES
        ('member', 'Member', 'Default least-privilege role for existing accounts', 'EMAIL', 0, 1, 0, 0)
    `);

    if (!(await queryRunner.hasTable('users'))) {
      await queryRunner.query(`
        CREATE TABLE users (
          id int NOT NULL AUTO_INCREMENT,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          firstName varchar(100) NOT NULL,
          lastName varchar(100) NOT NULL,
          email varchar(190) NULL,
          passwordHash varchar(255) NOT NULL,
          phone varchar(30) NULL,
          status enum('ACTIVE', 'SUSPENDED', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
          roleId int NOT NULL,
          lastLoginAt datetime NULL,
          PRIMARY KEY (id),
          UNIQUE KEY IDX_USERS_EMAIL (email),
          UNIQUE KEY IDX_USERS_PHONE (phone),
          CONSTRAINT FK_USERS_ROLE
            FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB
      `);
    } else {
      await queryRunner.query(
        'ALTER TABLE users ADD COLUMN roleId int NULL',
      );
      await queryRunner.query(`
        UPDATE users
        SET roleId = (SELECT id FROM roles WHERE slug = 'member')
        WHERE roleId IS NULL
      `);
      await queryRunner.query(
        'ALTER TABLE users MODIFY roleId int NOT NULL',
      );
      await queryRunner.query(`
        ALTER TABLE users
        ADD CONSTRAINT FK_USERS_ROLE
        FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE RESTRICT
      `);
      await queryRunner.query(`
        UPDATE users SET status = 'ACTIVE' WHERE status = 'PENDING'
      `);
      await queryRunner.query(`
        ALTER TABLE users
        MODIFY status enum('ACTIVE', 'SUSPENDED', 'BLOCKED') NOT NULL DEFAULT 'ACTIVE',
        MODIFY email varchar(190) NULL
      `);
    }

    if (!(await queryRunner.hasTable('auth_sessions'))) {
      await queryRunner.query(`
        CREATE TABLE auth_sessions (
          id int NOT NULL AUTO_INCREMENT,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          sessionId varchar(36) NOT NULL,
          userId int NOT NULL,
          refreshTokenHash varchar(255) NOT NULL,
          status enum('ACTIVE', 'REVOKED', 'EXPIRED') NOT NULL DEFAULT 'ACTIVE',
          expiresAt datetime NOT NULL,
          revokedAt datetime NULL,
          lastUsedAt datetime NULL,
          ipAddress varchar(45) NULL,
          userAgent varchar(500) NULL,
          replacedBySessionId varchar(36) NULL,
          PRIMARY KEY (id),
          UNIQUE KEY IDX_AUTH_SESSIONS_SESSION_ID (sessionId),
          KEY IDX_AUTH_SESSIONS_USER_ID (userId),
          KEY IDX_AUTH_SESSIONS_STATUS (status),
          CONSTRAINT FK_AUTH_SESSIONS_USER
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }

    if (await queryRunner.hasColumn('users', 'emailVerifiedAt')) {
      await queryRunner.query(
        'ALTER TABLE users DROP COLUMN emailVerifiedAt',
      );
    }
    const usersTable = await queryRunner.getTable('users');
    if (
      usersTable?.indices.some(
        (index) => index.name === 'IDX_USERS_PHONE',
      )
    ) {
      await queryRunner.dropIndex('users', 'IDX_USERS_PHONE');
    }
    await queryRunner.query(`
      CREATE UNIQUE INDEX IDX_USERS_PHONE ON users (phone)
    `);
    if (await queryRunner.hasTable('email_verifications')) {
      await queryRunner.dropTable('email_verifications', true);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const [emailCount] = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE email IS NULL
    `);
    if (Number(emailCount.count) > 0) {
      throw new Error(
        'Cannot roll back while phone-only users exist; assign an email to each user first',
      );
    }

    if (await queryRunner.hasTable('email_verifications')) {
      await queryRunner.dropTable('email_verifications', true);
    }
    await queryRunner.query(`
      ALTER TABLE users
      DROP FOREIGN KEY FK_USERS_ROLE,
      DROP INDEX IDX_USERS_PHONE,
      DROP COLUMN roleId,
      MODIFY email varchar(190) NOT NULL,
      MODIFY status enum('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED') NOT NULL DEFAULT 'PENDING',
      ADD COLUMN emailVerifiedAt datetime NULL
    `);
    await queryRunner.query(`
      CREATE TABLE email_verifications (
        id int NOT NULL AUTO_INCREMENT,
        createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        userId int NOT NULL,
        tokenHash varchar(64) NOT NULL,
        expiresAt datetime NOT NULL,
        usedAt datetime NULL,
        PRIMARY KEY (id),
        UNIQUE KEY IDX_EMAIL_VERIFICATION_TOKEN_HASH (tokenHash),
        KEY IDX_EMAIL_VERIFICATION_USER_ID (userId),
        KEY IDX_EMAIL_VERIFICATION_EXPIRES_AT (expiresAt),
        CONSTRAINT FK_EMAIL_VERIFICATIONS_USER
          FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB
    `);
    await queryRunner.dropTable('role_permissions', true);
    await queryRunner.dropTable('permissions', true);
    await queryRunner.dropTable('roles', true);
  }
}
