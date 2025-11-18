require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const pdfParse = require('pdf-parse');
const axios = require('axios');
const OpenAI = require('openai');


const app = express();
app.use(bodyParser.json({ limit: '20mb' }));

// -----------------------------
// Load secrets from .env
// -----------------------------
const PORT = process.env.PORT || 3000;
const CLIQ_OAUTH_TOKEN = process.env.CLIQ_OAUTH_TOKEN;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const DEFAULT_CHANNEL = process.env.CLIQ_BOT_CHANNEL_ID || null;

if (!CLIQ_OAUTH_TOKEN || !OPENAI_API_KEY) {
  console.error('Missing API keys in .env');
  process.exit(1);
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});


// -----------------------------
// Helper Functions
// -----------------------------
async function downloadFile(url) {
  const res = await fetch(url, {
    headers: { Authorization: `Zoho-oauthtoken ${CLIQ_OAUTH_TOKEN}` },
  });
  if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);
  const buffer = await res.arrayBuffer();
  return Buffer.from(buffer);
}

async function extractText(buffer) {
  const data = await pdfParse(buffer);
  return data.text || '';
}

async function summarizeText(text) {
  const prompt = `Summarize this text in 3-5 bullet points:\n${text}`;
 const resp = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: prompt }],
  temperature: 0.2,
  max_tokens: 800,
});

  return resp.data.choices[0].message.content.trim();
}

async function generateTasks(text) {
  const prompt = `Extract actionable tasks from this document. Each task should include: title, description, estimated_minutes, priority (low/medium/high). Return a JSON array only.\n\n${text}`;
  const resp = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 700,
  });
  const raw = resp.data.choices[0].message.content.trim();
  try {
    const jsonStart = raw.indexOf('[');
    const jsonStr = jsonStart >= 0 ? raw.slice(jsonStart) : raw;
    return JSON.parse(jsonStr);
  } catch (e) {
    return { error: 'Failed to parse JSON', raw };
  }
}

async function postToCliq(channelId, payload) {
  const url = `https://cliq.zoho.com/api/v2/channels/${channelId}/message`;
  const resp = await axios.post(url, payload, {
    headers: {
      Authorization: `Zoho-oauthtoken ${CLIQ_OAUTH_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  return resp.data;
}

function buildMessage(summary, tasks) {
  let msg = `*Summary:*\n${summary}\n\n*Tasks:*\n`;
  if (Array.isArray(tasks)) {
    tasks.forEach((t, i) => {
      msg += `\n${i + 1}. *${t.title}* (${t.priority}) — ${t.estimated_minutes} min\n   ${t.description}\n`;
    });
  } else if (tasks.error) {
    msg += `Error generating tasks: ${tasks.raw}\n`;
  } else {
    msg += `${tasks}\n`;
  }
  return msg;
}

// -----------------------------
// Webhook Endpoint
// -----------------------------
app.post('/cliq/webhook', async (req, res) => {
  try {
    console.log('Webhook received:', new Date().toISOString());
    const body = req.body || {};
    const channelId = body.channel_id || body.channel?.id || DEFAULT_CHANNEL;
    const attachments = (body.message && body.message.attachments) || body.attachments || [];

    res.status(200).send('ok'); // ack Zoho immediately

    if (!attachments.length) {
      console.log('No attachments found.');
      return;
    }

    const fileMeta = attachments[0];
    const fileUrl = fileMeta.url || fileMeta.download_url || fileMeta.link;
    if (!fileUrl) {
      console.error('No file URL found.');
      if (channelId) await postToCliq(channelId, { text: 'Could not find file URL.' });
      return;
    }

    console.log('Downloading file...');
    const buffer = await downloadFile(fileUrl);

    console.log('Extracting text...');
    const text = await extractText(buffer);
    if (!text || text.trim().length < 20) {
      if (channelId) await postToCliq(channelId, { text: 'Could not extract text from PDF.' });
      return;
    }

    const limitedText = text.slice(0, 100000);

    console.log('Generating summary...');
    const summary = await summarizeText(limitedText);

    console.log('Generating tasks...');
    const tasks = await generateTasks(limitedText);

    console.log('Posting back to Cliq...');
    const message = buildMessage(summary, tasks);
    if (channelId) await postToCliq(channelId, { text: message });

    console.log('Processing complete.');
  } catch (err) {
    console.error('Webhook processing error:', err);
  }
});

// -----------------------------
// Start server
// -----------------------------
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
app.post('/cliq/webhook', async (req, res) => {
    // your code to process PDF, summarize, generate tasks
    res.status(200).send('ok'); // acknowledge Zoho
});
// Root route just to check server is running
app.get("/", (req, res) => {
  res.send("Server is Live on Render!");
});

