// server/src/routes/user.routes.js
import express from "express";
import { updateMyAvatar } from "../controllers/user.controller.js";
import { requireAuth } from "../middleware/requireAuth.js"; // <— use your real auth middleware name

const router = express.Router();

// replace avatar (deletes old file on Cloudinary first)
router.patch("/me/avatar", requireAuth, updateMyAvatar);

export default router;
