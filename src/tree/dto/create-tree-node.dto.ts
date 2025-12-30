import { IsInt, IsNotEmpty, IsString, Min, ValidateIf } from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class CreateTreeNodeDto {
  @ApiProperty({ example: "root" })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ nullable: true, example: 1 })
  @ValidateIf(
    (o: CreateTreeNodeDto) => o.parentId !== null && o.parentId !== undefined
  )
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
