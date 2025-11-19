import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai"; // keep if you actually use OpenAI

dotenv.config();
const app = express();
app.use(express.json());

// Health / root route (this fixes "Cannot GET /")
app.get("/", (req, res) => {
  res.send("Cliq Smart Bot — running. Webhook: POST /cliq/webhook");
});

// Example webhook (keep your real logic here)
app.post("/cliq/webhook", async (req, res) => {
  try {
    // minimal reply — replace with your logic
    return res.json({ text: "Webhook received" });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ text: "Internal error" });
  }
});

// Use Render's port env var
const P = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
const port = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
