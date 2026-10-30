const serverless = require("serverless-http");
const app = require("../../src/server");

exports.handler = serverless(app, {
  basePath: "/.netlify/functions/api",
  binary: [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
});
