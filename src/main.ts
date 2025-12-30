import { config as dotenvConfig } from "dotenv";
import { resolve } from "path";

dotenvConfig({ path: resolve(__dirname, "..", ".env") });

import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";

import { AppModule } from "./app.module";
import { configureApp } from "./bootstrap/configure-app";
import { getApiPort } from "./config/api-port";
import { getServerTimeouts } from "./config/server-timeouts";

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    bodyParser: false,
  });

  app.useLogger(app.get(Logger));

  configureApp(app);

  // Ensure graceful shutdown handlers run (e.g., PrismaService.onModuleDestroy).
  app.enableShutdownHooks();

  const server: any = await app.listen(getApiPort());

  // Phase 17 Part C: Node HTTP server timeouts (configurable, sane defaults).
  const timeouts = getServerTimeouts();
  server.keepAliveTimeout = timeouts.keepAliveTimeoutMs;
  server.headersTimeout = timeouts.headersTimeoutMs;
  server.requestTimeout = timeouts.requestTimeoutMs;
}

bootstrap();
