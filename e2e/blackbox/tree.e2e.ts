import * as request from "supertest";

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

type CreatedNode = {
  id: number;
  label: string;
  parentId: number | null;
};

describe("Black-box E2E: /api/tree", () => {
  it("starts empty on a fresh database", async () => {
    await request(BASE_URL).get("/api/tree").expect(200).expect([]);
  });

  it("creates a root, creates a child under it, and returns nested tree output", async () => {
    const suffix = `${Date.now()}`;
    const rootLabel = `root-${suffix}`;
    const childLabel = `child-${suffix}`;

    const rootRes = await request(BASE_URL)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: rootLabel })
      .expect(201);

    const root = rootRes.body as CreatedNode;
    expect(root).toEqual({
      id: expect.any(Number),
      label: rootLabel,
      parentId: null,
    });

    const childRes = await request(BASE_URL)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: childLabel, parentId: root.id })
      .expect(201);

    const child = childRes.body as CreatedNode;
    expect(child).toEqual({
      id: expect.any(Number),
      label: childLabel,
      parentId: root.id,
    });

    const treeRes = await request(BASE_URL).get("/api/tree").expect(200);

    expect(treeRes.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: root.id,
          label: rootLabel,
          children: [
            expect.objectContaining({
              id: child.id,
              label: childLabel,
              children: [],
            }),
          ],
        }),
      ])
    );
  });

  it("rejects empty body with 400", async () => {
    await request(BASE_URL)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({})
      .expect(400);
  });

  it("returns 404 when parentId does not exist", async () => {
    await request(BASE_URL)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({ label: "orphan", parentId: 999999 })
      .expect(404);
  });

  it("rejects invalid JSON with 400", async () => {
    await request(BASE_URL)
      .post("/api/tree")
      .set("content-type", "application/json")
      .send('{"label":')
      .expect(400);
  });
});
