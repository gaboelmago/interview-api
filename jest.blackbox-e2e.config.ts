import type { Config } from "@jest/types";

process.env.NODE_ENV ??= "test";
process.env.LOG_PRETTY ??= "false";
process.env.LOG_LEVEL ??= "silent";

const config: Config.InitialOptions = {
  displayName: "blackbox-e2e",
  rootDir: ".",
  testEnvironment: "node",
  testMatch: ["<rootDir>/e2e/blackbox/**/*.e2e.ts"],
  transform: {
    "^.+\\.(t|j)s$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
      },
    ],
  },
  testTimeout: 60_000,
  verbose: true,
};

export default config;
