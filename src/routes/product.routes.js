// server/src/routes/product.routes.js
import express from "express";
import {
  replaceProductImages,
  deleteOneProductImage,
} from "../controllers/product.controller.js";
import { requireAuth, requireAdmin } from "../middleware/requireAuth.js"; // use your names

const router = express.Router();

router.patch("/:id/images", requireAuth, requireAdmin, replaceProductImages);
router.delete("/:id/images/:publicId", requireAuth, requireAdmin, deleteOneProductImage);

export default router;
