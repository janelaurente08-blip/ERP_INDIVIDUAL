
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
    



import { Router } from "express";
import { fileURLToPath } from "node:url";

import { requireAuth } from "../../middleware/auth.js";
import { requireRole, ROLES } from "../../middleware/role.js";

import {
  dashboard,
  createTarget,
  updateTarget,
  submitAccomplishment,
  verifyAccomplishment,
  createReview,
  getReports
} from "../../controllers/productivity/productivitycontroller.js";

const router = Router();

// ==========================================
// REQUIRE LOGIN FOR ALL PRODUCTIVITY ROUTES
// ==========================================
router.use(requireAuth);

// ==========================================
// PRODUCTIVITY MANAGER DASHBOARD
// ==========================================
router.get(
  "/manager",
  requireRole(ROLES.MANAGER),
  (req, res) => {
    res.render("productivity/productivity-manager", {
      title: "Productivity Manager"
    });
  }
);

// ==========================================
// SITE SUPERVISOR DASHBOARD
// ==========================================
router.get(
  "/supervisor",
  requireRole(ROLES.SUPERVISOR),
  (req, res) => {
    res.render("productivity/site-supervisor", {
      title: "Site Supervisor"
    });
  }
);

// ==========================================
// WORKER DASHBOARD
// ==========================================
router.get(
  "/worker",
  requireRole(ROLES.WORKER),
  (req, res) => {
    res.render("productivity/worker", {
      title: "Worker Dashboard"
    });
  }
);

// ==========================================
// SERVE DASHBOARD JAVASCRIPT
// ==========================================
router.get("/ui.js", (req, res) => {
  res.sendFile(
    fileURLToPath(
      new URL(
        "../../views/productivity/ui.js",
        import.meta.url
      )
    )
  );
});

// ==========================================
// DASHBOARD DATA API
// ==========================================
router.get(
  "/api/dashboard",
  requireRole(
    ROLES.MANAGER,
    ROLES.SUPERVISOR,
    ROLES.WORKER
  ),
  dashboard
);

// ==========================================
// MANAGER - PRODUCTIVITY TARGETS
// ==========================================
router.post(
  "/api/targets",
  requireRole(ROLES.MANAGER),
  createTarget
);

router.put(
  "/api/targets/:id",
  requireRole(ROLES.MANAGER),
  updateTarget
);

// ==========================================
// WORKER - WORK ACCOMPLISHMENTS
// ==========================================
router.post(
  "/api/accomplishments",
  requireRole(ROLES.WORKER),
  submitAccomplishment
);

// ==========================================
// SUPERVISOR - VERIFY ACCOMPLISHMENTS
// ==========================================
router.put(
  "/api/accomplishments/:id/verify",
  requireRole(
    ROLES.SUPERVISOR,
    ROLES.MANAGER
  ),
  verifyAccomplishment
);

// ==========================================
// MANAGER - PERFORMANCE REVIEW
// ==========================================
router.post(
  "/api/reviews",
  requireRole(ROLES.MANAGER),
  createReview
);

// ==========================================
// MANAGER - REPORTS
// ==========================================
router.get(
  "/api/reports",
  requireRole(ROLES.MANAGER),
  getReports
);


router.get("/dashboard.css", (req, res) => {
  res.sendFile(
    fileURLToPath(
      new URL(
        "../../views/productivity/dashboard.css",
        import.meta.url
      )
    )
  );
});


export default router;
