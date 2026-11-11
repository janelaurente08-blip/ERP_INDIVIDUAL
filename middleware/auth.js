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


import { QueryTypes } from "sequelize";
import { sequelize } from "../models/db.js";

export async function requireAuth(req, res, next) {
  try {
    if (!req.session?.userId) {
      if (req.originalUrl.startsWith("/api/")) {
        return res.status(401).json({
          success: false,
          message: "Please log in."
        });
      }
      return res.redirect("/login");
    }

    const users = await sequelize.query(`
      SELECT id, name, email
      FROM users
      WHERE id = ?
      LIMIT 1
    `, {
      replacements: [req.session.userId],
      type: QueryTypes.SELECT
    });

    if (!users.length) {
      req.session.destroy(() => {});
      return res.status(401).send("Session expired.");
    }

    const roles = await sequelize.query(`
      SELECT r.role_name
      FROM user_roles ur
      JOIN roles r ON r.id = ur.role_id
      WHERE ur.user_id = ?
    `, {
      replacements: [req.session.userId],
      type: QueryTypes.SELECT
    });

    req.user = {
      ...users[0],
      roles: roles.map(r => r.role_name)
    };

    next();
  } catch (error) {
    next(error);
  }
}
