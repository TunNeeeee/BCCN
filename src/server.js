const express = require("express");
const cors = require("cors");
const path = require("path");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const procedureRoutes = require("./routes/procedureRoutes");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/procedures", procedureRoutes);

app.use((error, _req, res, _next) => {
  res.status(500).json({
    message: "Unexpected server error",
    error: error.message,
  });
});

if (require.main === module) {
  app.listen(env.port, () => {
    console.log(`Server is running at http://localhost:${env.port}`);
  });
}

module.exports = app;
