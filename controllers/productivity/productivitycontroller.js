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
import { sequelize } from "../../models/db.js";

import { ProductivityTarget } from "../../models/productivity/Productivitytarget.js";
import { WorkAccomplishment } from "../../models/productivity/Workaccomplishment.js";
import { ProductivityReview } from "../../models/productivity/Productivityreview.js";

import { buildoraApi } from "../../services/buildoraApi.js";
import { ROLES } from "../../middleware/role.js";

// ==========================================
// DATABASE AND RESPONSE HELPERS
// ==========================================

const db = (sql, replacements = []) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  });

const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });

const fail = (res, message, status = 400) =>
  res.status(status).json({
    success: false,
    message
  });

const idOK = value =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

const positive = value =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isFinite(Number(value)) &&
  Number(value) > 0;

const dateOK = value => {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value)
  ) return false;

  const parsed = new Date(`${value}T00:00:00Z`);

  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value;
};

const dateString = value =>
  value instanceof Date
    ? value.toISOString().slice(0, 10)
    : String(value ?? "").slice(0, 10);

const rolesOf = req =>
  Array.isArray(req.user?.roles)
    ? req.user.roles
    : [];

const manager = req =>
  rolesOf(req).includes(ROLES.MANAGER);

const supervisor = req =>
  rolesOf(req).includes(ROLES.SUPERVISOR);

const workerRole = req =>
  rolesOf(req).includes(ROLES.WORKER);

const workerNameSQL = `
  TRIM(CONCAT_WS(' ',
    NULLIF(w.first_name, ''),
    NULLIF(w.middle_name, ''),
    NULLIF(w.last_name, '')
  ))
`;

function handleError(res, label, error) {
  console.error(`[PRODUCTIVITY ${label}]`, {
    message: error.message,
    sqlMessage: error.original?.sqlMessage,
    sql: error.sql
  });

  return fail(
    res,
    "Database operation failed. Check the VS Code terminal for the exact error.",
    500
  );
}

// ==========================================
// LIVE VERIFIED PRODUCTIVITY REPORTS
// ==========================================

async function productivityReports(targetIds = null) {
  const reports = await db(`
    SELECT
      t.id AS target_id,
      t.target_name,
      t.unit_of_measure,
      t.target_quantity,
      p.project_name,

      COALESCE(SUM(
        CASE
          WHEN a.accomplishment_status = 'Verified'
          THEN a.completed_quantity
          ELSE 0
        END
      ), 0) AS verified_quantity,

      COALESCE(SUM(
        CASE
          WHEN a.accomplishment_status = 'Verified'
          THEN a.work_hours
          ELSE 0
        END
      ), 0) AS verified_hours

    FROM productivity_targets AS t

    INNER JOIN projects AS p
      ON p.id = t.project_id

    LEFT JOIN work_accomplishments AS a
      ON a.target_id = t.id

    GROUP BY
      t.id,
      t.target_name,
      t.unit_of_measure,
      t.target_quantity,
      p.project_name

    ORDER BY t.id DESC
  `);

  return reports
    .filter(row =>
      targetIds === null ||
      targetIds.has(Number(row.target_id))
    )
    .map(row => {
      const quantity = Number(row.verified_quantity) || 0;
      const hours = Number(row.verified_hours) || 0;
      const target = Number(row.target_quantity) || 0;

      return {
        ...row,
        completion_percentage: target > 0
          ? Number((quantity / target * 100).toFixed(2))
          : 0,
        output_per_hour: hours > 0
          ? Number((quantity / hours).toFixed(2))
          : 0
      };
    });
}

// ==========================================
// DASHBOARD - ALL ROLES
// ==========================================

