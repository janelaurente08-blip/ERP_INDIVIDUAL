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
  // Collection name: "productivityreport"


import { QueryTypes } from "sequelize";
import { sequelize } from "../db.js";

export const ProductivityReport = {
  async getSummary() {
    const rows = await sequelize.query(`
      SELECT
        t.id AS target_id,
        t.target_name,
        t.target_quantity,
        t.unit_of_measure,
        t.target_status,
        p.project_name,

        COALESCE(
          SUM(
            CASE
              WHEN a.accomplishment_status = 'Verified'
              THEN a.completed_quantity
              ELSE 0
            END
          ), 0
        ) AS verified_quantity,

        COALESCE(
          SUM(
            CASE
              WHEN a.accomplishment_status = 'Verified'
              THEN a.work_hours
              ELSE 0
            END
          ), 0
        ) AS verified_hours

      FROM productivity_targets t
      JOIN projects p ON p.id = t.project_id

      LEFT JOIN work_accomplishments a
        ON a.target_id = t.id

      GROUP BY
        t.id, t.target_name, t.target_quantity,
        t.unit_of_measure, t.target_status, p.project_name

      ORDER BY t.id DESC
    `, {
      type: QueryTypes.SELECT
    });

    return rows.map(row => {
      const target = Number(row.target_quantity);
      const actual = Number(row.verified_quantity);
      const hours = Number(row.verified_hours);

      return {
        ...row,
        completion_percentage:
          target > 0
            ? Number(Math.min(100, actual / target * 100).toFixed(2))
            : 0,
        output_per_hour:
          hours > 0
            ? Number((actual / hours).toFixed(2))
            : 0
      };
    });
  }
};
