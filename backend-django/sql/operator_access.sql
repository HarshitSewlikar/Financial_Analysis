-- Operator layer for permission changes in MySQL Workbench.
--
-- This script does not replace Django authorization. policy.py remains the
-- check the website uses. These objects only read and write the existing
-- RBAC tables, using the same precedence as
-- access_control/policy.py get_effective_permissions:
--
--   1. An inactive user, or a user with deleted_at set, has no permissions.
--      This includes the protected administrator.
--   2. An active protected administrator is allowed every code registered in
--      access_control/catalog.py. Role rows and overrides are ignored.
--   3. Otherwise start from active role grants (active role, role not
--      soft-deleted, user-role not expired, permission row active, code
--      registered).
--   4. A DENY override removes that code, including when a role granted it.
--   5. An ALLOW override adds that code, including when no role granted it.
--   6. One user can have only one override per permission, so DENY and ALLOW
--      cannot both be stored. The view still tests DENY first.
--   7. A permission row whose code is not in the catalog is ignored, matching
--      is_registered().
--
-- Review this file before running it. Running the whole file creates the
-- views and procedures only. It does not change user, role, or permission
-- rows. The CALL examples at the bottom are comments.
--
-- Run it while connected to the application database:
--   financial_dashboard
--
-- The MySQL account needs CREATE ROUTINE and CREATE VIEW on that database.
-- Procedures are SQL SECURITY INVOKER, so the caller also needs INSERT,
-- UPDATE, and DELETE on the existing RBAC and audit tables.
--
-- If catalog.py gains or loses a permission code, update
-- v_registered_permission in this file to match. The website will not honor
-- a code that is only added here.

USE financial_dashboard;

DROP VIEW IF EXISTS v_user_access;
DROP VIEW IF EXISTS v_registered_permission;

CREATE SQL SECURITY INVOKER VIEW v_registered_permission AS
SELECT 'users.read' AS permission_code
UNION ALL SELECT 'users.create'
UNION ALL SELECT 'users.update'
UNION ALL SELECT 'users.deactivate'
UNION ALL SELECT 'roles.read'
UNION ALL SELECT 'roles.manage'
UNION ALL SELECT 'roles.assign'
UNION ALL SELECT 'permissions.read'
UNION ALL SELECT 'permissions.manage'
UNION ALL SELECT 'permissions.assign'
UNION ALL SELECT 'menus.read'
UNION ALL SELECT 'menus.manage'
UNION ALL SELECT 'menus.assign'
UNION ALL SELECT 'todos.read'
UNION ALL SELECT 'todos.create'
UNION ALL SELECT 'todos.update'
UNION ALL SELECT 'todos.delete'
UNION ALL SELECT 'todos.assign'
UNION ALL SELECT 'todos.manage'
UNION ALL SELECT 'audit.read'
UNION ALL SELECT 'audit.export'
UNION ALL SELECT 'market.read';

CREATE SQL SECURITY INVOKER VIEW v_user_access AS
WITH role_grants AS (
    SELECT DISTINCT
        user_role.user_id,
        permission.code AS permission_code
    FROM access_control_userrole AS user_role
    INNER JOIN access_control_role AS role
        ON role.id = user_role.role_id
    INNER JOIN access_control_rolepermission AS role_permission
        ON role_permission.role_id = role.id
    INNER JOIN access_control_permission AS permission
        ON permission.id = role_permission.permission_id
    INNER JOIN v_registered_permission AS registered
        ON registered.permission_code = permission.code
    WHERE permission.is_active = 1
      AND role.is_active = 1
      AND role.deleted_at IS NULL
      AND (user_role.expires_at IS NULL OR user_role.expires_at > UTC_TIMESTAMP())
),
overrides AS (
    SELECT
        override_row.user_id,
        permission.code AS permission_code,
        override_row.effect
    FROM access_control_userpermissionoverride AS override_row
    INNER JOIN access_control_permission AS permission
        ON permission.id = override_row.permission_id
    INNER JOIN v_registered_permission AS registered
        ON registered.permission_code = permission.code
    WHERE permission.is_active = 1
)
SELECT
    account.username,
    registered.permission_code,
    CASE
        WHEN account.is_active <> 1 OR account.deleted_at IS NOT NULL THEN 0
        WHEN account.is_protected_admin = 1 THEN 1
        WHEN permission_override.effect = 'DENY' THEN 0
        WHEN permission_override.effect = 'ALLOW' THEN 1
        WHEN role_grant.user_id IS NOT NULL THEN 1
        ELSE 0
    END AS allowed,
    CASE
        WHEN account.is_active <> 1 OR account.deleted_at IS NOT NULL THEN 'inactive'
        WHEN account.is_protected_admin = 1 THEN 'protected administrator'
        WHEN permission_override.effect = 'DENY' THEN 'deny override'
        WHEN permission_override.effect = 'ALLOW' THEN 'allow override'
        WHEN role_grant.user_id IS NOT NULL THEN 'role'
        ELSE 'none'
    END AS comes_from