export async function dashboard(req, res) {
  try {
    if (!req.user) {
      return fail(res, "Please log in.", 401);
    }

    const response = {
      user: req.user,
      projects: [],
      tasks: [],
      workers: [],
      targets: [],
      accomplishments: [],
      reviews: [],
      reports: []
    };

    // PRODUCTIVITY MANAGER
    if (manager(req)) {
      const [
        projects,
        tasks,
        workers,
        targets,
        accomplishments,
        reviews,
        reports
      ] = await Promise.all([
        buildoraApi.projects(),
        buildoraApi.tasks(),
        buildoraApi.workers(),

        ProductivityTarget.findAll({
          raw: true,
          order: [["id", "DESC"]]
        }),

        db(`
          SELECT
            a.*,
            t.target_name,
            p.project_name,
            ${workerNameSQL} AS worker_name
          FROM work_accomplishments AS a

          INNER JOIN productivity_targets AS t
            ON t.id = a.target_id

          INNER JOIN projects AS p
            ON p.id = t.project_id

          INNER JOIN workers AS w
            ON w.id = a.worker_id

          ORDER BY a.id DESC
        `),

        db(`
          SELECT
            r.*,
            ${workerNameSQL} AS worker_name
          FROM productivity_reviews AS r

          INNER JOIN workers AS w
            ON w.id = r.worker_id

          ORDER BY r.id DESC
        `),

        productivityReports()
      ]);

      return ok(res, {
        ...response,
        projects,
        tasks,
        workers,
        targets,
        accomplishments,
        reviews,
        reports
      });
    }

    // SITE SUPERVISOR
    if (supervisor(req)) {
      const userId = req.user.id;

      const projects = await db(`
        SELECT DISTINCT
          p.id,
          p.project_code,
          p.project_name,
          p.project_status

        FROM projects AS p

        INNER JOIN project_supervisors AS ps
          ON ps.project_id = p.id

        WHERE ps.supervisor_id = ?
          AND ps.assignment_status = 'Active'

        ORDER BY p.project_name
      `, [userId]);

      const tasks = await db(`
        SELECT DISTINCT
          t.id,
          t.project_id,
          t.task_name,
          t.task_status,
          t.progress_percentage,
          p.project_name

        FROM project_tasks AS t

        INNER JOIN projects AS p
          ON p.id = t.project_id

        INNER JOIN project_supervisors AS ps
          ON ps.project_id = t.project_id

        WHERE ps.supervisor_id = ?
          AND ps.assignment_status = 'Active'

        ORDER BY t.id DESC
      `, [userId]);

      const targets = await db(`
        SELECT DISTINCT
          t.*

        FROM productivity_targets AS t

        INNER JOIN project_supervisors AS ps
          ON ps.project_id = t.project_id

        WHERE ps.supervisor_id = ?
          AND ps.assignment_status = 'Active'

        ORDER BY t.id DESC
      `, [userId]);

      const accomplishments = await db(`
        SELECT DISTINCT
          a.*,
          t.target_name,
          p.project_name,
          ${workerNameSQL} AS worker_name

        FROM work_accomplishments AS a

        INNER JOIN productivity_targets AS t
          ON t.id = a.target_id

        INNER JOIN projects AS p
          ON p.id = t.project_id

        INNER JOIN workers AS w
          ON w.id = a.worker_id

        INNER JOIN project_supervisors AS ps
          ON ps.project_id = t.project_id

        WHERE ps.supervisor_id = ?
          AND ps.assignment_status = 'Active'

        ORDER BY a.id DESC
      `, [userId]);

      const permitted = new Set(
        targets.map(t => Number(t.id))
      );

      const reports = await productivityReports(permitted);

      return ok(res, {
        ...response,
        projects,
        tasks,
        targets,
        accomplishments,
        reports
      });
    }

    // WORKER
    if (workerRole(req)) {
      const worker = await buildoraApi.ownWorker(
        req.user.id
      );

      response.worker = worker;

      if (!worker) {
        // Not an error: Workforce has not created
        // a worker profile for this user yet.
        return ok(res, response);
      }

      response.tasks = await db(`
        SELECT DISTINCT
          t.id,
          t.project_id,
          t.task_name,
          t.task_status,
          t.progress_percentage,
          p.project_name

        FROM task_assignments AS ta

        INNER JOIN project_tasks AS t
          ON t.id = ta.task_id

        INNER JOIN projects AS p
          ON p.id = t.project_id

        WHERE ta.worker_id = ?
          AND ta.assignment_status <> 'Removed'

        ORDER BY t.id DESC
      `, [worker.id]);

      response.projects = await db(`
        SELECT DISTINCT
          p.id,
          p.project_code,
          p.project_name,
          p.project_status

        FROM projects AS p

        INNER JOIN project_tasks AS t
          ON t.project_id = p.id

        INNER JOIN task_assignments AS ta
          ON ta.task_id = t.id

        WHERE ta.worker_id = ?
          AND ta.assignment_status <> 'Removed'

        ORDER BY p.project_name
      `, [worker.id]);

      const allTargets = await ProductivityTarget.findAll({
        raw: true,
        order: [["id", "DESC"]]
      });

      for (const target of allTargets) {
        if (
          target.target_status !== "Cancelled" &&
          await buildoraApi.workerCanAccessTarget(
            worker.id,
            target
          )
        ) {
          response.targets.push(target);
        }
      }

      response.accomplishments = await db(`
        SELECT
          a.*,
          t.target_name

        FROM work_accomplishments AS a

        INNER JOIN productivity_targets AS t
          ON t.id = a.target_id

        WHERE a.worker_id = ?
        ORDER BY a.id DESC
      `, [worker.id]);

      response.reviews = await db(`
        SELECT *
        FROM productivity_reviews
        WHERE worker_id = ?
        ORDER BY id DESC
      `, [worker.id]);

      const permitted = new Set(
        response.targets.map(t => Number(t.id))
      );

      response.reports = await productivityReports(permitted);

      return ok(res, response);
    }

    return fail(res, "Access denied.", 403);

  } catch (error) {
    return handleError(res, "DASHBOARD", error);
  }
}

