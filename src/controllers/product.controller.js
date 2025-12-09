// server/src/controllers/product.controller.js
import Product from "../models/Product.js";
import { deleteImage } from "../utils/deleteImage.js";

// PATCH /api/products/:id/images
// Body: { images: [{url, publicId}, ...] }
export async function replaceProductImages(req, res) {
  try {
    const { images } = req.body;
    if (!Array.isArray(images)) {
      return res.status(400).json({ error: "images[] required" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // delete all old images on Cloudinary
    for (const img of product.images || []) {
      await deleteImage(img.publicId);
    }

    // set new images
    product.images = images;
    await product.save();

    res.json({ ok: true, images: product.images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not update images" });
  }
}


// DELETE /api/products/:id/images/:publicId
export async function deleteOneProductImage(req, res) {
  try {
    const { id, publicId } = req.params;
    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: "Product not found" });

    // delete on Cloudinary
    await deleteImage(publicId);

    // remove from the product doc
    product.images = (product.images || []).filter(img => img.publicId !== publicId);
    await product.save();

    res.json({ ok: true, images: product.images });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Could not delete image" });
  }
}

