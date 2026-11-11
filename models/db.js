
/*
    MIT License

    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining
    a copy of this software and associated documentation files
    (the "Software"), to deal in the Software without restriction,
    including without limitation the rights to use, copy, modify,
    merge, publish, distribute, sublicense, and/or sell copies
    of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
    EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
    OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
    NONINFRINGEMENT.
*/

import "dotenv/config";
import { Sequelize } from "sequelize";

// ======================================
// BUILDORA PRODUCTIVITY - SHARED DATABASE
// ======================================

const DB_HOST = process.env.DB_HOST;

const DB_PORT = Number(
  process.env.DB_PORT || 3306
);

const DB_NAME =
  process.env.DB_DATABASE || process.env.DB_NAME;

const DB_USER =
  process.env.DB_USER || process.env.DB_USERNAME;

const DB_PASSWORD = process.env.DB_PASSWORD;

// ======================================
// DATABASE VALIDATION
// ======================================

if (
  !DB_HOST ||
  !DB_NAME ||
  !DB_USER ||
  !DB_PASSWORD ||
  !Number.isInteger(DB_PORT) ||
  DB_PORT < 1 ||
  DB_PORT > 65535
) {
  throw new Error(
    "Invalid Productivity database configuration. " +
    "Check your .env file."
  );
}

// ======================================
// SEQUELIZE CONNECTION
// ======================================

export const sequelize = new Sequelize(
  DB_NAME,
  DB_USER,
  DB_PASSWORD,
  {
    host: DB_HOST,
    port: DB_PORT,
    dialect: "mysql",
    logging: false,

    define: {
      timestamps: false,
      freezeTableName: true
    },

    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    },

    dialectOptions: {
      connectTimeout: 10000
    }
  }
);

// ======================================
// DATABASE CONNECTION TEST
// ======================================

export const testDatabase = async () => {
  await sequelize.authenticate();

  console.log("✅ BUILDORA PRODUCTIVITY MYSQL CONNECTED");
  console.log("Database:", DB_NAME);
  console.log("Host:", DB_HOST);
  console.log("User:", DB_USER);
};

export default sequelize;