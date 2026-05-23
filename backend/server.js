import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import session from "express-session";
import authRoutes from "./routes/authRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import contactGroupRoutes from "./routes/contactGroupRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import userAdminRoutes from "./routes/userAdminRoutes.js";
import { startCampaignScheduler } from "./controllers/campaignController.js";
import { startDisposableDomainAutoUpdate } from "./utils/disposableDomainService.js";
import {
  ensureAuthSecurityTables,
  ensureCampaignUpdatedByColumn,
  ensureContactsUtf8mb4,
  ensureUserAvatarColumn,
  ensureUserLastLoginColumn,
} from "./utils/userSchemaMaintenance.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env even if the process starts from another folder.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

const escapeHtml = (value = "") =>
  String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");

const parseAllowedOrigins = () => {
  const configuredOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return ["http://localhost:5173", "http://localhost:5174"];
};

const allowedOrigins = parseAllowedOrigins();

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Debug middleware to log all requests to feedback endpoint
app.use((req, res, next) => {
  if (req.path === "/api/campaigns/unsubscribe/feedback") {
    console.log("[DEBUG] Incoming request to unsubscribe feedback:");
    console.log("  Method:", req.method);
    console.log("  Path:", req.path);
    console.log("  URL:", req.originalUrl);
    console.log("  Content-Type:", req.headers["content-type"]);
    console.log("  Body keys:", Object.keys(req.body));
  }
  next();
});
app.use(
  session({
    name: "ems.sid",
    secret: String(
      process.env.SESSION_SECRET || process.env.JWT_SECRET || "change-me",
    ).trim(),
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: String(process.env.COOKIE_SECURE || "false").trim() === "true",
      sameSite: String(process.env.COOKIE_SAME_SITE || "lax").trim(),
      maxAge: 1000 * 60 * 60 * 12,
    },
  }),
);
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", contactRoutes);
app.use("/api", contactGroupRoutes);
app.use("/api", templateRoutes);
app.use("/api", campaignRoutes);
app.use("/api", analyticsRoutes);
app.use("/api", userAdminRoutes);

// Backward-compatible unsubscribe routing for older emails
app.get("/unsubscribe", (req, res) => {
  const email = String(req.query.email || "").trim();
  const campaign = String(req.query.campaign || "").trim();

  // Forward to the API endpoint that handles unsubscription and then redirects to the UI
  const redirectUrl = new URL(
    `${req.protocol}://${req.get("host")}/api/campaigns/unsubscribe`,
  );
  if (email) redirectUrl.searchParams.set("email", email);
  if (campaign) redirectUrl.searchParams.set("campaign", campaign);

  return res.redirect(302, redirectUrl.toString());
});

app.use((req, res) => {
  return res.status(404).json({ message: "Route not found" });
});

// Global error handler for production readiness
app.use((err, req, res, next) => {
  console.error("[Global Error Handler]:", err);
  const status = err.statusCode || 500;
  const message =
    process.env.NODE_ENV === "production"
      ? "Internal Server Error"
      : err.message;
  res.status(status).json({ success: false, message, error: message });
});

// Handle uncaught exceptions and unhandled rejections to prevent crashing
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
});
process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
});

const PORT = process.env.PORT || 3001;

// Start server
const bootstrap = async () => {
  await ensureUserLastLoginColumn();
  await ensureUserAvatarColumn();
  await ensureCampaignUpdatedByColumn();
  await ensureAuthSecurityTables();
  await ensureContactsUtf8mb4();

  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startCampaignScheduler();

    startDisposableDomainAutoUpdate().catch((error) => {
      console.error(
        `[disposable-domains] auto-update service failed to start: ${error.message}`,
      );
    });
  });
};

bootstrap().catch((error) => {
  console.error(`[bootstrap] startup failed: ${error.message}`);
  process.exit(1);
});
