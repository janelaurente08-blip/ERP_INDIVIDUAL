/*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    

import express from "express";
import session from "express-session";
import { engine } from "express-handlebars";
import path from "node:path";

import { config } from "./config/env.js";
import { testDatabase } from "./models/db.js";
import routes from "./routes/index.js";

const app = express();

app.disable("x-powered-by");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/public", express.static(
  path.resolve("public")
));

app.engine("xian", engine({
  extname: ".xian",
  defaultLayout: false
}));

app.set("view engine", "xian");
app.set("views", path.resolve("views"));

if (!config.sessionSecret) {
  throw new Error("SESSION_SECRET is missing from .env");
}

if (config.isProduction) {
  app.set("trust proxy", 1);
}

app.use(session({
  name: "buildora.sid",
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(routes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found."
  });
});

app.use((err, req, res, next) => {
  console.error("[BUILDORA]", err);

  res.status(500).json({
    success: false,
    message: config.isProduction
      ? "Internal server error."
      : err.message
  });
});

try {
  await testDatabase();

  app.listen(config.port, () => {
    console.log(
      `🔥 XianFire running at http://localhost:${config.port}`
    );
  });
} catch (error) {
  console.error("Database connection failed:", error.message);
  process.exit(1);
}
