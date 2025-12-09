//server/scripts/seed.js

require("dotenv").config();
const bcrypt = require("bcrypt");
const slugify = require("slugify");
const connectDB = require("../config/db");

// IMPORTANT: you said your models are in /modules (not /models)
const User = require("../modules/User");
const Category = require("../modules/Category");
const Product = require("../modules/Product");
const CaseStudy = require("../modules/CaseStudy");
const BlogCategory = require("../modules/BlogCategory");
const BlogPost = require("../modules/BlogPost");
const Lead = require("../modules/Lead");
const Inquiry = require("../modules/Inquiry");

async function upsertOne(model, where, data) {
  await model.updateOne(where, { $set: data }, { upsert: true });
}

async function main() {
  await connectDB();

  // 1) Admin user
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@oceanstella.com";
  const adminPass = process.env.SEED_ADMIN_PASSWORD || "Admin#12345";
  const passwordHash = await bcrypt.hash(adminPass, 10);
  await upsertOne(User, { email: adminEmail }, {
    name: "Ocean Stella Admin",
    email: adminEmail,
    passwordHash,
    role: "superadmin",
    status: "active",
  });

  // 2) Categories
  const catData = [
    { name: "Bottles", slug: "bottles", description: "Hydration & drinkware" },
    { name: "Packaging", slug: "packaging", description: "Boxes, bags, mailers" },
    { name: "Accessories", slug: "accessories", description: "Lifestyle add-ons" },
  ];
  for (const c of catData) await upsertOne(Category, { slug: c.slug }, c);

  const cats = await Category.find().lean();
  const catBySlug = Object.fromEntries(cats.map(c => [c.slug, c]));

  // 3) Products
  const prodData = [
    {
      name: "Stainless Steel Water Bottle 1L",
      slug: "stainless-steel-bottle-1l",
      status: "published",
      categorySlug: "bottles",
      images: [{ url: "https://via.placeholder.com/800x600", alt: "Bottle" }],
      summary: "Durable, insulated 1L bottle",
      description: "**Keeps cold 24h**. 304 stainless steel, leak-proof.",
      specs: [{ key: "Capacity", value: "1 L" }, { key: "Material", value: "304 SS" }],
      tags: ["bottle","steel"],
      featured: true,
      seo: { title: "1L Steel Bottle", description: "Insulated bottle" },
      publishedAt: new Date()
    },
    {
      name: "Eco Mailer Bag (Large)",
      slug: "eco-mailer-bag-large",
      status: "published",
      categorySlug: "packaging",
      images: [{ url: "https://via.placeholder.com/800x600", alt: "Mailer Bag" }],
      summary: "Recycled material courier mailer",
      description: "Tear-resistant, recyclable, matte finish.",
      specs: [{ key: "Size", value: "Large" }, { key: "Material", value: "Recycled PE" }],
      tags: ["packaging","eco"],
      seo: { title: "Eco Mailer Bag", description: "Large recycled mailer" },
      publishedAt: new Date()
    }
  ];

  for (const p of prodData) {
    const categoryId = catBySlug[p.categorySlug]?._id || null;
    await upsertOne(Product, { slug: p.slug }, { ...p, categoryId });
  }

  // 4) Case studies
  const csData = [
    {
      title: "Retail Hydration Launch (UAE)",
      slug: "retail-hydration-launch-uae",
      subtitle: "From concept to shelf in 6 weeks",
      heroImage: "https://via.placeholder.com/1200x600",
      tags: ["hydration","retail","uae"],
      summary: "How we delivered a bottle line under tight timelines.",
      content: "# Overview\n- Supplier sourcing\n- Packaging ops\n- QC & logistics",
      published: true,
      publishedAt: new Date()
    }
  ];
  for (const cs of csData) await upsertOne(CaseStudy, { slug: cs.slug }, cs);

  // 5) Blog
  const blogCats = [
    { name: "Insights", slug: "insights" },
    { name: "Guides", slug: "guides" }
  ];
  for (const bc of blogCats) await upsertOne(BlogCategory, { slug: bc.slug }, bc);

  const admin = await User.findOne({ email: adminEmail }).lean();
  const bcats = await BlogCategory.find().lean();
  const bcatBySlug = Object.fromEntries(bcats.map(c => [c.slug, c]));

  const posts = [
    {
      title: "How We Reduced Packaging Costs by 18%",
      slug: "reduce-packaging-costs-18",
      excerpt: "Quick wins for material + supplier optimization.",
      content: "## Intro\nWe benchmarked materials and negotiated supplier terms...",
      coverImage: "https://via.placeholder.com/1200x600",
      tags: ["packaging","cost"],
      categorySlug: "insights",
      authorId: admin?._id,
      status: "published",
      publishedAt: new Date()
    },
    {
      title: "Bottle Sourcing Guide 2025",
      slug: "bottle-sourcing-guide-2025",
      excerpt: "A simple checklist for fast, quality-first sourcing.",
      content: "## Checklist\n1. Material spec\n2. Insulation rating\n3. MOQ...\n",
      coverImage: "https://via.placeholder.com/1200x600",
      tags: ["bottles","sourcing"],
      categorySlug: "guides",
      authorId: admin?._id,
      status: "published",
      publishedAt: new Date()
    }
  ];
  for (const post of posts) {
    const categoryId = bcatBySlug[post.categorySlug]?._id || null;
    await upsertOne(BlogPost, { slug: post.slug }, { ...post, categoryId });
  }

  // 6) Leads/Inquiries (dummy)
  const anyProduct = await Product.findOne().lean();
  await upsertOne(Lead, { email: "lead@example.com", createdAt: { $exists: true } }, {
    name: "John Smith", email: "lead@example.com", phone: "+1 555-555",
    message: "Looking for wholesale pricing.", source: "website", status: "new"
  });
  if (anyProduct) {
    await Inquiry.create({
      productId: anyProduct._id,
      name: "Sarah Khan",
      email: "sarah@example.com",
      phone: "+971 55 000 0000",
      message: "Need 2,000 units with custom logo.",
      quantity: 2000,
      status: "new"
    }).catch(() => {});
  }

  // Final counts
  const counts = await Promise.all([
    User.countDocuments(), Category.countDocuments(), Product.countDocuments(),
    CaseStudy.countDocuments(), BlogCategory.countDocuments(), BlogPost.countDocuments(),
    Lead.countDocuments(), Inquiry.countDocuments()
  ]);
  console.log({
    users: counts[0], categories: counts[1], products: counts[2],
    caseStudies: counts[3], blogCategories: counts[4], blogPosts: counts[5],
    leads: counts[6], inquiries: counts[7]
  });

  console.log("🌱 Seed complete");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
