import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Res,
} from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiExtraModels,
  ApiNotFoundResponse,
  ApiQuery,
  ApiOkResponse,
  ApiPayloadTooLargeResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
} from "@nestjs/swagger";
import { getSchemaPath } from "@nestjs/swagger";
import type { Response } from "express";

import { CreateTreeNodeDto } from "./dto/create-tree-node.dto";
import { TreeService } from "./tree.service";
import { ErrorResponseDto } from "../common/dto/error-response.dto";
import { CreateTreeNodeResponseDto } from "./dto/create-tree-node-response.dto";
import { TreeNodeResponseDto } from "./dto/tree-node-response.dto";
import { GetTreeQueryDto } from "./dto/get-tree-query.dto";

import {
  getReadThrottleLimit,
  getThrottleConfig,
  getWriteThrottleLimit,
} from "../config/throttle";

const throttle = getThrottleConfig();
const ttlMs = throttle.ttlSeconds * 1000;
const readLimit = getReadThrottleLimit(throttle.limit);
const writeLimit = getWriteThrottleLimit(throttle.limit);

@Controller("tree")
@ApiTags("tree")
@ApiExtraModels(TreeNodeResponseDto, ErrorResponseDto)
export class TreeController {
  constructor(private readonly treeService: TreeService) {}

  @Get()
  @Throttle({ default: { limit: readLimit, ttl: ttlMs } })
  @ApiQuery({ name: "page", required: false, type: Number, minimum: 1 })
  @ApiQuery({
    name: "pageSize",
    required: false,
    type: Number,
    minimum: 1,
    maximum: 100,
  })
  @ApiQuery({ name: "rootId", required: false, type: Number, minimum: 1 })
  @ApiOkResponse({
    schema: {
      type: "array",
      items: { $ref: getSchemaPath(TreeNodeResponseDto) },
    },
  })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  getTrees(
    @Query() query: GetTreeQueryDto,
    @Res({ passthrough: true }) res: Response
  ) {
    if (
      query.rootId != null &&
      (query.page != null || query.pageSize != null)
    ) {
      throw new BadRequestException(
        "rootId cannot be combined with pagination"
      );
    }

    return this.treeService.getTrees(query).then((result) => {
      if (
        result.totalRoots != null &&
        result.page != null &&
        result.pageSize != null
      ) {
        res.setHeader("X-Total-Roots", String(result.totalRoots));
        res.setHeader("X-Page", String(result.page));
        res.setHeader("X-Page-Size", String(result.pageSize));
      }

      return result.roots;
    });
  }

  @Post()
  @Throttle({ default: { limit: writeLimit, ttl: ttlMs } })
  @ApiCreatedResponse({ type: CreateTreeNodeResponseDto })
  @ApiBadRequestResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiPayloadTooLargeResponse({ type: ErrorResponseDto })
  @ApiTooManyRequestsResponse({ type: ErrorResponseDto })
  createNode(@Body() dto: CreateTreeNodeDto) {
    return this.treeService.createNode(dto);
  }
}
