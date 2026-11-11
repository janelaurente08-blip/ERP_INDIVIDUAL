import "dotenv/config";
import mysql from "mysql2/promise";

async function testDatabase() {
  let connection;

  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT || 3306),
      user: process.env.DB_USER || process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE || process.env.DB_NAME
    });

    const [rows] = await connection.query(
      "SELECT DATABASE() AS database_name, CURRENT_USER() AS db_account"
    );

    console.log("BUILDORA DATABASE CONNECTED!");
    console.log("Database:", rows[0].database_name);
    console.log("Account:", rows[0].db_account);

  } catch (error) {
    console.error("DATABASE CONNECTION FAILED:", error.message);
    process.exitCode = 1;
  } finally {
    if (connection) await connection.end();
  }
}

testDatabase();