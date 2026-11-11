
import "dotenv/config";
import bcrypt from "bcryptjs";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/db.js";

/*
  BUILDORA - LABOR PRODUCTIVITY ACCOUNT SEEDER

  Roles:
  1. Productivity Manager
  2. Site Supervisor
  3. Worker

  Demo Password: buildora123

  - Creates missing accounts.
  - Uses existing BUILDORA roles.
  - Ensures correct user-role assignments.
  - Can reset passwords of only the three demo accounts.
  - Does not modify other BUILDORA users.
*/

const PASSWORD = "buildora123";

const accounts = [
  {
    name: "Productivity Manager",
    email: "productivity@buildora.local",
    role: "Productivity Manager"
  },
  {
    name: "Site Supervisor User",
    email: "supervisor@buildora.local",
    role: "Site Supervisor"
  },
  {
    name: "Worker",
    email: "worker@buildora.local",
    role: "Worker"
  }
];

// ========================================
// DATABASE HELPERS
// ========================================

async function select(sql, replacements = [], transaction) {
  return sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    transaction
  });
}

async function execute(sql, replacements = [], transaction) {
  return sequelize.query(sql, {
    replacements,
    transaction
  });
}

// ========================================
// FIND ROLE
// ========================================

async function findRole(roleName, transaction) {
  const rows = await select(
    `
    SELECT id, role_name
    FROM roles
    WHERE role_name = ?
    LIMIT 1
    `,
    [roleName],
    transaction
  );

  if (!rows.length) {
    throw new Error(`Role not found: ${roleName}`);
  }

  return rows[0];
}

// ========================================
// CHECK AUTO INCREMENT
// ========================================

async function userIdAutoIncrement(transaction) {
  const columns = await select(
    "SHOW COLUMNS FROM users LIKE 'id'",
    [],
    transaction
  );

  if (!columns.length) {
    throw new Error("users.id column is missing.");
  }

  return String(columns[0].Extra || "")
    .toLowerCase()
    .includes("auto_increment");
}

// ========================================
// FIND USER
// ========================================

async function findUser(email, transaction) {
  const rows = await select(
    `
    SELECT id, name, email
    FROM users
    WHERE LOWER(email) = ?
    LIMIT 1
    `,
    [email.toLowerCase()],
    transaction
  );

  return rows[0] || null;
}

// ========================================
// CREATE USER
// ========================================

async function createUser(account, passwordHash, transaction) {
  const isAutoIncrement = await userIdAutoIncrement(
    transaction
  );

  if (isAutoIncrement) {
    await execute(
      `
      INSERT INTO users
      (
        name,
        email,
        password,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, NOW(), NOW())
      `,
      [
        account.name,
        account.email,
        passwordHash
      ],
      transaction
    );
  } else {
    const result = await select(
      `
      SELECT COALESCE(MAX(id), 0) + 1 AS next_id
      FROM users
      `,
      [],
      transaction
    );

    const nextId = Number(result[0].next_id);

    await execute(
      `
      INSERT INTO users
      (
        id,
        name,
        email,
        password,
        createdAt,
        updatedAt
      )
      VALUES (?, ?, ?, ?, NOW(), NOW())
      `,
      [
        nextId,
        account.name,
        account.email,
        passwordHash
      ],
      transaction
    );
  }

  const user = await findUser(
    account.email,
    transaction
  );

  if (!user) {
    throw new Error(
      `Failed to create account: ${account.email}`
    );
  }

  console.log(`CREATED ACCOUNT: ${account.email}`);

  return user;
}

// ========================================
// RESET EXISTING PASSWORD
// ========================================

async function resetPassword(userId, passwordHash, transaction) {
  await execute(
    `
    UPDATE users
    SET password = ?,
        updatedAt = NOW()
    WHERE id = ?
    `,
    [passwordHash, userId],
    transaction
  );
}

// ========================================
// ENSURE USER ROLE
// ========================================

async function ensureUserRole(userId, roleId, roleName, transaction) {
  const existing = await select(
    `
    SELECT user_id
    FROM user_roles
    WHERE user_id = ?
      AND role_id = ?
    LIMIT 1
    `,
    [userId, roleId],
    transaction
  );

  if (existing.length) {
    console.log(`ROLE ALREADY ASSIGNED: ${roleName}`);
    return;
  }

  await execute(
    `
    INSERT INTO user_roles
    (
      user_id,
      role_id
    )
    VALUES (?, ?)
    `,
    [userId, roleId],
    transaction
  );

  console.log(`ROLE ASSIGNED: ${roleName}`);
}

// ========================================
// PROCESS ACCOUNT
// ========================================

async function processAccount(account, passwordHash) {
  await sequelize.transaction(async transaction => {
    const role = await findRole(
      account.role,
      transaction
    );

    let user = await findUser(
      account.email,
      transaction
    );

    if (!user) {
      user = await createUser(
        account,
        passwordHash,
        transaction
      );
    } else {
      console.log(`EXISTING ACCOUNT: ${account.email}`);

      if (
        process.env.SEED_RESET_EXISTING_PASSWORDS === "true"
      ) {
        await resetPassword(
          user.id,
          passwordHash,
          transaction
        );

        console.log(
          `PASSWORD UPDATED: ${account.email}`
        );
      }
    }

    await ensureUserRole(
      user.id,
      role.id,
      account.role,
      transaction
    );
  });
}

// ========================================
// MAIN
// ========================================

async function main() {
  if (
    process.env.ALLOW_REMOTE_PRODUCTIVITY_SEED !== "true"
  ) {
    throw new Error(
      "Account seeding disabled. Set " +
      "ALLOW_REMOTE_PRODUCTIVITY_SEED=true."
    );
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Demo account seeding is disabled in production."
    );
  }

  if (process.env.DB_HOST !== "10.143.23.99") {
    throw new Error(
      "Unexpected database host. Check DB_HOST."
    );
  }

  await sequelize.authenticate();

  const database = await select(
    "SELECT DATABASE() AS database_name"
  );

  if (
    database[0]?.database_name !== "buildora_system"
  ) {
    throw new Error(
      "Wrong database. Expected buildora_system."
    );
  }

  console.log("------------------------------------");
  console.log("BUILDORA DATABASE CONNECTED");
  console.log("DATABASE: buildora_system");
  console.log("------------------------------------");

  const passwordHash = await bcrypt.hash(
    PASSWORD,
    12
  );

  for (const account of accounts) {
    await processAccount(
      account,
      passwordHash
    );
  }

  console.log("------------------------------------");
  console.log("BUILDORA PRODUCTIVITY ACCOUNTS READY");
  console.log("------------------------------------");
  console.log("Productivity Manager account checked.");
  console.log("Site Supervisor account checked.");
  console.log("Worker account checked.");
}

try {
  await main();
} catch (error) {
  console.error(
    "SEED ERROR:",
    error.original?.sqlMessage || error.message
  );

  process.exitCode = 1;
} finally {
  await sequelize.close();
}
