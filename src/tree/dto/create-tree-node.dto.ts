import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class CreateTreeNodeDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsInt()
  @Min(1)
  parentId!: number;
}
