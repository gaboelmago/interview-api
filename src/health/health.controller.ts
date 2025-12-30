import { Controller, Get } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiOkResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";

import { getReadThrottleLimit, getThrottleConfig } from "../config/throttle";
import { ErrorResponseDto } from "../common/dto/error-response.dto";

const throttle = getThrottleConfig();
const ttlMs = throttle.ttlSeconds * 1000;
const readLimit = getReadThrottleLimit(throttle.limit);

@Controller("health")
@ApiTags("health")
export class HealthController {
  @Get()
  @Throttle({ default: { limit: readLimit, ttl: ttlMs } })
  @ApiOkResponse({ schema: { example: { status: "ok" } } })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  getHealth() {
    return { status: "ok" };
  }
}