FROM accounts_user AS account
CROSS JOIN v_registered_permission AS registered
LEFT JOIN role_grants AS role_grant
    ON role_grant.user_id = account.id
   AND role_grant.permission_code = registered.permission_code
LEFT JOIN overrides AS permission_override
    ON permission_override.user_id = account.id
   AND permission_override.permission_code = registered.permission_code;

DROP PROCEDURE IF EXISTS apply_permission_override;
DROP PROCEDURE IF EXISTS set_user_permission;
DROP PROCEDURE IF EXISTS set_todo_permissions;
DROP PROCEDURE IF EXISTS assign_role;
DROP PROCEDURE IF EXISTS remove_role;

DELIMITER $$

-- Internal writer. Does not validate, audit, or commit.
-- set_user_permission and set_todo_permissions call it inside their transaction.
CREATE PROCEDURE apply_permission_override(
    IN p_user_id BIGINT,
    IN p_permission_id BIGINT,
    IN p_allowed TINYINT
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_effect VARCHAR(5);

    IF p_allowed = 1 THEN
        SET v_effect = 'ALLOW';
    ELSE
        SET v_effect = 'DENY';
    END IF;

    INSERT INTO access_control_userpermissionoverride (
        user_id,
        permission_id,
        effect,
        granted_by_id,
        reason,
        created_at,
        updated_at
    )
    VALUES (
        p_user_id,
        p_permission_id,
        v_effect,
        NULL,
        'operator sql',
        UTC_TIMESTAMP(),
        UTC_TIMESTAMP()
    ) AS new_row
    ON DUPLICATE KEY UPDATE
        effect = new_row.effect,
        granted_by_id = NULL,
        reason = new_row.reason,
        updated_at = UTC_TIMESTAMP();
END$$

CREATE PROCEDURE set_user_permission(
    IN p_username VARCHAR(150),
    IN p_permission_code VARCHAR(150),
    IN p_allowed TINYINT
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_username VARCHAR(150);
    DECLARE v_code VARCHAR(150);
    DECLARE v_user_id BIGINT;
    DECLARE v_protected TINYINT;
    DECLARE v_active TINYINT;
    DECLARE v_deleted_at DATETIME(6);
    DECLARE v_permission_id BIGINT;
    DECLARE v_before_effect VARCHAR(5);
    DECLARE v_after_effect VARCHAR(5);

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_username = LOWER(TRIM(p_username));
    SET v_code = LOWER(TRIM(p_permission_code));

    IF v_username IS NULL OR CHAR_LENGTH(v_username) < 3 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Username is required.';
    END IF;

    IF v_code IS NULL OR CHAR_LENGTH(v_code) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Permission code is required.';
    END IF;

    IF p_allowed IS NULL OR p_allowed NOT IN (0, 1) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Allowed must be 0 or 1.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM v_registered_permission
        WHERE permission_code = v_code
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Permission code is not registered.';
    END IF;

    -- Scalar subqueries return NULL when nothing matches. SELECT INTO would
    -- raise "no data" and hide the validation message below.
    SET v_user_id = (SELECT id FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_protected = (SELECT is_protected_admin FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_active = (SELECT is_active FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_deleted_at = (SELECT deleted_at FROM accounts_user WHERE username = v_username LIMIT 1);

    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User does not exist.';
    END IF;

    IF v_deleted_at IS NOT NULL OR v_active <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User is inactive or deleted.';
    END IF;

    IF v_protected = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Protected administrator permissions cannot be changed.';
    END IF;

    SET v_permission_id = (
        SELECT id
        FROM access_control_permission
        WHERE code = v_code
          AND is_active = 1
        LIMIT 1
    );

    IF v_permission_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Permission row is missing or inactive.';
    END IF;

    START TRANSACTION;

    SET v_before_effect = (
        SELECT effect
        FROM access_control_userpermissionoverride
        WHERE user_id = v_user_id
          AND permission_id = v_permission_id
        LIMIT 1
    );

    CALL apply_permission_override(v_user_id, v_permission_id, p_allowed);

    SET v_after_effect = IF(p_allowed = 1, 'ALLOW', 'DENY');

    INSERT INTO audit_auditlog (
        actor_id,
        action,
        resource_type,
        object_id,
        `before`,
        `after`,
        correlation_id,
        ip_address,
        user_agent,
        created_at
    )
    VALUES (
        NULL,
        'user_overrides_updated',
        'User',
        CAST(v_user_id AS CHAR),
        JSON_OBJECT('permission_code', v_code, 'effect', v_before_effect),
        JSON_OBJECT(
            'permission_code', v_code,
            'effect', v_after_effect,
            'source', 'operator_sql'
        ),
        '',
        NULL,
        'mysql-operator-script',
        UTC_TIMESTAMP(6)
    );

    COMMIT;
END$$

CREATE PROCEDURE set_todo_permissions(
    IN p_username VARCHAR(150),
    IN p_can_read TINYINT,
    IN p_can_create TINYINT,
    IN p_can_update TINYINT,
    IN p_can_delete TINYINT,
    IN p_can_assign TINYINT,
    IN p_can_manage TINYINT
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_username VARCHAR(150);
    DECLARE v_user_id BIGINT;
    DECLARE v_protected TINYINT;
    DECLARE v_active TINYINT;
    DECLARE v_deleted_at DATETIME(6);
    DECLARE v_read_id BIGINT;
    DECLARE v_create_id BIGINT;
    DECLARE v_update_id BIGINT;
    DECLARE v_delete_id BIGINT;
    DECLARE v_assign_id BIGINT;
    DECLARE v_manage_id BIGINT;
    DECLARE v_before JSON;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_username = LOWER(TRIM(p_username));

    IF v_username IS NULL OR CHAR_LENGTH(v_username) < 3 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Username is required.';
    END IF;

    IF p_can_read IS NULL OR p_can_read NOT IN (0, 1)
        OR p_can_create IS NULL OR p_can_create NOT IN (0, 1)
        OR p_can_update IS NULL OR p_can_update NOT IN (0, 1)
        OR p_can_delete IS NULL OR p_can_delete NOT IN (0, 1)
        OR p_can_assign IS NULL OR p_can_assign NOT IN (0, 1)
        OR p_can_manage IS NULL OR p_can_manage NOT IN (0, 1) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Each to-do flag must be 0 or 1.';
    END IF;

    SET v_user_id = (SELECT id FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_protected = (SELECT is_protected_admin FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_active = (SELECT is_active FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_deleted_at = (SELECT deleted_at FROM accounts_user WHERE username = v_username LIMIT 1);

    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User does not exist.';
    END IF;

    IF v_deleted_at IS NOT NULL OR v_active <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User is inactive or deleted.';
    END IF;

    IF v_protected = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Protected administrator permissions cannot be changed.';
    END IF;

    SELECT MAX(CASE WHEN code = 'todos.read' THEN id END),
           MAX(CASE WHEN code = 'todos.create' THEN id END),
           MAX(CASE WHEN code = 'todos.update' THEN id END),
           MAX(CASE WHEN code = 'todos.delete' THEN id END),
           MAX(CASE WHEN code = 'todos.assign' THEN id END),
           MAX(CASE WHEN code = 'todos.manage' THEN id END)
      INTO v_read_id, v_create_id, v_update_id, v_delete_id, v_assign_id, v_manage_id
      FROM access_control_permission
     WHERE is_active = 1
       AND code IN (
           'todos.read',
           'todos.create',
           'todos.update',
           'todos.delete',
           'todos.assign',
           'todos.manage'
       );

    IF v_read_id IS NULL OR v_create_id IS NULL OR v_update_id IS NULL
        OR v_delete_id IS NULL OR v_assign_id IS NULL OR v_manage_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'One or more to-do permission rows are missing.';
    END IF;

    START TRANSACTION;

    SET v_before = (
        SELECT JSON_ARRAYAGG(
            JSON_OBJECT('permission_code', permission.code, 'effect', override_row.effect)
            ORDER BY permission.code
        )
        FROM access_control_userpermissionoverride AS override_row
        INNER JOIN access_control_permission AS permission
            ON permission.id = override_row.permission_id
        WHERE override_row.user_id = v_user_id
          AND permission.code IN (
              'todos.read',
              'todos.create',
              'todos.update',
              'todos.delete',
              'todos.assign',
              'todos.manage'
          )
    );

    CALL apply_permission_override(v_user_id, v_read_id, p_can_read);
    CALL apply_permission_override(v_user_id, v_create_id, p_can_create);
    CALL apply_permission_override(v_user_id, v_update_id, p_can_update);
    CALL apply_permission_override(v_user_id, v_delete_id, p_can_delete);
    CALL apply_permission_override(v_user_id, v_assign_id, p_can_assign);
    CALL apply_permission_override(v_user_id, v_manage_id, p_can_manage);

    INSERT INTO audit_auditlog (
        actor_id,
        action,
        resource_type,
        object_id,
        `before`,
        `after`,
        correlation_id,
        ip_address,
        user_agent,
        created_at
    )
    VALUES (
        NULL,
        'user_overrides_updated',
        'User',
        CAST(v_user_id AS CHAR),
        v_before,
        JSON_OBJECT(
            'source', 'operator_sql',
            'overrides', JSON_ARRAY(
                JSON_OBJECT('permission_code', 'todos.read', 'effect', IF(p_can_read = 1, 'ALLOW', 'DENY')),
                JSON_OBJECT('permission_code', 'todos.create', 'effect', IF(p_can_create = 1, 'ALLOW', 'DENY')),
                JSON_OBJECT('permission_code', 'todos.update', 'effect', IF(p_can_update = 1, 'ALLOW', 'DENY')),
                JSON_OBJECT('permission_code', 'todos.delete', 'effect', IF(p_can_delete = 1, 'ALLOW', 'DENY')),
                JSON_OBJECT('permission_code', 'todos.assign', 'effect', IF(p_can_assign = 1, 'ALLOW', 'DENY')),
                JSON_OBJECT('permission_code', 'todos.manage', 'effect', IF(p_can_manage = 1, 'ALLOW', 'DENY'))
            )
        ),
        '',
        NULL,
        'mysql-operator-script',
        UTC_TIMESTAMP(6)
    );

    COMMIT;
END$$

CREATE PROCEDURE assign_role(
    IN p_username VARCHAR(150),
    IN p_role_code VARCHAR(100)
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_username VARCHAR(150);
    DECLARE v_role_code VARCHAR(100);
    DECLARE v_user_id BIGINT;
    DECLARE v_protected TINYINT;
    DECLARE v_active TINYINT;
    DECLARE v_deleted_at DATETIME(6);
    DECLARE v_role_id BIGINT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_username = LOWER(TRIM(p_username));
    SET v_role_code = LOWER(TRIM(p_role_code));

    IF v_username IS NULL OR CHAR_LENGTH(v_username) < 3 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Username is required.';
    END IF;

    IF v_role_code IS NULL OR CHAR_LENGTH(v_role_code) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role code is required.';
    END IF;

    SET v_user_id = (SELECT id FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_protected = (SELECT is_protected_admin FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_active = (SELECT is_active FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_deleted_at = (SELECT deleted_at FROM accounts_user WHERE username = v_username LIMIT 1);

    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User does not exist.';
    END IF;

    IF v_deleted_at IS NOT NULL OR v_active <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User is inactive or deleted.';
    END IF;

    IF v_protected = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Protected administrator roles cannot be changed.';
    END IF;

    SET v_role_id = (
        SELECT id
        FROM access_control_role
        WHERE code = v_role_code
          AND is_active = 1
          AND deleted_at IS NULL
        LIMIT 1
    );

    IF v_role_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role does not exist or is inactive.';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM access_control_userrole
        WHERE user_id = v_user_id
          AND role_id = v_role_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role is already assigned to this user.';
    END IF;

    START TRANSACTION;

    INSERT INTO access_control_userrole (
        user_id,
        role_id,
        assigned_by_id,
        assigned_at,
        expires_at
    )
    VALUES (
        v_user_id,
        v_role_id,
        NULL,
        UTC_TIMESTAMP(),
        NULL
    );

    INSERT INTO audit_auditlog (
        actor_id,
        action,
        resource_type,
        object_id,
        `before`,
        `after`,
        correlation_id,
        ip_address,
        user_agent,
        created_at
    )
    VALUES (
        NULL,
        'user_roles_updated',
        'User',
        CAST(v_user_id AS CHAR),
        NULL,
        JSON_OBJECT(
            'source', 'operator_sql',
            'change', 'assigned',
            'role_code', v_role_code,
            'role_id', v_role_id
        ),
        '',
        NULL,
        'mysql-operator-script',
        UTC_TIMESTAMP(6)
    );

    COMMIT;
END$$

CREATE PROCEDURE remove_role(
    IN p_username VARCHAR(150),
    IN p_role_code VARCHAR(100)
)
SQL SECURITY INVOKER
BEGIN
    DECLARE v_username VARCHAR(150);
    DECLARE v_role_code VARCHAR(100);
    DECLARE v_user_id BIGINT;
    DECLARE v_protected TINYINT;
    DECLARE v_active TINYINT;
    DECLARE v_deleted_at DATETIME(6);
    DECLARE v_role_id BIGINT;
    DECLARE v_admin_holders INT;

    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    SET v_username = LOWER(TRIM(p_username));
    SET v_role_code = LOWER(TRIM(p_role_code));

    IF v_username IS NULL OR CHAR_LENGTH(v_username) < 3 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Username is required.';
    END IF;

    IF v_role_code IS NULL OR CHAR_LENGTH(v_role_code) = 0 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role code is required.';
    END IF;

    SET v_user_id = (SELECT id FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_protected = (SELECT is_protected_admin FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_active = (SELECT is_active FROM accounts_user WHERE username = v_username LIMIT 1);
    SET v_deleted_at = (SELECT deleted_at FROM accounts_user WHERE username = v_username LIMIT 1);

    IF v_user_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User does not exist.';
    END IF;

    IF v_deleted_at IS NOT NULL OR v_active <> 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'User is inactive or deleted.';
    END IF;

    IF v_protected = 1 THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Protected administrator roles cannot be changed.';
    END IF;

    SET v_role_id = (
        SELECT id
        FROM access_control_role
        WHERE code = v_role_code
          AND deleted_at IS NULL
        LIMIT 1
    );

    IF v_role_id IS NULL THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role does not exist.';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM access_control_userrole
        WHERE user_id = v_user_id
          AND role_id = v_role_id
    ) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Role is not assigned to this user.';
    END IF;

    IF v_role_code = 'administrator' THEN
        SELECT COUNT(DISTINCT account.id)
          INTO v_admin_holders
          FROM accounts_user AS account
          INNER JOIN access_control_userrole AS user_role
              ON user_role.user_id = account.id
          INNER JOIN access_control_role AS role
              ON role.id = user_role.role_id
         WHERE account.is_active = 1
           AND account.deleted_at IS NULL
           AND role.code = 'administrator'
           AND role.is_active = 1;

        IF v_admin_holders <= 1 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'Cannot remove the final administrator role.';
        END IF;
    END IF;

    START TRANSACTION;

    DELETE FROM access_control_userrole
    WHERE user_id = v_user_id
      AND role_id = v_role_id;

    INSERT INTO audit_auditlog (
        actor_id,
        action,
        resource_type,
        object_id,
        `before`,
        `after`,
        correlation_id,
        ip_address,
        user_agent,
        created_at
    )
    VALUES (
        NULL,
        'user_roles_updated',
        'User',
        CAST(v_user_id AS CHAR),
        JSON_OBJECT('role_code', v_role_code, 'role_id', v_role_id),
        JSON_OBJECT(
            'source', 'operator_sql',
            'change', 'removed',
            'role_code', v_role_code,
            'role_id', v_role_id
        ),
        '',
        NULL,
        'mysql-operator-script',
        UTC_TIMESTAMP(6)
    );

    COMMIT;
END$$

DELIMITER ;

-- ---------------------------------------------------------------------------
-- Review queries. Do not treat a commented CALL as already applied.
-- After you install the script, run the SELECT. It changes nothing.
-- Uncomment a CALL only when you intend to change that user.
-- ---------------------------------------------------------------------------

-- Active protected administrator: every registered to-do code is allowed,
-- and comes_from is "protected administrator". Overrides are ignored.
SELECT username, permission_code, allowed, comes_from
FROM v_user_access
WHERE username = 'harshit'
  AND permission_code LIKE 'todos.%'
ORDER BY permission_code;

-- Replace alex with a real standard user before uncommenting.
-- Flags are read, create, update, delete, assign, manage-all.
-- This example allows the first four to-do actions except delete and manage.
-- CALL set_todo_permissions('alex', 1, 1, 1, 0, 1, 0);
-- SELECT username, permission_code, allowed, comes_from
-- FROM v_user_access
-- WHERE username = 'alex' AND permission_code LIKE 'todos.%'
-- ORDER BY permission_code;

-- CALL set_user_permission('alex', 'todos.delete', 0);
-- CALL assign_role('alex', 'standard_user');
-- CALL remove_role('alex', 'standard_user');

-- These must fail and leave the database unchanged:
-- CALL set_user_permission('harshit', 'todos.delete', 0);
-- CALL set_user_permission('alex', 'todos.invented', 1);
-- CALL assign_role('alex', 'not_a_role');
-- CALL set_todo_permissions('alex', 1, 1, 1, 1, 1, 2);
