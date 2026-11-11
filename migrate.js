
import { testDatabase, sequelize } from "./models/db.js";

try {
  await testDatabase();

  console.log(
    "Existing BUILDORA database detected. No migration executed."
  );

  await sequelize.close();
} catch (error) {
  console.error("Database verification failed:", error.message);
  process.exitCode = 1;
}
