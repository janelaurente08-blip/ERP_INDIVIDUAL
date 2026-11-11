
import { Router } from "express";

import authRoutes from "./auth.js";
import productivityRoutes from "./productivity/index.js";

const router = Router();

// Homepage
router.get("/", (req, res) => {
  res.redirect("/login");
});

// Authentication
router.use(authRoutes);

// Productivity Module
router.use("/productivity", productivityRoutes);

export default router;
