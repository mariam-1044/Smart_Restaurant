// AI chat client. Uses the OpenAI SDK, but the SDK talks to whatever provider
// `AI_BASE_URL` points at — leave it unset for OpenAI proper, or point it at a
// provider that exposes an OpenAI-compatible API (e.g. Google Gemini at
// https://generativelanguage.googleapis.com/v1beta/openai/). The model used for
// chat completions is configured separately via `AI_MODEL` (see ai.service.js).
const OpenAI = require('openai');

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required (it holds the API key for whichever provider AI_BASE_URL targets).');
}

const opts = { apiKey };
if (process.env.AI_BASE_URL && String(process.env.AI_BASE_URL).trim()) {
    opts.baseURL = String(process.env.AI_BASE_URL).trim();
}

const OpenAICtor = OpenAI.OpenAI || OpenAI;
module.exports = new OpenAICtor(opts);
