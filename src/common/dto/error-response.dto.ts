import { ApiProperty } from "@nestjs/swagger";

export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({ example: "Not Found" })
  error!: string;

  @ApiProperty({
    oneOf: [
      { type: "string", example: "Cannot GET /api/does-not-exist" },
      { type: "array", items: { type: "string" } },
    ],
  })
  message!: string | string[];

  @ApiProperty({ example: "/api/does-not-exist" })
  path!: string;

  @ApiProperty({ example: "2025-12-30T00:00:00.000Z" })
  timestamp!: string;

  @ApiProperty({ required: false, example: "test-req-123" })
  requestId?: string;
}
