
import { QueryTypes } from "sequelize";
import { sequelize } from "../models/db.js";

// BUILDORA - SHARED MODULE DATA SERVICE

const query = (sql, replacements = []) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT
  });

const validId = value =>
  value !== null &&
  value !== undefined &&
  value !== "" &&
  Number.isSafeInteger(Number(value)) &&
  Number(value) > 0;

// Worker field mapping for the shared Workforce schema.
const workerFields = `
  w.id,
  w.user_id,
  w.worker_code,
  TRIM(CONCAT_WS(' ',
    NULLIF(w.first_name, ''),
    NULLIF(w.middle_name, ''),
    NULLIF(w.last_name, '')
  )) AS name,
  w.employment_type AS position,
  '' AS department,
  w.contact_number AS contact,
  w.employment_status AS status
`;

export const buildoraApi = {
  // Projects belong to Project & Resource Management.
  async projects() {
    return query(`
      SELECT
        id,
        project_code,
        project_name,
        project_status
      FROM projects
      ORDER BY project_name ASC
    `);
  },

  async tasks() {
    return query(`
      SELECT
        t.id,
        t.project_id,
        t.task_name,
        t.task_status,
        t.progress_percentage,
        p.project_name
      FROM project_tasks AS t
      INNER JOIN projects AS p
        ON p.id = t.project_id
      ORDER BY t.id DESC
    `);
  },

  // Workers belong to Workforce Management.
  async workers() {
    return query(`
      SELECT ${workerFields}
      FROM workers AS w
      ORDER BY w.first_name, w.last_name
    `);
  },

  async workerById(workerId) {
    if (!validId(workerId)) return null;

    const rows = await query(`
      SELECT ${workerFields}
      FROM workers AS w
      WHERE w.id = ?
      LIMIT 1
    `, [Number(workerId)]);

    return rows[0] || null;
  },

  // Direct relationship:
  // users.id -> workers.user_id
  async ownWorker(userId) {
    if (!validId(userId)) return null;

    const rows = await query(`
      SELECT ${workerFields}
      FROM workers AS w
      WHERE w.user_id = ?
      LIMIT 1
    `, [Number(userId)]);

    return rows[0] || null;
  },

  // Worker must have an eligible assignment.
  async workerCanAccessTarget(workerId, target) {
    if (
      !validId(workerId) ||
      !validId(target?.project_id)
    ) return false;

    if (
      target.task_id !== null &&
      target.task_id !== undefined &&
      target.task_id !== ""
    ) {
      if (!validId(target.task_id)) return false;

      const rows = await query(`
        SELECT 1 AS allowed
        FROM task_assignments AS ta
        INNER JOIN project_tasks AS pt
          ON pt.id = ta.task_id
        WHERE ta.worker_id = ?
          AND ta.task_id = ?
          AND pt.project_id = ?
          AND ta.assignment_status IN (
            'Assigned',
            'In Progress'
          )
        LIMIT 1
      `, [
        Number(workerId),
        Number(target.task_id),
        Number(target.project_id)
      ]);

      return rows.length > 0;
    }

    const rows = await query(`
      SELECT 1 AS allowed
      FROM task_assignments AS ta
      INNER JOIN project_tasks AS pt
        ON pt.id = ta.task_id
      WHERE ta.worker_id = ?
        AND pt.project_id = ?
        AND ta.assignment_status IN (
          'Assigned',
          'In Progress'
        )
      LIMIT 1
    `, [
      Number(workerId),
      Number(target.project_id)
    ]);

    return rows.length > 0;
  },

  async supervisorCanVerify(userId, projectId) {
    if (!validId(userId) || !validId(projectId)) {
      return false;
    }

    const rows = await query(`
      SELECT 1 AS allowed
      FROM project_supervisors
      WHERE supervisor_id = ?
        AND project_id = ?
        AND assignment_status = 'Active'
      LIMIT 1
    `, [Number(userId), Number(projectId)]);

    return rows.length > 0;
  },

  async validTaskForProject(taskId, projectId) {
    if (!validId(taskId) || !validId(projectId)) {
      return false;
    }

    const rows = await query(`
      SELECT 1 AS allowed
      FROM project_tasks
      WHERE id = ?
        AND project_id = ?
      LIMIT 1
    `, [Number(taskId), Number(projectId)]);

    return rows.length > 0;
  }
};