// ==========================================
// MANAGER - CREATE PRODUCTIVITY TARGET
// ==========================================

export async function createTarget(req, res) {
  try {
    if (!manager(req)) {
      return fail(res, "Manager access required.", 403);
    }

    const b = req.body || {};

    if (
      !idOK(b.project_id) ||
      !String(b.target_name || "").trim() ||
      !String(b.unit_of_measure || "").trim() ||
      !positive(b.target_quantity) ||
      !dateOK(b.start_date) ||
      !dateOK(b.end_date) ||
      b.end_date < b.start_date
    ) {
      return fail(res, "Invalid target details.");
    }

    const projects = await buildoraApi.projects();

    if (!projects.some(
      p => Number(p.id) === Number(b.project_id)
    )) {
      return fail(res, "Project not found.", 404);
    }

    const hasTask =
      b.task_id !== "" &&
      b.task_id !== null &&
      b.task_id !== undefined;

    const taskId = hasTask
      ? Number(b.task_id)
      : null;

    if (
      hasTask &&
      (
        !idOK(b.task_id) ||
        !(await buildoraApi.validTaskForProject(
          taskId,
          Number(b.project_id)
        ))
      )
    ) {
      return fail(res, "Invalid task for this project.");
    }

    const record = await ProductivityTarget.create({
      project_id: Number(b.project_id),
      task_id: taskId,
      created_by: req.user.id,
      target_name: String(b.target_name).trim(),
      description: String(b.description || "").trim(),
      target_quantity: Number(b.target_quantity),
      unit_of_measure: String(b.unit_of_measure).trim(),
      start_date: b.start_date,
      end_date: b.end_date,
      target_status: "Pending"
    });

    return ok(res, record, 201);

  } catch (error) {
    return handleError(res, "CREATE TARGET", error);
  }
}

// ==========================================
// MANAGER - UPDATE TARGET STATUS
// ==========================================

export async function updateTarget(req, res) {
  try {
    if (!manager(req)) {
      return fail(res, "Manager access required.", 403);
    }

    if (!idOK(req.params.id)) {
      return fail(res, "Invalid target ID.");
    }

    const target = await ProductivityTarget.findByPk(
      req.params.id
    );

    if (!target) {
      return fail(res, "Target not found.", 404);
    }

    const status = req.body?.target_status;

    if (![
      "Pending",
      "In Progress",
      "Completed",
      "Cancelled"
    ].includes(status)) {
      return fail(res, "Invalid target status.");
    }

    await target.update({
      target_status: status
    });

    return ok(res, target);

  } catch (error) {
    return handleError(res, "UPDATE TARGET", error);
  }
}

// ==========================================
// WORKER - SUBMIT ACCOMPLISHMENT
// ==========================================

export async function submitAccomplishment(req, res) {
  try {
    if (!workerRole(req)) {
      return fail(res, "Worker access required.", 403);
    }

    const profile = await buildoraApi.ownWorker(
      req.user.id
    );

    if (
      !profile ||
      profile.status !== "Active"
    ) {
      return fail(
        res,
        "An active Workforce worker profile is required.",
        403
      );
    }

    const b = req.body || {};

    if (!idOK(b.target_id)) {
      return fail(res, "Invalid target ID.");
    }

    const target = await ProductivityTarget.findByPk(
      b.target_id
    );

    if (!target) {
      return fail(res, "Target not found.", 404);
    }

    if ([
      "Completed",
      "Cancelled"
    ].includes(target.target_status)) {
      return fail(
        res,
        "This target no longer accepts submissions."
      );
    }

    if (!(await buildoraApi.workerCanAccessTarget(
      profile.id,
      target
    ))) {
      return fail(
        res,
        "You are not assigned to this target.",
        403
      );
    }

    if (
      !positive(b.completed_quantity) ||
      !positive(b.work_hours) ||
      Number(b.work_hours) > 24 ||
      !dateOK(b.accomplishment_date) ||
      b.accomplishment_date <
        dateString(target.start_date) ||
      b.accomplishment_date >
        dateString(target.end_date)
    ) {
      return fail(
        res,
        "Invalid accomplishment details."
      );
    }

    const record = await WorkAccomplishment.create({
      target_id: target.id,
      worker_id: profile.id,
      accomplishment_date: b.accomplishment_date,
      completed_quantity: Number(b.completed_quantity),
      work_hours: Number(b.work_hours),
      accomplishment_status: "Submitted",
      remarks: String(b.remarks || "").trim()
    });

    return ok(res, record, 201);

  } catch (error) {
    return handleError(res, "SUBMIT ACCOMPLISHMENT", error);
  }
}

