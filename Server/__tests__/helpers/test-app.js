// Lightweight Express app builder for integration tests.
// Skips connectDB / morgan logging — tests are responsible for mocking
// any DB-touching service calls explicitly.

const express = require('express');

function buildTestApp({ mountAi, mountRecommendations, mountEndorsements, mountPricing, mountAuth } = {}) {
    const app = express();
    app.use(express.json());

    if (mountAuth) {
        app.use(mountAuth);
    } else {
        // Default fake auth: lets a test attach a user via X-Test-User header (JSON-encoded).
        app.use((req, res, next) => {
            const raw = req.headers['x-test-user'];
            if (raw) {
                try {
                    req.user = JSON.parse(raw);
                } catch (e) {
                    /* ignore */
                }
            }
            next();
        });
    }

    if (mountAi) app.use('/api/v1/ai', mountAi);
    if (mountRecommendations) app.use('/api/v1/recommendations', mountRecommendations);
    if (mountEndorsements) app.use('/api/v1/dishes', mountEndorsements);
    if (mountPricing) app.use('/api/v1/ai/pricing', mountPricing);

    return app;
}

module.exports = { buildTestApp };
