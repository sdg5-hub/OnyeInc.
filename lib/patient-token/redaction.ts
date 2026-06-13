const TOKEN_PATH_PATTERN = /\/(v|verify)\/[^/?#\s"')]+/g;

export function redactPatientTokenPath(value: string): string {
  return value.replace(TOKEN_PATH_PATTERN, (_match, route: string) => `/${route}/[redacted-token]`);
}
