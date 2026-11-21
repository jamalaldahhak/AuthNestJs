import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class MoveUserRoleToUserRoles1795280000000
  implements MigrationInterface
{
  name = 'MoveUserRoleToUserRoles1795280000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_roles'))) {
      await queryRunner.query(`
        CREATE TABLE user_roles (
          id int NOT NULL AUTO_INCREMENT,
          createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          userId int NOT NULL,
          roleId int NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY IDX_USER_ROLES_USER_ID (userId),
          KEY IDX_USER_ROLES_ROLE_ID (roleId),
          CONSTRAINT FK_USER_ROLES_USER
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT FK_USER_ROLES_ROLE
            FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE RESTRICT
        ) ENGINE=InnoDB
      `);
    }

    if (await queryRunner.hasColumn('users', 'roleId')) {
      await queryRunner.query(`
        INSERT IGNORE INTO user_roles (userId, roleId)
        SELECT id, roleId
        FROM users
      `);

      const usersTable = await queryRunner.getTable('users');
      const roleForeignKey = usersTable?.foreignKeys.find(
        (foreignKey) =>
          foreignKey.columnNames.includes('roleId') &&
          foreignKey.referencedTableName === 'roles',
      );
      if (roleForeignKey) {
        await queryRunner.dropForeignKey('users', roleForeignKey);
      }

      await queryRunner.dropColumn('users', 'roleId');
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasColumn('users', 'roleId'))) {
      await queryRunner.query(
        'ALTER TABLE users ADD COLUMN roleId int NULL',
      );
    }

    await queryRunner.query(`
      UPDATE users
      INNER JOIN user_roles ON user_roles.userId = users.id
      SET users.roleId = user_roles.roleId
    `);

    const [missingRoles] = await queryRunner.query(`
      SELECT COUNT(*) AS count
      FROM users
      WHERE roleId IS NULL
    `);
    if (Number(missingRoles.count) > 0) {
      throw new Error(
        'Cannot restore users.roleId while one or more users have no assigned role',
      );
    }

    await queryRunner.query(
      'ALTER TABLE users MODIFY roleId int NOT NULL',
    );
    await queryRunner.query(`
      ALTER TABLE users
      ADD CONSTRAINT FK_USERS_ROLE
      FOREIGN KEY (roleId) REFERENCES roles(id) ON DELETE RESTRICT
    `);

    if (await queryRunner.hasTable('user_roles')) {
      await queryRunner.dropTable('user_roles', true);
    }
  }
}
