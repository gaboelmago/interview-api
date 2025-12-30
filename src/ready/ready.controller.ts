import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Throttle } from "@nestjs/throttler";
import {
  ApiOkResponse,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";

import { PrismaService } from "../prisma/prisma.service";
import { getReadThrottleLimit, getThrottleConfig } from "../config/throttle";
import { getReadyConfig } from "../config/ready";
import { ErrorResponseDto } from "../common/dto/error-response.dto";

const throttle = getThrottleConfig();
const ttlMs = throttle.ttlSeconds * 1000;
const readLimit = getReadThrottleLimit(throttle.limit);

function withTimeout<T>(
  promise: Promise<T>,
  ms: number
): Promise<T | "timeout"> {
  let timeoutId: NodeJS.Timeout | undefined;
  const timeoutPromise = new Promise<"timeout">((resolve) => {
    timeoutId = setTimeout(() => resolve("timeout"), ms);

    // Ensure we don't keep the timeout alive on the event loop.
    timeoutId.unref?.();
  });

  return Promise.race([
    promise.finally(() => {
      if (timeoutId) clearTimeout(timeoutId);
    }),
    timeoutPromise,
  ]);
}

@Controller("ready")
@ApiTags("ready")
export class ReadyController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @Throttle({ default: { limit: readLimit, ttl: ttlMs } })
  @ApiOkResponse({ schema: { example: { status: "ok", db: "ok" } } })
  @ApiServiceUnavailableResponse({
    schema: { example: { status: "degraded", db: "down" } },
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  async getReady(@Res({ passthrough: true }) res: Response) {
    const { dbTimeoutMs } = getReadyConfig();

    const checkPromise = this.prisma.assertDatabaseReady().then(
      () => true,
      () => false
    );

    const result = await withTimeout(checkPromise, dbTimeoutMs);

    if (result === true) {
      return { status: "ok", db: "ok" };
    }

    res.status(503);
    return { status: "degraded", db: "down" };
  }
}
