import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import contactRoutes from "./routes/contactRoutes.js";
import contactGroupRoutes from "./routes/contactGroupRoutes.js";
import templateRoutes from "./routes/templateRoutes.js";
import campaignRoutes from "./routes/campaignRoutes.js";
import analyticsRoutes from "./routes/analyticsRoutes.js";
import { startCampaignScheduler } from "./controllers/campaignController.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Always load backend/.env even if the process starts from another folder.
dotenv.config({ path: path.join(__dirname, ".env") });

const app = express();

// Middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);
app.use(express.json());

// Routes
app.use("/api/auth", authRoutes);
app.use("/api", contactRoutes);
app.use("/api", contactGroupRoutes);
app.use("/api", templateRoutes);
app.use("/api", campaignRoutes);
app.use("/api", analyticsRoutes);

app.use((req, res) => {
  return res.status(404).json({ message: "Route not found" });
});

// Start server
app.listen(3001, () => {
  console.log("Server is running on port 3001");
  startCampaignScheduler();
});
