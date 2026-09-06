interface RoleSafety {
  superuser: boolean;
  bypassRls: boolean;
  ownsTables: boolean;
  canAssumePrivilegedRole: boolean;
  canCreateRoles: boolean;
}

interface RoleInspector {
  query(sql: string): Promise<{ rows: RoleSafety[] }>;
}

// MEMBER includes inherited and SET ROLE membership. Inspect login and active roles because
// connection options can SET ROLE while retaining a privileged session identity.
const ROLE_SAFETY_SQL = `
  WITH accessible_roles AS (
    SELECT oid, rolsuper, rolbypassrls, rolcreaterole
    FROM pg_roles
    WHERE pg_has_role(current_user, oid, 'MEMBER') OR pg_has_role(session_user, oid, 'MEMBER')
  )
  SELECT
    current_role.rolsuper AS "superuser",
    current_role.rolbypassrls AS "bypassRls",
    current_role.rolcreaterole AS "canCreateRoles",
    EXISTS (SELECT 1 FROM accessible_roles WHERE rolsuper OR rolbypassrls OR rolcreaterole) AS "canAssumePrivilegedRole",
    (
      EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'v', 'm', 'f')
          AND n.nspname NOT IN ('pg_catalog', 'information_schema')
          AND n.nspname NOT LIKE 'pg_toast%' AND n.nspname NOT LIKE 'pg_temp%'
          AND c.relowner IN (SELECT oid FROM accessible_roles)
      ) OR EXISTS (
        SELECT 1 FROM pg_namespace WHERE nspname NOT IN ('pg_catalog', 'information_schema')
          AND nspname NOT LIKE 'pg_%' AND nspowner IN (SELECT oid FROM accessible_roles)
      ) OR EXISTS (
        SELECT 1 FROM pg_database WHERE datname = current_database() AND datdba IN (SELECT oid FROM accessible_roles)
      )
    ) AS "ownsTables"
  FROM pg_roles current_role WHERE current_role.rolname = current_user
`;

/** Only production connects during boot inspection. Unit tests inject a query stub. */
export async function assertRuntimeDatabaseRole(pool: RoleInspector, nodeEnv: string): Promise<void> {
  if (nodeEnv !== "production") return;
  let rows: RoleSafety[];
  try {
    ({ rows } = await pool.query(ROLE_SAFETY_SQL));
  } catch {
    // Connection/provider errors may contain the connection URL, SQL and credentials.
    throw new Error("Runtime database role safety check failed.");
  }
  const role = rows[0];
  if (rows.length !== 1 || !role || role.superuser !== false || role.bypassRls !== false ||
    role.ownsTables !== false || role.canAssumePrivilegedRole !== false || role.canCreateRoles !== false) {
    throw new Error("Unsafe runtime database role: use a non-owner role without superuser, BYPASSRLS, CREATEROLE or privileged memberships.");
  }
}
