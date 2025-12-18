import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import * as request from "supertest";

import { AppModule } from "../src/app.module";

describe("Tree API (e2e)", () => {
  it("GET /api/tree returns 200 and []", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();

    await request(app.getHttpServer()).get("/api/tree").expect(200).expect([]);

    await app.close();
  });

  it("POST /api/tree with empty body returns 400", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send({})
      .expect(400);

    await app.close();
  });

  it("POST /api/tree with invalid JSON returns 400", async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    const app = moduleRef.createNestApplication();
    app.setGlobalPrefix("api");
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();

    await request(app.getHttpServer())
      .post("/api/tree")
      .set("content-type", "application/json")
      .send('{"label":')
      .expect(400);

    await app.close();
  });
});
