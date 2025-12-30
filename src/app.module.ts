import { Module } from "@nestjs/common";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "crypto";
import { APP_GUARD } from "@nestjs/core";

import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ReadyModule } from "./ready/ready.module";
import { TreeModule } from "./tree/tree.module";
import { getThrottleConfig } from "./config/throttle";

const nodeEnv = process.env.NODE_ENV;
const logPretty =
  process.env.LOG_PRETTY != null
    ? process.env.LOG_PRETTY === "true"
    : nodeEnv !== "production" && nodeEnv !== "test";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        genReqId: (req, res) => {
          const header = req.headers["x-request-id"];
          const requestId =
            typeof header === "string" && header.trim().length > 0
              ? header
              : Array.isArray(header) && typeof header[0] === "string"
              ? header[0]
              : randomUUID();

          // Make it available to application code/filters.
          (req as any).requestId = requestId;

          // Echo it back for clients and upstream proxies.
          if (!res.headersSent) {
            res.setHeader("X-Request-Id", requestId);
          }

          return requestId;
        },
        level: process.env.LOG_LEVEL ?? "info",
        redact: {
          paths: ["req.headers.authorization"],
          remove: true,
        },
        ...(logPretty
          ? {
              transport: {
                target: "pino-pretty",
                options: {
                  colorize: true,
                  translateTime: "SYS:standard",
                  ignore: "pid,hostname",
                },
              },
            }
          : {}),
      },
    }),
    ThrottlerModule.forRoot([
      {
        name: "default",
        ttl: getThrottleConfig().ttlSeconds * 1000,
        limit: getThrottleConfig().limit,
      },
    ]),
    PrismaModule,
    TreeModule,
    HealthModule,
    ReadyModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
