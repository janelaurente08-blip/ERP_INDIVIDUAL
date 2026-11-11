
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT || 3000),

  db: {
    host: process.env.DB_HOST || "127.0.0.1",
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME || "buildora_system",
    username: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || ""
  },

  sessionSecret: process.env.SESSION_SECRET,

  isProduction: process.env.NODE_ENV === "production"
};
