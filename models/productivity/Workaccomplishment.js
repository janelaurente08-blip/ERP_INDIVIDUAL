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
  // Firebase doesn't require predefined models.
  // Use Firestore directly in controllers or create helper functions here.
  // Collection name: "workaccomplishment"

 
import { DataTypes } from "sequelize";
import { sequelize } from "../db.js";

// ==========================================
// BUILDORA - WORK ACCOMPLISHMENT MODEL
// ==========================================

export const WorkAccomplishment = sequelize.define(
  "WorkAccomplishment",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true
    },

    target_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    worker_id: {
      type: DataTypes.INTEGER,
      allowNull: false
    },

    accomplishment_date: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },

    completed_quantity: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      validate: {
        min: 0.01
      }
    },

    work_hours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: false,
      validate: {
        min: 0.01,
        max: 24
      }
    },

    accomplishment_status: {
      type: DataTypes.ENUM(
        "Submitted",
        "Verified",
        "Rejected"
      ),
      allowNull: false,
      defaultValue: "Submitted"
    },

    verified_by: {
      type: DataTypes.INTEGER,
      allowNull: true
    },

    verified_at: {
      type: DataTypes.DATE,
      allowNull: true
    },

    remarks: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  },
  {
    tableName: "work_accomplishments",

    timestamps: true,

    // Matches the actual MySQL columns
    createdAt: "createdAt",
    updatedAt: "updatedAt"
  }
);