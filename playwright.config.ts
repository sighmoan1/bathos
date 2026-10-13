import {defineConfig,devices} from '@playwright/test';
const port = Number(process.env.READER_TEST_PORT ?? 3021);
export default defineConfig({
 testDir:'./tests/e2e',
 workers:1,
 use:{baseURL:process.env.READER_BASE_URL ?? `http://127.0.0.1:${port}`},
 webServer:process.env.READER_BASE_URL ? undefined : {command:`python3 scripts/serve-export.py --port ${port}`,url:`http://127.0.0.1:${port}`,reuseExistingServer:false},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'android',use:{...devices['Pixel 7']}}]
});
