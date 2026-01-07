import { Transform } from "class-transformer";
import {
  IsInt,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTreeNodeDto {
  @ApiProperty({ example: "root" })
  @Transform(({ value }) => (typeof value === "string" ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Matches(/^[^\p{Cc}]*$/u, {
    message: "label must not contain control characters",
  })
  label!: string;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @ValidateIf(
    (o: CreateTreeNodeDto) => o.parentId !== null && o.parentId !== undefined
  )
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
