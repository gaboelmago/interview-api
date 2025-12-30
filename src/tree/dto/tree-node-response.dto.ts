import { ApiProperty } from "@nestjs/swagger";

export class TreeNodeResponseDto {
  @ApiProperty({ example: 1 })
  id!: number;

  @ApiProperty({ example: "root" })
  label!: string;

  @ApiProperty({ type: () => [TreeNodeResponseDto] })
  children!: TreeNodeResponseDto[];
}
