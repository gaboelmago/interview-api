import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnsupportedMediaTypeException,
} from "@nestjs/common";

@Injectable()
export class JsonOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<any>();

    const contentType = (req?.headers?.["content-type"] as string | undefined)
      ?.toLowerCase()
      .trim();

    // Accept common JSON content types: "application/json" and "application/json; charset=utf-8".
    const isJson =
      typeof contentType === "string" &&
      contentType.startsWith("application/json");

    if (!isJson) {
      throw new UnsupportedMediaTypeException(
        "Content-Type must be application/json"
      );
    }

    return true;
  }
}
