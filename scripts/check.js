//server/scripts/check.js

require("dotenv").config();
const connectDB = require("../config/db");
const User = require("../modules/User");
const Category = require("../modules/Category");
const Product = require("../modules/Product");
const CaseStudy = require("../modules/CaseStudy");
const BlogCategory = require("../modules/BlogCategory");
const BlogPost = require("../modules/BlogPost");
const Lead = require("../modules/Lead");
const Inquiry = require("../modules/Inquiry");

(async () => {
  await connectDB();
  const result = {
    users: await User.countDocuments(),
    categories: await Category.countDocuments(),
    products: await Product.countDocuments(),
    caseStudies: await CaseStudy.countDocuments(),
    blogCategories: await BlogCategory.countDocuments(),
    blogPosts: await BlogPost.countDocuments(),
    leads: await Lead.countDocuments(),
    inquiries: await Inquiry.countDocuments()
  };
  console.log(result);
  process.exit(0);
})();
