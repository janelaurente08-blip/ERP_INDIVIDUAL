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

import bcrypt from "bcryptjs";
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/db.js";

// ==========================================
// BUILDORA - AUTHENTICATION CONTROLLER
// ==========================================

// Role-based dashboard URLs
const ROLE_PATHS = {
  "Productivity Manager": "/productivity/manager",
  "Site Supervisor": "/productivity/supervisor",
  "Worker": "/productivity/worker"
};

// Role priority for users with multiple roles
const ROLE_PRIORITY = [
  "Productivity Manager",
  "Site Supervisor",
  "Worker"
];

// ==========================================
// HELPER: GET USER ROLES
// ==========================================

async function getUserRoles(userId, transaction = null) {
  const options = {
    replacements: [userId],
    type: QueryTypes.SELECT
  };

  if (transaction) {
    options.transaction = transaction;
  }

  const records = await sequelize.query(
    `
    SELECT r.role_name
    FROM user_roles ur
    INNER JOIN roles r
      ON r.id = ur.role_id
    WHERE ur.user_id = ?
    `,
    options
  );

  return records.map(record => record.role_name);
}

// ==========================================
// HELPER: GET PRIMARY PRODUCTIVITY ROLE
// ==========================================

function getPrimaryRole(roles) {
  return ROLE_PRIORITY.find(role => roles.includes(role)) || null;
}

// ==========================================
// GET LOGIN PAGE
// ==========================================

export const loginPage = (req, res) => {
  if (req.session?.userId) {
    return res.redirect("/");
  }

  return res.render("login", {
    title: "BUILDORA Login"
  });
};

// ==========================================
// GET REGISTER PAGE
// ==========================================

export const registerPage = (req, res) => {
  if (req.session?.userId) {
    return res.redirect("/");
  }

  return res.render("register", {
    title: "BUILDORA Registration"
  });
};

// ==========================================
// POST LOGIN
// ==========================================

export const loginUser = async (req, res, next) => {
  try {
    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required."
      });
    }

    // Existing users table has no "role" column.
    const users = await sequelize.query(
      `
      SELECT id, name, email, password
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      {
        replacements: [email],
        type: QueryTypes.SELECT
      }
    );

    const user = users[0];

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Verify hashed password
    const passwordMatched = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password."
      });
    }

    // Retrieve roles from user_roles + roles
    const assignedRoles = await getUserRoles(user.id);

    const primaryRole = getPrimaryRole(assignedRoles);

    if (!primaryRole) {
      return res.status(403).json({
        success: false,
        message:
          "Your account has no Labor Productivity role assigned. " +
          "Please contact the administrator."
      });
    }

    // Prevent session fixation
    req.session.regenerate(error => {
      if (error) {
        return next(error);
      }

      req.session.userId = user.id;

      req.session.save(error => {
        if (error) {
          return next(error);
        }

        return res.status(200).json({
          success: true,
          message: "Login successful.",
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            role: primaryRole,
            roles: assignedRoles
          },
          redirect: ROLE_PATHS[primaryRole]
        });
      });
    });

  } catch (error) {
    console.error("[AUTH LOGIN ERROR]", error);
    next(error);
  }
};

// ==========================================
// POST REGISTER
// Public registration creates Worker role
// ==========================================

export const registerWorker = async (req, res, next) => {
  try {
    const name = String(req.body?.name || "").trim();

    const email = String(req.body?.email || "")
      .trim()
      .toLowerCase();

    const password = String(req.body?.password || "");

    // Validate registration fields
    if (name.length < 2 || name.length > 255) {
      return res.status(400).json({
        success: false,
        message: "Full name must be 2 to 255 characters."
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid email address."
      });
    }

    if (password.length < 8) {
      return res.status(400).json({
        success: false,
        message: "Password must contain at least 8 characters."
      });
    }

    if (password.length > 72) {
      return res.status(400).json({
        success: false,
        message: "Password is too long for this password format."
      });
    }

    // Check if email already exists
    const existingUsers = await sequelize.query(
      `
      SELECT id
      FROM users
      WHERE LOWER(email) = ?
      LIMIT 1
      `,
      {
        replacements: [email],
        type: QueryTypes.SELECT
      }
    );

    if (existingUsers.length > 0) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    // Both inserts succeed or both roll back.
    const createdUser = await sequelize.transaction(
      async transaction => {

        // Get Worker role from existing roles table
        const roles = await sequelize.query(
          `
          SELECT id
          FROM roles
          WHERE role_name = ?
          LIMIT 1
          `,
          {
            replacements: ["Worker"],
            type: QueryTypes.SELECT,
            transaction
          }
        );

        if (roles.length === 0) {
          throw new Error(
            "Worker role does not exist in the database."
          );
        }

        // Create user account
        const [result] = await sequelize.query(
          `
          INSERT INTO users
            (name, email, password, createdAt, updatedAt)
          VALUES
            (?, ?, ?, NOW(), NOW())
          `,
          {
            replacements: [
              name,
              email,
              hashedPassword
            ],
            transaction
          }
        );

        // MySQL INSERT query returns insert ID.
        const userId =
          typeof result === "number"
            ? result
            : result?.insertId;

        if (!userId) {
          throw new Error("Failed to retrieve new user ID.");
        }

        // Assign Worker role
        await sequelize.query(
          `
          INSERT INTO user_roles
            (user_id, role_id)
          VALUES (?, ?)
          `,
          {
            replacements: [
              userId,
              roles[0].id
            ],
            transaction
          }
        );

        return {
          id: userId,
          name,
          email
        };
      }
    );

    return res.status(201).json({
      success: true,
      message:
        "Worker account created successfully. " +
        "You can now log in.",
      user: {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: "Worker"
      },
      redirect: "/login"
    });

  } catch (error) {
    console.error("[AUTH REGISTER ERROR]", error);

    if (
      error.name === "SequelizeUniqueConstraintError" ||
      error.original?.code === "ER_DUP_ENTRY"
    ) {
      return res.status(409).json({
        success: false,
        message: "This email is already registered."
      });
    }

    next(error);
  }
};

// ==========================================
// POST LOGOUT
// ==========================================

export const logoutUser = (req, res, next) => {
  if (!req.session) {
    return res.redirect("/login");
  }

  req.session.destroy(error => {
    if (error) {
      return next(error);
    }

    res.clearCookie("buildora.sid");

    return res.redirect("/login");
  });
};
