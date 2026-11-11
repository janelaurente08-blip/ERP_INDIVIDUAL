
/*
 * BUILDORA - LABOR PRODUCTIVITY MANAGEMENT
 * Shared Role-Based Dashboard UI
 *
 * Roles:
 * - Productivity Manager
 * - Site Supervisor
 * - Worker
 *
 * Uses existing XianFire routes and API.
 */

(() => {
  "use strict";

  // ==========================================
  // CONFIGURATION
  // ==========================================

  const ROLE = document.body.dataset.role;
  const API = "/productivity/api";

  const root = document.getElementById("app");

  const $ = id => document.getElementById(id);

  let state = null;
  let loading = false;
  let notice = null;

  // ==========================================
  // HELPERS
  // ==========================================

  const arr = value =>
    Array.isArray(value) ? value : [];

  const esc = value => String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");

  const num = value => {
    const n = Number(value);

    return Number.isFinite(n)
      ? n.toLocaleString(undefined, {
          maximumFractionDigits: 2
        })
      : "0";
  };

  const date = value =>
    String(value ?? "").slice(0, 10);

  const percent = value =>
    `${num(value)}%`;

  const validId = value =>
    value !== "" &&
    value !== null &&
    value !== undefined &&
    Number.isSafeInteger(Number(value)) &&
    Number(value) > 0;

  const positive = value =>
    value !== "" &&
    value !== null &&
    value !== undefined &&
    Number.isFinite(Number(value)) &&
    Number(value) > 0;

  const validDate = value => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) {
      return false;
    }

    const parsed = new Date(`${value}T00:00:00Z`);

    return !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === value;
  };

  function formData(formElement) {
    return Object.fromEntries(
      new FormData(formElement).entries()
    );
  }

  // ==========================================
  // API REQUESTS
  // ==========================================

  async function api(path, options = {}) {
    const response = await fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,

      headers: {
        Accept: "application/json",
        ...(options.headers || {})
      }
    });

    if (
      response.redirected &&
      new URL(response.url).pathname === "/login"
    ) {
      window.location.assign("/login");

      throw new Error("Session expired.");
    }

    const contentType =
      response.headers.get("content-type") || "";

    if (!contentType.includes("application/json")) {
      throw new Error(
        `HTTP ${response.status}: Expected JSON response.`
      );
    }

    const result = await response.json();

    if (!response.ok || result.success !== true) {
      throw new Error(
        result.message || `HTTP ${response.status}`
      );
    }

    return result.data;
  }

  function send(path, method, data) {
    return api(path, {
      method,

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(data)
    });
  }

  // ==========================================
  // NORMALIZE RESPONSE
  // ==========================================

  function normalize(data) {
    return {
      ...data,

      user: data?.user || {},
      worker: data?.worker || null,

      projects: arr(data?.projects),
      tasks: arr(data?.tasks),
      workers: arr(data?.workers),
      targets: arr(data?.targets),
      accomplishments: arr(data?.accomplishments),
      reviews: arr(data?.reviews),
      reports: arr(data?.reports)
    };
  }

  // ==========================================
  // UI COMPONENTS
  // ==========================================

  function card(value, label, style = "") {
    return `
      <div class="kpi ${esc(style)}">
        <strong>${esc(value)}</strong>
        <span>${esc(label)}</span>
      </div>
    `;
  }

  function panel(id, title, content, note = "") {
    return `
      <section class="panel" id="${esc(id)}">
        <h2>${esc(title)}</h2>

        ${note
          ? `<p class="panel-note">${esc(note)}</p>`
          : ""
        }

        ${content}
      </section>
    `;
  }

  function empty(message) {
    return `
      <div class="empty">
        ${esc(message)}
      </div>
    `;
  }

  function input(
    name,
    label,
    type = "text",
    attributes = ""
  ) {
    return `
      <label class="field">
        ${esc(label)}

        <input
          name="${esc(name)}"
          type="${esc(type)}"
          ${attributes}
        >
      </label>
    `;
  }

  function select(
    name,
    label,
    choices,
    required = true
  ) {
    return `
      <label class="field">
        ${esc(label)}

        <select
          name="${esc(name)}"
          ${required ? "required" : ""}
        >
          <option value=""
            ${required ? "selected disabled" : ""}>
            ${required ? "Select..." : "None"}
          </option>

          ${choices.map(choice => `
            <option value="${esc(choice.value)}">
              ${esc(choice.label)}
            </option>
          `).join("")}

        </select>
      </label>
    `;
  }

  function table(
    columns,
    rows,
    action = null,
    message = "No records available."
  ) {
    if (!rows.length) {
      return empty(message);
    }

    return `
      <div class="scroll-table">
        <table>
          <thead>
            <tr>
              ${columns.map(column => `
                <th>${esc(column)}</th>
              `).join("")}

              ${action ? "<th>Action</th>" : ""}
            </tr>
          </thead>

          <tbody>
            ${rows.map((row, index) => `
              <tr>
                ${row.map(cell => `
                  <td>${esc(cell ?? "—")}</td>
                `).join("")}

                ${action
                  ? `<td>${action(index)}</td>`
                  : ""
                }
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    `;
  }

  function intro(title, subtitle) {
    return `
      <div id="overview">
        <h1 class="page-title">
          ${esc(title)}
        </h1>

        <p class="sub">
          ${esc(subtitle)}
        </p>
      </div>

      <div id="feedback"></div>
    `;
  }

  function flash(message, isError = false) {
    notice = {
      message,
      error: isError
    };

    const element = $("feedback");

    if (!element) return;

    element.textContent = message;

    element.className = isError
      ? "feedback error"
      : "feedback";
  }

  // ==========================================
  // PRODUCTIVITY MANAGER DASHBOARD
  // ==========================================

  function renderManager() {
    const s = state;

    const completedTargets = s.targets.filter(
      t => t.target_status === "Completed"
    ).length;

    const verifiedWork = s.accomplishments.filter(
      a => a.accomplishment_status === "Verified"
    ).length;

    const projectOptions = s.projects.map(
      project => ({
        value: project.id,
        label: `${
          project.project_code || ""
        } ${project.project_name || ""}`.trim()
      })
    );

    const workerOptions = s.workers.map(
      worker => ({
        value: worker.id,
        label: worker.name ||
          `Worker #${worker.id}`
      })
    );

    // ======================================
    // CREATE TARGET FORM
    // ======================================

    const targetForm = s.projects.length
      ? `
        <form id="targetForm" class="form-grid">

          ${select(
            "project_id",
            "Project",
            projectOptions
          )}

          <label class="field">
            Related Task (Optional)

            <select
              name="task_id"
              id="taskSelect"
            >
              <option value="">
                No specific task
              </option>
            </select>
          </label>

          ${input(
            "target_name",
            "Target Name",
            "text",
            'required maxlength="150" placeholder="e.g. Wall Painting"'
          )}

          ${input(
            "target_quantity",
            "Target Quantity",
            "number",
            'required min="0.01" step="0.01" placeholder="e.g. 100"'
          )}

          ${input(
            "unit_of_measure",
            "Unit of Measure",
            "text",
            'required placeholder="e.g. sqm, pieces, meters"'
          )}

          ${input(
            "start_date",
            "Start Date",
            "date",
            "required"
          )}

          ${input(
            "end_date",
            "End Date",
            "date",
            "required"
          )}

          <label class="field span-all">
            Description

            <textarea
              name="description"
              rows="3"
              placeholder="Enter target details"
            ></textarea>
          </label>

          <div class="span-all">
            <button
              type="submit"
              class="btn yellow"
            >
              Create Productivity Target
            </button>
          </div>

        </form>
      `
      : empty(
        "No projects available. Create a project in Project & Resource Management first."
      );

    // ======================================
    // PERFORMANCE REVIEW FORM
    // ======================================

    const reviewForm = s.workers.length
      ? `
        <form id="reviewForm" class="form-grid">

          ${select(
            "worker_id",
            "Worker",
            workerOptions
          )}

          ${input(
            "review_start_date",
            "Review Start Date",
            "date",
            "required"
          )}

          ${input(
            "review_end_date",
            "Review End Date",
            "date",
            "required"
          )}

          ${input(
            "productivity_score",
            "Productivity Score (0–100)",
            "number",
            'required min="0" max="100" step="0.01"'
          )}

          ${select(
            "performance_rating",
            "Performance Rating",
            [
              "Excellent",
              "Good",
              "Average",
              "Needs Improvement"
            ].map(value => ({
              value,
              label: value
            }))
          )}

          <label class="field span-all">
            Comments

            <textarea
              name="comments"
              rows="3"
              placeholder="Enter performance review"
            ></textarea>
          </label>

          <div class="span-all">
            <button
              type="submit"
              class="btn yellow"
            >
              Save Performance Review
            </button>
          </div>

        </form>
      `
      : empty(
        "No worker profiles found. Workers are managed by Workforce Management."
      );

    // ======================================
    // TARGET LIST
    // ======================================

    const targetsTable = table(
      [
        "ID",
        "Target Name",
        "Project",
        "Quantity",
        "Unit",
        "Status"
      ],

      s.targets.map(target => [
        target.id,
        target.target_name,
        s.projects.find(
          p => Number(p.id) ===
            Number(target.project_id)
        )?.project_name || "—",
        num(target.target_quantity),
        target.unit_of_measure,
        target.target_status
      ]),

      index => {
        const target = s.targets[index];

        const statuses = [
          "Pending",
          "In Progress",
          "Completed",
          "Cancelled"
        ];

        return `
          <select
            class="targetStatus inline-select"
            data-id="${esc(target.id)}"
            data-previous="${esc(target.target_status)}"
            aria-label="Update target status"
          >
            ${statuses.map(status => `
              <option
                value="${esc(status)}"
                ${target.target_status === status
                  ? "selected"
                  : ""
                }
              >
                ${esc(status)}
              </option>
            `).join("")}
          </select>
        `;
      },

      "No productivity targets created yet."
    );

    // ======================================
    // MAIN MANAGER CONTENT
    // ======================================

    return intro(
      "Labor Productivity",
      "Productivity Manager · Targets, output, performance and reports"
    ) + `

      <div class="kpis">
        ${card(
          s.projects.length,
          "Total Projects"
        )}

        ${card(
          s.targets.length,
          "Productivity Targets",
          "highlight"
        )}

        ${card(
          completedTargets,
          "Completed Targets"
        )}

        ${card(
          verifiedWork,
          "Verified Work Entries"
        )}
      </div>

      ${panel(
        "targets",
        "Create Productivity Target",
        targetForm,
        "Select a project and define a measurable productivity goal."
      )}

      ${panel(
        "target-list",
        "Manage Productivity Targets",
        targetsTable
      )}

      ${panel(
        "accomplishments",
        "Worker Accomplishments",

        table(
          [
            "Worker",
            "Target",
            "Quantity",
            "Hours",
            "Status"
          ],

          s.accomplishments.map(a => [
            a.worker_name,
            a.target_name,
            num(a.completed_quantity),
            num(a.work_hours),
            a.accomplishment_status
          ]),

          null,
          "No work accomplishments submitted yet."
        )
      )}

      ${panel(
        "reviews",
        "Create Performance Review",
        reviewForm
      )}

      ${panel(
        "review-history",
        "Performance Review History",

        table(
          [
            "Worker",
            "Score",
            "Rating",
            "Comments"
          ],

          s.reviews.map(review => [
            review.worker_name,
            num(review.productivity_score),
            review.performance_rating,
            review.comments
          ])
        )
      )}

      ${panel(
        "reports",
        "Verified Productivity Reports",

        table(
          [
            "Project",
            "Target",
            "Verified Output",
            "Work Hours",
            "Completion",
            "Output / Hour"
          ],

          s.reports.map(report => [
            report.project_name,
            report.target_name,
            `${num(report.verified_quantity)} ${
              report.unit_of_measure || ""
            }`,
            num(report.verified_hours),
            percent(report.completion_percentage),
            num(report.output_per_hour)
          ]),

          null,
          "Reports appear when verified work becomes available."
        )
      )}
    `;
  }

  // ==========================================
  // SITE SUPERVISOR DASHBOARD
  // ==========================================

  function renderSupervisor() {
    const s = state;

    const pending = s.accomplishments.filter(
      a => a.accomplishment_status === "Submitted"
    );

    const reviewed = s.accomplishments.filter(
      a => [
        "Verified",
        "Rejected"
      ].includes(a.accomplishment_status)
    );

    const completedTasks = s.tasks.filter(
      task => task.task_status === "Completed"
    ).length;

    return intro(
      "Site Productivity",
      "Site Supervisor · Assigned projects, tasks and work verification"
    ) + `

      <div class="kpis">
        ${card(
          s.projects.length,
          "Assigned Projects"
        )}

        ${card(
          s.tasks.length,
          "Assigned Tasks",
          "highlight"
        )}

        ${card(
          completedTasks,
          "Completed Tasks"
        )}

        ${card(
          pending.length,
          "Pending Verification",
          pending.length ? "warning" : ""
        )}
      </div>

      ${panel(
        "projects",
        "Assigned Projects",

        table(
          [
            "Project Code",
            "Project Name",
            "Status"
          ],

          s.projects.map(p => [
            p.project_code,
            p.project_name,
            p.project_status
          ]),

          null,
          "No projects assigned to your account."
        )
      )}

      ${panel(
        "tasks",
        "Assigned Project Tasks",

        table(
          [
            "Project",
            "Task",
            "Status",
            "Progress"
          ],

          s.tasks.map(task => [
            task.project_name,
            task.task_name,
            task.task_status,
            percent(task.progress_percentage)
          ]),

          null,
          "No tasks available for your assigned projects."
        )
      )}

      ${panel(
        "accomplishments",
        "Verify Worker Accomplishments",

        table(
          [
            "Worker",
            "Target",
            "Quantity",
            "Hours",
            "Status"
          ],

          pending.map(a => [
            a.worker_name,
            a.target_name,
            num(a.completed_quantity),
            num(a.work_hours),
            a.accomplishment_status
          ]),

          index => `
            <div class="actions">

              <button
                type="button"
                class="btn verify"
                data-id="${esc(pending[index].id)}"
                data-status="Verified"
              >
                Verify
              </button>

              <button
                type="button"
                class="btn danger verify"
                data-id="${esc(pending[index].id)}"
                data-status="Rejected"
              >
                Reject
              </button>

            </div>
          `,

          "No pending accomplishments to verify."
        )
      )}

      ${panel(
        "history",
        "Verification History",

        table(
          [
            "Worker",
            "Target",
            "Quantity",
            "Status",
            "Remarks"
          ],

          reviewed.map(a => [
            a.worker_name,
            a.target_name,
            num(a.completed_quantity),
            a.accomplishment_status,
            a.remarks
          ]),

          null,
          "No verified or rejected work yet."
        )
      )}

      ${panel(
        "progress",
        "Site Productivity",

        table(
          [
            "Project",
            "Target",
            "Verified Output",
            "Completion"
          ],

          s.reports.map(report => [
            report.project_name,
            report.target_name,
            num(report.verified_quantity),
            percent(report.completion_percentage)
          ]),

          null,
          "No verified productivity data available."
        )
      )}
    `;
  }

  // ==========================================
  // WORKER DASHBOARD
  // ==========================================

  function renderWorker() {
    const s = state;

    if (!s.worker) {
      return intro(
        "My Work Dashboard",
        "Worker · Labor Productivity Management"
      ) + panel(
        "profile",
        "Worker Profile Required",

        empty(
          "Your account is not yet linked to a Worker profile. Contact Workforce Management."
        )
      );
    }

    const verified = s.accomplishments.filter(
      a => a.accomplishment_status === "Verified"
    ).length;

    const activeTargets = s.targets.filter(
      t => ![
        "Completed",
        "Cancelled"
      ].includes(t.target_status)
    );

    // ======================================
    // SUBMISSION FORM
    // ======================================

    const accomplishmentForm = activeTargets.length
      ? `
        <form
          id="accomplishmentForm"
          class="form-grid"
        >

          ${select(
            "target_id",
            "Productivity Target",

            activeTargets.map(target => ({
              value: target.id,
              label: `${target.target_name} (${
                target.unit_of_measure || ""
              })`
            }))
          )}

          ${input(
            "accomplishment_date",
            "Work Date",
            "date",
            "required"
          )}

          ${input(
            "completed_quantity",
            "Completed Quantity",
            "number",
            'required min="0.01" step="0.01"'
          )}

          ${input(
            "work_hours",
            "Hours Worked",
            "number",
            'required min="0.01" max="24" step="0.01"'
          )}

          <label class="field span-all">
            Work Description

            <textarea
              name="remarks"
              rows="3"
              placeholder="Describe your accomplished work"
            ></textarea>
          </label>

          <div class="span-all">
            <button
              type="submit"
              class="btn yellow"
            >
              Submit Accomplishment
            </button>
          </div>

        </form>
      `
      : empty(
        "No active productivity targets for your assigned tasks."
      );

    return intro(
      "My Work Dashboard",
      "Worker · Assigned tasks, accomplishments and performance"
    ) + `

      <div class="kpis">
        ${card(
          s.tasks.length,
          "Assigned Tasks",
          "highlight"
        )}

        ${card(
          s.targets.length,
          "Productivity Targets"
        )}

        ${card(
          s.accomplishments.length,
          "Work Submissions"
        )}

        ${card(
          verified,
          "Verified Work"
        )}
      </div>

      ${panel(
        "profile",
        "My Worker Profile",

        `
          <div class="profile-grid">

            ${[
              ["Name", s.worker.name],
              ["Position", s.worker.position],
              ["Department", s.worker.department],
              ["Status", s.worker.status]
            ].map(([label, value]) => `
              <div class="profile-item">
                <small>${esc(label)}</small>
                <b>${esc(value || "—")}</b>
              </div>
            `).join("")}

          </div>
        `
      )}

      ${panel(
        "tasks",
        "My Assigned Tasks",

        table(
          [
            "Project",
            "Task",
            "Status",
            "Progress"
          ],

          s.tasks.map(task => [
            task.project_name,
            task.task_name,
            task.task_status,
            percent(task.progress_percentage)
          ]),

          null,
          "No tasks assigned to you yet."
        )
      )}

      ${panel(
        "targets",
        "My Productivity Targets",

        table(
          [
            "Target",
            "Quantity",
            "Unit",
            "Start Date",
            "End Date",
            "Status"
          ],

          s.targets.map(target => [
            target.target_name,
            num(target.target_quantity),
            target.unit_of_measure,
            date(target.start_date),
            date(target.end_date),
            target.target_status
          ]),

          null,
          "No productivity targets assigned."
        )
      )}

      ${panel(
        "submit",
        "Submit Accomplished Work",
        accomplishmentForm
      )}

      ${panel(
        "history",
        "My Work History",

        table(
          [
            "Date",
            "Target",
            "Quantity",
            "Hours",
            "Status"
          ],

          s.accomplishments.map(a => [
            date(a.accomplishment_date),
            a.target_name,
            num(a.completed_quantity),
            num(a.work_hours),
            a.accomplishment_status
          ]),

          null,
          "You have not submitted any work yet."
        )
      )}

      ${panel(
        "results",
        "My Productivity Results",

        table(
          [
            "Target",
            "Verified Quantity",
            "Verified Hours",
            "Completion"
          ],

          s.reports.map(report => [
            report.target_name,
            num(report.verified_quantity),
            num(report.verified_hours),
            percent(report.completion_percentage)
          ]),

          null,
          "No verified work results yet."
        )
      )}

      ${panel(
        "reviews",
        "My Performance Reviews",

        table(
          [
            "Review Period",
            "Score",
            "Rating",
            "Comments"
          ],

          s.reviews.map(review => [
            `${
              date(review.review_start_date)
            } – ${
              date(review.review_end_date)
            }`,
            num(review.productivity_score),
            review.performance_rating,
            review.comments
          ]),

          null,
          "No performance reviews available."
        )
      )}
    `;
  }

  // ==========================================
  // SIDEBAR NAVIGATION
  // ==========================================

  function installNav() {
    const links =
      document.querySelectorAll(".nav-link");

    function activate() {
      const current = window.location.hash ||
        "#overview";

      links.forEach(link => {
        link.classList.toggle(
          "active",
          link.getAttribute("href") === current
        );
      });
    }

    links.forEach(link => {
      link.addEventListener("click", () => {
        links.forEach(item => {
          item.classList.remove("active");
        });

        link.classList.add("active");
      });
    });

    activate();

    const hash = window.location.hash;

    if (hash) {
      const target = document.getElementById(
        hash.slice(1)
      );

      if (target) {
        requestAnimationFrame(() => {
          target.scrollIntoView({
            block: "start"
          });
        });
      }
    }
  }

  // ==========================================
  // CREATE TARGET - FORM VALIDATION
  // ==========================================

  async function submitTarget(formElement) {
    const b = formData(formElement);

    // PROJECT VALIDATION

    if (!validId(b.project_id)) {
      flash(
        "Please select a valid project.",
        true
      );

      return;
    }

    // TARGET NAME VALIDATION

    if (!String(b.target_name || "").trim()) {
      flash(
        "Target Name is required.",
        true
      );

      return;
    }

    // QUANTITY VALIDATION

    if (!positive(b.target_quantity)) {
      flash(
        "Target Quantity must be greater than zero.",
        true
      );

      return;
    }

    // UNIT OF MEASURE VALIDATION

    if (!String(b.unit_of_measure || "").trim()) {
      flash(
        "Unit of Measure is required.",
        true
      );

      return;
    }

    // START DATE VALIDATION

    if (!validDate(b.start_date)) {
      flash(
        "Please select a valid Start Date.",
        true
      );

      return;
    }

    // END DATE VALIDATION

    if (!validDate(b.end_date)) {
      flash(
        "Please select a valid End Date.",
        true
      );

      return;
    }

    // DATE RANGE VALIDATION

    if (b.end_date < b.start_date) {
      flash(
        "End Date cannot be earlier than Start Date.",
        true
      );

      return;
    }

    // OPTIONAL TASK VALIDATION

    if (
      b.task_id &&
      !validId(b.task_id)
    ) {
      flash(
        "Please select a valid task.",
        true
      );

      return;
    }

    const payload = {
      project_id: Number(b.project_id),

      task_id: b.task_id
        ? Number(b.task_id)
        : null,

      target_name: String(
        b.target_name
      ).trim(),

      target_quantity: Number(
        b.target_quantity
      ),

      unit_of_measure: String(
        b.unit_of_measure
      ).trim(),

      start_date: b.start_date,
      end_date: b.end_date,

      description: String(
        b.description || ""
      ).trim()
    };

    // Debugging: no credentials or secrets logged.
    console.log(
      "CREATE TARGET REQUEST:",
      payload
    );

    await perform(
      formElement,
      `${API}/targets`,
      "POST",
      "Productivity target created successfully.",
      payload
    );
  }

  // ==========================================
  // WORKER ACCOMPLISHMENT VALIDATION
  // ==========================================

  async function submitWork(formElement) {
    const b = formData(formElement);

    if (!validId(b.target_id)) {
      flash(
        "Please select a productivity target.",
        true
      );

      return;
    }

    if (!validDate(b.accomplishment_date)) {
      flash(
        "Please select a valid work date.",
        true
      );

      return;
    }

    if (!positive(b.completed_quantity)) {
      flash(
        "Completed Quantity must be greater than zero.",
        true
      );

      return;
    }

    if (
      !positive(b.work_hours) ||
      Number(b.work_hours) > 24
    ) {
      flash(
        "Work Hours must be greater than zero and not more than 24.",
        true
      );

      return;
    }

    const payload = {
      target_id: Number(b.target_id),

      accomplishment_date:
        b.accomplishment_date,

      completed_quantity: Number(
        b.completed_quantity
      ),

      work_hours: Number(b.work_hours),

      remarks: String(
        b.remarks || ""
      ).trim()
    };

    await perform(
      formElement,
      `${API}/accomplishments`,
      "POST",
      "Work submitted for verification.",
      payload
    );
  }

  // ==========================================
  // PERFORMANCE REVIEW VALIDATION
  // ==========================================

  async function submitReview(formElement) {
    const b = formData(formElement);

    if (!validId(b.worker_id)) {
      flash(
        "Please select a worker.",
        true
      );

      return;
    }

    if (
      !validDate(b.review_start_date) ||
      !validDate(b.review_end_date)
    ) {
      flash(
        "Please enter valid review dates.",
        true
      );

      return;
    }

    if (
      b.review_end_date <
      b.review_start_date
    ) {
      flash(
        "Review End Date cannot be earlier than Start Date.",
        true
      );

      return;
    }

    const score = Number(
      b.productivity_score
    );

    if (
      b.productivity_score === "" ||
      !Number.isFinite(score) ||
      score < 0 ||
      score > 100
    ) {
      flash(
        "Productivity Score must be between 0 and 100.",
        true
      );

      return;
    }

    const ratings = [
      "Excellent",
      "Good",
      "Average",
      "Needs Improvement"
    ];

    if (!ratings.includes(b.performance_rating)) {
      flash(
        "Please select a valid performance rating.",
        true
      );

      return;
    }

    await perform(
      formElement,
      `${API}/reviews`,
      "POST",
      "Performance review saved successfully.",

      {
        worker_id: Number(b.worker_id),

        review_start_date:
          b.review_start_date,

        review_end_date:
          b.review_end_date,

        productivity_score: score,

        performance_rating:
          b.performance_rating,

        comments: String(
          b.comments || ""
        ).trim()
      }
    );
  }

  // ==========================================
  // FORM EVENT HANDLERS
  // ==========================================

  function attachEvents() {
    // CREATE TARGET

    const targetForm = $("targetForm");

    if (targetForm) {
      const projectSelect =
        targetForm.elements.namedItem(
          "project_id"
        );

      const taskSelect = $("taskSelect");

      const refreshTasks = () => {
        const projectId = Number(
          projectSelect.value
        );

        const matching = state.tasks.filter(
          task =>
            Number(task.project_id) === projectId
        );

        taskSelect.innerHTML = `
          <option value="">
            No specific task
          </option>

          ${matching.map(task => `
            <option value="${esc(task.id)}">
              ${esc(task.task_name)}
            </option>
          `).join("")}
        `;
      };

      projectSelect.addEventListener(
        "change",
        refreshTasks
      );

      refreshTasks();

      targetForm.addEventListener(
        "submit",
        async event => {
          event.preventDefault();

          await submitTarget(targetForm);
        }
      );
    }

    // PERFORMANCE REVIEW

    $("reviewForm")?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        await submitReview(
          event.currentTarget
        );
      }
    );

    // WORKER SUBMISSION

    $("accomplishmentForm")?.addEventListener(
      "submit",
      async event => {
        event.preventDefault();

        await submitWork(
          event.currentTarget
        );
      }
    );

    // ======================================
    // UPDATE TARGET STATUS
    // ======================================

    document.querySelectorAll(".targetStatus")
      .forEach(element => {
        element.addEventListener(
          "change",
          async () => {
            const previous =
              element.dataset.previous;

            element.disabled = true;

            try {
              await send(
                `${API}/targets/${
                  encodeURIComponent(element.dataset.id)
                }`,
                "PUT",

                {
                  target_status:
                    element.value
                }
              );

              notice = {
                message:
                  "Target status updated successfully.",
                error: false
              };

              await load();

            } catch (error) {
              element.value = previous;

              flash(
                error.message,
                true
              );

            } finally {
              if (element.isConnected) {
                element.disabled = false;
              }
            }
          }
        );
      });

    // ======================================
    // VERIFY / REJECT WORK
    // ======================================

    document.querySelectorAll(".verify")
      .forEach(button => {
        button.addEventListener(
          "click",
          async () => {
            const status =
              button.dataset.status;

            const id =
              button.dataset.id;

            const remarks = window.prompt(
              status === "Rejected"
                ? "Enter rejection reason:"
                : "Enter verification remarks (optional):"
            );

            if (remarks === null) {
              return;
            }

            if (
              status === "Rejected" &&
              !remarks.trim()
            ) {
              flash(
                "Rejection reason is required.",
                true
              );

              return;
            }

            button.disabled = true;

            try {
              await send(
                `${API}/accomplishments/${
                  encodeURIComponent(id)
                }/verify`,
                "PUT",

                {
                  status,
                  remarks: remarks.trim()
                }
              );

              notice = {
                message:
                  `Accomplishment ${status.toLowerCase()} successfully.`,
                error: false
              };

              await load();

            } catch (error) {
              flash(
                error.message,
                true
              );

            } finally {
              if (button.isConnected) {
                button.disabled = false;
              }
            }
          }
        );
      });

    installNav();
  }

  // ==========================================
  // SUBMIT DATA TO EXISTING API
  // ==========================================

  async function perform(
    formElement,
    path,
    method,
    message,
    payload
  ) {
    const button = formElement.querySelector(
      '[type="submit"]'
    );

    if (button) {
      button.disabled = true;
    }

    try {
      await send(
        path,
        method,
        payload
      );

      notice = {
        message,
        error: false
      };

      await load();

    } catch (error) {
      console.error(
        "BUILDORA FORM ERROR:",
        error
      );

      flash(
        error.message,
        true
      );

    } finally {
      if (button?.isConnected) {
        button.disabled = false;
      }
    }
  }

  // ==========================================
  // LOAD DASHBOARD
  // ==========================================

  async function load() {
    if (!root || loading) {
      return;
    }

    loading = true;

    try {
      const data = await api(
        `${API}/dashboard`
      );

      state = normalize(data);

      switch (ROLE) {
        case "manager":
          root.innerHTML =
            renderManager();
          break;

        case "supervisor":
          root.innerHTML =
            renderSupervisor();
          break;

        case "worker":
          root.innerHTML =
            renderWorker();
          break;

        default:
          root.innerHTML = empty(
            "Invalid dashboard role."
          );
      }

      attachEvents();

      if (notice) {
        const saved = notice;

        notice = null;

        flash(
          saved.message,
          saved.error
        );
      }

    } catch (error) {
      console.error(
        "BUILDORA DASHBOARD ERROR:",
        error
      );

      root.innerHTML = `
        <div class="feedback error">

          <strong>
            Dashboard Data Unavailable
          </strong>

          <p>${esc(error.message)}</p>

          <p>
            Check the XianFire terminal
            for database errors.
          </p>

          <button
            type="button"
            class="btn danger"
            id="retry"
          >
            Try Again
          </button>

        </div>
      `;

      $("retry")?.addEventListener(
        "click",
        load
      );

    } finally {
      loading = false;
    }
  }

  // ==========================================
  // LOGOUT
  // ==========================================

  $("logout")?.addEventListener(
    "click",
    async () => {
      try {
        const response = await fetch(
          "/logout",
          {
            method: "POST",
            credentials: "same-origin"
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to log out."
          );
        }

        window.location.assign(
          "/login"
        );

      } catch (error) {
        window.alert(
          error.message
        );
      }
    }
  );

  // ==========================================
  // INITIALIZE APPLICATION
  // ==========================================

  if (root) {
    root.innerHTML = `
      <section class="panel">
        Loading BUILDORA dashboard...
      </section>
    `;

    load();
  }

})();
