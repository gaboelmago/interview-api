import { existsSync } from "node:fs";
import { execSync } from "node:child_process";

// Configure Git to use the repo's committed hooks folder.
// This keeps local hooks lightweight (no Husky) while still being shareable.

if (!existsSync(".git")) {
  process.exit(0);
}

try {
  execSync("git config core.hooksPath .githooks", {
    stdio: "ignore",
  });
} catch {
  // Best-effort: don't fail installs for hook setup issues.
}
