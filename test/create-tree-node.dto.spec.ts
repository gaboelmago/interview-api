import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CreateTreeNodeDto } from "../src/tree/dto/create-tree-node.dto";

describe("CreateTreeNodeDto", () => {
  it("accepts a valid payload", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "child",
      parentId: 1,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a root payload when parentId is missing", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "root",
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("accepts a root payload when parentId is null", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "root",
      parentId: null,
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects missing label", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      parentId: 1,
    });

    const errors = await validate(dto);
    expect(errors).not.toHaveLength(0);

    const labelError = errors.find((e) => e.property === "label");
    expect(labelError).toBeDefined();
  });

  it("rejects whitespace-only label", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "   ",
      parentId: 1,
    });

    const errors = await validate(dto);
    const labelError = errors.find((e) => e.property === "label");
    expect(labelError).toBeDefined();
  });

  it("rejects label longer than 255 characters", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "a".repeat(256),
      parentId: 1,
    });

    const errors = await validate(dto);
    const labelError = errors.find((e) => e.property === "label");
    expect(labelError).toBeDefined();
  });

  it("trims label (leading/trailing whitespace) before validation", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "  root  ",
      parentId: 1,
    });

    // Contract: labels are normalized on input.
    expect(dto.label).toBe("root");

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it("rejects label with control characters (newline)", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "hi\nthere",
      parentId: 1,
    });

    const errors = await validate(dto);
    const labelError = errors.find((e) => e.property === "label");
    expect(labelError).toBeDefined();
  });

  it("rejects label with control characters (NUL)", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "hi\u0000there",
      parentId: 1,
    });

    const errors = await validate(dto);
    const labelError = errors.find((e) => e.property === "label");
    expect(labelError).toBeDefined();
  });

  it("rejects non-integer parentId", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "x",
      parentId: "nope",
    });

    const errors = await validate(dto);
    const parentIdError = errors.find((e) => e.property === "parentId");
    expect(parentIdError).toBeDefined();
  });

  it("rejects parentId < 1", async () => {
    const dto = plainToInstance(CreateTreeNodeDto, {
      label: "x",
      parentId: 0,
    });

    const errors = await validate(dto);
    const parentIdError = errors.find((e) => e.property === "parentId");
    expect(parentIdError).toBeDefined();
  });
});
