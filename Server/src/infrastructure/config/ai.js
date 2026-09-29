const baseUrl = process.env.ML_SERVICE_URL || 'http://localhost:5002/v1';
if (!baseUrl) {
    throw new Error('ML_SERVICE_URL is not configured');
}
// RAG recipe generation calls Gemini through the ML service, which routinely
// takes 10-15s. A 3s timeout made the backend always time out and silently
// serve the heuristic fallback. Allow an override and default high enough for
// the LLM round-trip.
const timeoutMs = Number(process.env.ML_SERVICE_TIMEOUT_MS) || 30000;
module.exports = { baseUrl, timeoutMs };