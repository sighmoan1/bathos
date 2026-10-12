import {defineConfig,devices} from '@playwright/test';
export default defineConfig({
 testDir:'./tests/e2e',
 workers:1,
 use:{baseURL:process.env.READER_BASE_URL ?? 'http://127.0.0.1:3021'},
 webServer:process.env.READER_BASE_URL ? undefined : {command:'python3 -m http.server 3021 --bind 127.0.0.1 --directory out',url:'http://127.0.0.1:3021',reuseExistingServer:!process.env.CI},
 projects:[{name:'desktop',use:{...devices['Desktop Chrome']}},{name:'android',use:{...devices['Pixel 7']}}]
});
