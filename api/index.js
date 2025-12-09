const serverless = require("serverless-http");
const app = require("../server");   // import your express app

module.exports = serverless(app);
