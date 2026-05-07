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

const renderUnsubscribePage = (req) => {
  const status = String(req.query.status || "success").trim();
  const email = String(req.query.email || "")
    .trim()
    .toLowerCase();
  const campaign = String(req.query.campaign || "").trim();
  const canSubmitFeedback = status === "success" && email;

  const statusText =
    status === "invalid-email"
      ? "The unsubscribe link was invalid."
      : "You have been successfully removed from this subscriber list and won't receive any further emails from us.";

  const options = [
    ["not_relevant", "Your emails are not relevant to me"],
    ["too_frequent", "Your emails are too frequent"],
    ["never_subscribed", "I didn't sign up for this"],
    ["spam", "These emails look like spam"],
    ["other", "I've got other reasons"],
  ];

  // Prepare JSON-safe values for embedding in JavaScript
  const emailJson = JSON.stringify(email);
  const campaignJson = JSON.stringify(campaign);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Unsubscribe Feedback</title>
    <style>
      body {
        margin: 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        background-color: #fff;
        color: #1e293b;
        display: flex;
        align-items: center;
        justify-content: center;
        min-height: 100vh;
      }
      .container {
        width: 100%;
        max-width: 800px;
        padding: 40px;
        text-align: center;
      }
      h1 { font-size: 48px; font-weight: 800; margin-bottom: 32px; color: #1e293b; }
      .card {
        background: #fff;
        border: 1px solid #f1f5f9;
        border-radius: 12px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        padding: 48px;
        text-align: left;
      }
      .msg { font-size: 18px; color: #475569; line-height: 1.6; margin-bottom: 24px; }
      .options { display: flex; flex-direction: column; gap: 16px; margin-bottom: 40px; }
      .option {
        width: 100%;
        padding: 16px 20px;
        border: 1px solid #e2e8f0;
        border-radius: 8px;
        background: #fff;
        text-align: left;
        font-size: 16px;
        color: #475569;
        cursor: pointer;
        transition: all 0.2s;
      }
      .option:hover { border-color: #cbd5e1; background: #f8fafc; }
      .option.selected { border-color: #c7d2fe; background: #eef2ff; color: #4338ca; }
      .footer { display: flex; align-items: center; justify-content: space-between; }
      .btn {
        background-color: #b2b7f1;
        color: white;
        border: none;
        padding: 12px 40px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 14px;
      }
      .btn:disabled { opacity: 0.5; cursor: not-allowed; }
      .success-msg { color: #4338ca; font-weight: 600; font-size: 18px; display: none; }
      .error-msg { color: #dc2626; font-size: 14px; margin-top: 8px; }
      .hidden { display: none; }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Thank you!</h1>
      <div class="card">
        <p class="msg">${statusText}</p>
        ${canSubmitFeedback ? `<p class="msg" style="margin-bottom: 40px;">Please take a moment and let us know why you unsubscribed, so that we can set it right.</p>` : ""}
        
        <div id="feedback-form" class="${canSubmitFeedback ? "" : "hidden"}">
          <div class="options">
            ${options.map(([val, lbl]) => `<button type="button" class="option" data-val="${val}">${lbl}</button>`).join("")}
          </div>
          <div class="footer">
            <div id="error" class="error-msg"></div>
            <button id="submit" class="btn" disabled>Submit</button>
          </div>
        </div>
        <div id="success" class="success-msg text-center">✓ Feedback submitted. Thank you!</div>
      </div>
    </div>
    <script>
      let selected = null;
      const btns = document.querySelectorAll('.option');
      const submit = document.getElementById('submit');
      const form = document.getElementById('feedback-form');
      const success = document.getElementById('success');
      const error = document.getElementById('error');

      btns.forEach(b => {
        b.onclick = () => {
          selected = b.dataset.val;
          btns.forEach(x => x.classList.toggle('selected', x === b));
          submit.disabled = false;
        };
      });

      submit.onclick = async () => {
        if (!selected) {
          error.innerText = 'Please choose a reason before submitting.';
          return;
        }

        submit.disabled = true;
        submit.innerText = 'Submitting...';
        error.innerText = '';
        
        try {
          console.log('Submitting feedback with:', { email: ${emailJson}, campaign: ${campaignJson}, reason: selected });
          
          const res = await fetch('/api/campaigns/unsubscribe/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: ${emailJson},
              campaign: ${campaignJson},
              reason: selected,
              comments: ""
            })
          });
          
          console.log('Response status:', res.status);
          console.log('Response headers:', res.headers.get('content-type'));
          
          let data;
          try {
            data = await res.json();
          } catch (parseError) {
            const text = await res.text();
            console.error('Failed to parse response as JSON. Got:', text.slice(0, 500));
            throw new Error('Invalid response from server: ' + text.slice(0, 100));
          }
          
          if (!res.ok) throw new Error(data.error || data.message || 'Failed to save feedback');
          
          form.classList.add('hidden');
          success.style.display = 'block';
        } catch (e) {
          console.error('Error:', e);
          error.innerText = e.message || 'An error occurred. Please try again.';
          submit.disabled = false;
          submit.innerText = 'Submit';
        }
      };
    </script>
  </body>
</html>`;
};

const parseAllowedOrigins = () => {
  const configuredOrigins = String(process.env.CORS_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return [
    "http://localhost:5173",
    "http://localhost:5174",
  ];
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

// Backward-compatible unsubscribe landing page used in sent emails.
app.get("/unsubscribe", (req, res) => {
  return res.status(200).send(renderUnsubscribePage(req));
});

app.use((req, res) => {
  return res.status(404).json({ message: "Route not found" });
});

// Start server
const bootstrap = async () => {
  await ensureUserLastLoginColumn();
  await ensureUserAvatarColumn();
  await ensureCampaignUpdatedByColumn();
  await ensureAuthSecurityTables();
  await ensureContactsUtf8mb4();

  app.listen(3001, () => {
    console.log("Server is running on port 3001");
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