// ==========================================
// SUPERVISOR - VERIFY OR REJECT
// ==========================================

export async function verifyAccomplishment(req, res) {
  try {
    if (!supervisor(req)) {
      return fail(
        res,
        "Site Supervisor access required.",
        403
      );
    }

    if (!idOK(req.params.id)) {
      return fail(
        res,
        "Invalid accomplishment ID."
      );
    }

    const status = req.body?.status;
    const remarks = String(
      req.body?.remarks || ""
    ).trim();

    if (!["Verified", "Rejected"].includes(status)) {
      return fail(
        res,
        "Invalid verification status."
      );
    }

    if (status === "Rejected" && !remarks) {
      return fail(
        res,
        "Rejection reason is required."
      );
    }

    const record = await WorkAccomplishment.findByPk(
      req.params.id
    );

    if (!record) {
      return fail(
        res,
        "Accomplishment not found.",
        404
      );
    }

    const target = await ProductivityTarget.findByPk(
      record.target_id
    );

    if (!target) {
      return fail(
        res,
        "Related target not found.",
        404
      );
    }

    const allowed =
      await buildoraApi.supervisorCanVerify(
        req.user.id,
        target.project_id
      );

    if (!allowed) {
      return fail(
        res,
        "You are not assigned to verify this project.",
        403
      );
    }

    const [updatedCount] =
      await WorkAccomplishment.update(
        {
          accomplishment_status: status,
          verified_by: req.user.id,
          verified_at: new Date(),
          remarks: remarks || record.remarks || ""
        },
        {
          where: {
            id: record.id,
            accomplishment_status: "Submitted"
          }
        }
      );

    if (!updatedCount) {
      return fail(
        res,
        "Accomplishment already reviewed.",
        409
      );
    }

    return ok(
      res,
      await WorkAccomplishment.findByPk(
        record.id
      )
    );

  } catch (error) {
    return handleError(
      res,
      "VERIFY ACCOMPLISHMENT",
      error
    );
  }
}

// ==========================================
// MANAGER - CREATE PERFORMANCE REVIEW
// ==========================================

export async function createReview(req, res) {
  try {
    if (!manager(req)) {
      return fail(
        res,
        "Manager access required.",
        403
      );
    }

    const b = req.body || {};
    const score = Number(b.productivity_score);

    if (
      !idOK(b.worker_id) ||
      !dateOK(b.review_start_date) ||
      !dateOK(b.review_end_date) ||
      b.review_end_date < b.review_start_date ||
      b.productivity_score === "" ||
      b.productivity_score == null ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100 ||
      ![
        "Excellent",
        "Good",
        "Average",
        "Needs Improvement"
      ].includes(b.performance_rating)
    ) {
      return fail(
        res,
        "Invalid performance review details."
      );
    }

    const worker = await buildoraApi.workerById(
      b.worker_id
    );

    if (!worker) {
      return fail(
        res,
        "Worker not found.",
        404
      );
    }

    const record = await ProductivityReview.create({
      worker_id: Number(b.worker_id),
      reviewed_by: req.user.id,
      review_start_date: b.review_start_date,
      review_end_date: b.review_end_date,
      productivity_score: score,
      performance_rating: b.performance_rating,
      comments: String(b.comments || "").trim()
    });

    return ok(res, record, 201);

  } catch (error) {
    return handleError(
      res,
      "CREATE REVIEW",
      error
    );
  }
}

// ==========================================
// MANAGER - PRODUCTIVITY REPORTS
// ==========================================

export async function getReports(req, res) {
  try {
    if (!manager(req)) {
      return fail(
        res,
        "Manager access required.",
        403
      );
    }

    return ok(
      res,
      await productivityReports()
    );

  } catch (error) {
    return handleError(res, "REPORTS", error);
  }
}
