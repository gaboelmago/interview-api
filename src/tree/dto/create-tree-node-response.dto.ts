import { ApiProperty } from "@nestjs/swagger";

export class CreateTreeNodeResponseDto {
  @ApiProperty({ example: 123 })
  id!: number;

  @ApiProperty({ example: "child" })
  label!: string;

  @ApiProperty({ nullable: true, example: 1 })
  parentId!: number | null;
}
