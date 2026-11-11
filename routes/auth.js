
import { Router } from "express";

import {
  loginPage,
  loginUser,
  logoutUser
} from "../controllers/authcontroller.js";

const router = Router();

// Login
router.get("/login", loginPage);
router.post("/login", loginUser);

// Logout
router.post("/logout", logoutUser);

export default router;
