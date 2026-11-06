import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests",
  timeout: 90000,
  workers: 3,
  fullyParallel: true,
  webServer: {
    command: "npm run dev",
    url: "http://localhost:4187",
    env: { PORT: "4187" },
    reuseExistingServer: !process.env.CI,
  },
  use: { baseURL: "http://localhost:4187", trace: "retain-on-failure" },
  projects: [
    {
      name: "android",
      use: { ...devices["Pixel 7"], defaultBrowserType: "chromium" },
    },
    {
      name: "iphone",
      use: { ...devices["iPhone 13"], defaultBrowserType: "webkit" },
    },
    {
      name: "ipad",
      use: { ...devices["iPad (gen 7)"], defaultBrowserType: "webkit" },
    },
  ],
});
