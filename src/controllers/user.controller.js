// server/src/controllers/user.controller.js
import User from "../models/User.js";
import { deleteImage } from "../utils/deleteImage.js";

// PATCH /api/users/me/avatar
export async function updateMyAvatar(req, res) {
  try {
    const { url, publicId } = req.body; // from /api/upload result
    if (!url || !publicId) {
      return res.status(400).json({ error: "url & publicId required" });
    }

    const me = await User.findById(req.user._id);
    if (!me) return res.status(404).json({ error: "User not found" });

    // 1) delete old avatar on Cloudinary (if any)
    await deleteImage(me?.avatar?.publicId);

    // 2) set new avatar
    me.avatar = { url, publicId };
    await me.save();

    res.json({ ok: true, avatar: me.avatar });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not update avatar" });
  }
}
