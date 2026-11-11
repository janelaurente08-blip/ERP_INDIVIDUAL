
import "dotenv/config";
import bcrypt from "bcryptjs";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/db.js";

const accounts = [
  {
    email: "productivity@buildora.local",
    role: "Productivity Manager",
    password: process.env.SEED_PRODUCTIVITY_PASSWORD
  },
  {
    email: "worker@buildora.local",
    role: "Worker",
    password: process.env.SEED_WORKER_PASSWORD
  }
];

async function main() {
  if (
    process.env.NODE_ENV !== "development" ||
    process.env.DB_NAME !== "buildora_system" ||
    !["127.0.0.1", "localhost"].includes(process.env.DB_HOST)
  ) {
    throw new Error("Password reset is allowed only in local development.");
  }

  await sequelize.authenticate();

  for (const account of accounts) {
    if (!account.password || account.password.length < 8) {
      throw new Error(`Invalid password for ${account.email}`);
    }

    const matches = await sequelize.query(`
      SELECT u.id
      FROM users u
      JOIN user_roles ur ON ur.user_id = u.id
      JOIN roles r ON r.id = ur.role_id
      WHERE LOWER(u.email) = ?
        AND r.role_name = ?
      LIMIT 1
    `, {
      replacements: [account.email, account.role],
      type: QueryTypes.SELECT
    });

    if (!matches.length) {
      console.log(`Skipped ${account.email}: account or role missing`);
      continue;
    }

    const passwordHash = await bcrypt.hash(account.password, 12);

    await sequelize.query(`
      UPDATE users
      SET password = ?, updatedAt = NOW()
      WHERE id = ?
    `, {
      replacements: [passwordHash, matches[0].id]
    });

    console.log(`✅ Password updated: ${account.email}`);
  }

  console.log("✅ Local demo password reset finished.");
}

try {
  await main();
} catch (error) {
  console.error("❌", error.message);
  process.exitCode = 1;
} finally {
  await sequelize.close();
}
