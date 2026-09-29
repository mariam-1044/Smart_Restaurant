import { chromium, request, FullConfig } from '@playwright/test';
import { execSync } from 'child_process';
import * as path from 'path';

async function globalSetup(_config: FullConfig) {
  const repoRoot = path.resolve(__dirname, '..');

  // 1. Seed the E2E database (idempotent)
  execSync('node Server/scripts/seed-e2e.js', {
    cwd: repoRoot,
    env: { ...process.env, MONGODB_URI: 'mongodb://localhost:27017/smart_restaurant_e2e' },
    stdio: 'inherit'
  });

  // 2. Programmatic login via API
  const apiContext = await request.newContext({ baseURL: 'http://localhost:8080' });
  const response = await apiContext.post('/api/auth/login', {
    data: { email: 'admin@e2e.local', password: 'AdminPass!23' }
  });
  if (!response.ok()) {
    throw new Error(`E2E login failed: ${response.status()} ${await response.text()}`);
  }
  const body = await response.json();
  const { token, user } = body.data;

  // 3. Hydrate a browser context with the resulting session and persist
  const browser = await chromium.launch();
  const context = await browser.newContext();
  await context.addInitScript((auth) => {
    window.localStorage.setItem('token', auth.token);
    window.localStorage.setItem('user', JSON.stringify(auth.user));
  }, { token, user });

  // Visit the app once so localStorage gets associated with origin http://localhost:5173
  const page = await context.newPage();
  await page.goto('http://localhost:5173/');
  await context.storageState({ path: path.join(repoRoot, 'auth.json') });
  await browser.close();
  await apiContext.dispose();
}

export default globalSetup;