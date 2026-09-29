// Jest setup — applied before each test file.
// Provide harmless defaults for env vars that some modules check at import time.
if (!process.env.OPENAI_API_KEY) process.env.OPENAI_API_KEY = 'test-openai-key';
if (!process.env.HANDLE_SALT) process.env.HANDLE_SALT = 'test-handle-salt';
if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-jwt-secret';
if (!process.env.ML_SERVICE_URL) process.env.ML_SERVICE_URL = 'http://localhost:5002/v1';

// Network safety net — every outbound HTTP must be explicitly mocked.
const nock = require('nock');
nock.disableNetConnect();
nock.enableNetConnect(/127\.0\.0\.1|localhost/);