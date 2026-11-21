import {
  MigrationInterface,
  QueryRunner,
} from 'typeorm';

export class AddUserPermissions1795275000000
  implements MigrationInterface
{
  name = 'AddUserPermissions1795275000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!(await queryRunner.hasTable('user_permissions'))) {
      await queryRunner.query(`
        CREATE TABLE user_permissions (
          userId int NOT NULL,
          permissionId int NOT NULL,
          PRIMARY KEY (userId, permissionId),
          KEY IDX_USER_PERMISSIONS_PERMISSION_ID (permissionId),
          CONSTRAINT FK_USER_PERMISSIONS_USER
            FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE,
          CONSTRAINT FK_USER_PERMISSIONS_PERMISSION
            FOREIGN KEY (permissionId) REFERENCES permissions(id) ON DELETE CASCADE
        ) ENGINE=InnoDB
      `);
    }

    await queryRunner.query(`
      INSERT IGNORE INTO user_permissions (userId, permissionId)
      SELECT users.id, role_permissions.permissionId
      FROM users
      INNER JOIN role_permissions ON role_permissions.roleId = users.roleId
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('user_permissions')) {
      await queryRunner.dropTable('user_permissions', true);
    }
  }
}
