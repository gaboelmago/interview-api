import {
  ValidationPipe,
  VERSION_NEUTRAL,
  VersioningType,
} from "@nestjs/common";
import type { INestApplication } from "@nestjs/common";
import { json, urlencoded } from "express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AllExceptionsFilter } from "../common/filters/all-exceptions.filter";
import { getBodyLimit } from "../config/body-limit";

export function configureApp(app: INestApplication) {
  const bodyLimit = getBodyLimit();

  // Explicit HTTP-layer body limits (Express) for abuse protection.
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));

  app.setGlobalPrefix("api");

  // Phase 16: URI versioning. Keep existing unversioned routes accessible.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: ["1", VERSION_NEUTRAL],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    })
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  // Phase 16: OpenAPI/Swagger
  const swaggerConfig = new DocumentBuilder()
    .setTitle("interview-api")
    .setDescription("NestJS Tree REST API")
    .setVersion("1")
    .addServer("/api")
    .build();

  const openapi = SwaggerModule.createDocument(app, swaggerConfig);

  SwaggerModule.setup("api/docs", app, openapi);

  // Serve raw spec at a stable, explicit URL.
  const httpAdapter = app.getHttpAdapter();
  const instance = httpAdapter.getInstance();
  instance.get("/api/openapi.json", (_req: any, res: any) => res.json(openapi));
}
