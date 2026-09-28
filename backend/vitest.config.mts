import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globalSetup: ['./test/globalSetup.ts'],
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
    env: { APP_PROFILE: 'test' },
  },
});
