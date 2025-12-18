export function getApiPort(
  env: Record<string, string | undefined> = process.env
) {
  const raw = env.API_PORT;
  if (!raw) return 3000;

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : 3000;
}
