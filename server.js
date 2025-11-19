import express from "express";
import dotenv from "dotenv";
import OpenAI from "openai";

dotenv.config();
const app = express();
app.use(express.json());

// root / health check
app.get("/", (req, res) => {
  res.send("Cliq Smart Bot is running. POST to /cliq/webhook for Zoho.");
});

// initialize OpenAI client
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Zoho webhook
app.post("/cliq/webhook", async (req, res) => {
  try {
    const userMsg = (req.body.message) ? req.body.message : "Hello";
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: userMsg }]
    });

    const reply = completion.choices?.[0]?.message?.content ?? "Sorry, no reply.";
    return res.json({ text: reply });
  } catch (err) {
    console.error("Webhook error:", err);
    return res.status(500).json({ text: "Internal error" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
