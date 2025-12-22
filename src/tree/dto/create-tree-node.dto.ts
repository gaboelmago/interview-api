import { IsInt, IsNotEmpty, IsString, Min, ValidateIf } from "class-validator";

export class CreateTreeNodeDto {
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ValidateIf(
    (o: CreateTreeNodeDto) => o.parentId !== null && o.parentId !== undefined
  )
  @IsInt()
  @Min(1)
  parentId?: number | null;
}
