import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import helmet from "helmet";

// import { etagMiddleware } from "./middleware/etagMiddleware.js";
// import { publicRateLimiter } from "./middleware/rateLimit.js";
// import { requestLogger } from "./middleware/logger.js";

import publicRouter from "./routes/public.js";

dotenv.config(); // keep for local dev, but PORT comes from Render in production

const app = express();

// Basic parsers
app.use(express.json({ limit: process.env.JSON_LIMIT || "1mb" }));
app.use(express.urlencoded({ extended: true }));

// CORS
const allowedOrigins = [
  'https://www.savingharbor.com',
  'https://www.savingharbor.com',
  'https://dev.savingharbor.com',
];

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error("Not allowed by CORS"));
    },
    methods: ["GET", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization",'X-Requested-With'],
    credentials: true,
    optionsSuccessStatus: 204,
  })
);

// Logging
// if (process.env.NODE_ENV !== "test") {
//   app.use(requestLogger);
// }

// Public routes with ETag & optional rate limiting
// app.use(etagMiddleware);
// app.use("/public/v1", publicRateLimiter, publicRouter);
app.use("/public/v1", publicRouter);
// Static uploads
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

// Helmet for security on API routes
app.use(
  "/api",
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ ok: true, uptime: process.uptime() });
});

// Root route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to Handpicked Client Backend API" });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// Error handler
app.use((err, req, res, next) => {
  const status = err.status || 500;
  const message = status === 500 ? "Internal Server Error" : err.message;
  if (process.env.NODE_ENV !== "test") {
    console.error(err);
  }
  res.status(status).json({ error: message });
});

// Listen on port from Render
const PORT = process.env.PORT;
console.log("Render PORT =", process.env.PORT);
if (!PORT) {
  console.error(
    "🚨 PORT environment variable not set. Render requires this to bind."
  );
  process.exit(1);
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Server running on port ${PORT}`);
});
