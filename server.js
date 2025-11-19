import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();

const app = express();
app.use(express.json());

// Root route
app.get("/", (req, res) => {
  res.send("Cliq Smart Bot — running. Webhook: POST /cliq/webhook");
});

// Webhook route
app.post("/cliq/webhook", (req, res) => {
  return res.json({ text: "Webhook received" });
});

// ⭐ Correct single PORT definition
const PORT = process.env.PORT || 3000;

// ⭐ Only ONE app.listen()
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
