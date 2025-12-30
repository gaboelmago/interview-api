export function getBodyLimit(): string {
  const limit = process.env.BODY_LIMIT;
  if (limit != null && String(limit).trim().length > 0) {
    return String(limit).trim();
  }

  // Default is intentionally small and interview-friendly.
  return "100kb";
}
