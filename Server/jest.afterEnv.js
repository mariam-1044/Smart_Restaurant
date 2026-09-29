// Separated from jest.setup.js because this file runs after each test (afterEnv phase),
// whereas setup runs once before all tests. Keeps nock cleanup at the right lifecycle stage.
// Network safety net — clean up nock mocks after every test.
const nock = require('nock');
afterEach(() => {
  nock.cleanAll();
});