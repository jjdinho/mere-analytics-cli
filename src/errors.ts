/**
 * Structured exit codes for the CLI.
 *
 * 0 = OK
 * 1 = Usage error (bad args, missing required input, bad SQL)
 * 2 = Not found (404)
 * 3 = Auth error (401, expired token, not logged in)
 * 4 = Forbidden (403)
 * 5 = Rate limited (429)
 * 6 = Network error (connection failed, DNS, timeout)
 * 7 = API error (500, unexpected status)
 */

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_NOT_FOUND = 2;
export const EXIT_AUTH = 3;
export const EXIT_FORBIDDEN = 4;
export const EXIT_RATE_LIMIT = 5;
export const EXIT_NETWORK = 6;
export const EXIT_API = 7;

export class CliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: number
  ) {
    super(message);
    this.name = "CliError";
  }
}

export function httpStatusToExitCode(status: number): number {
  switch (status) {
    case 401:
      return EXIT_AUTH;
    case 403:
      return EXIT_FORBIDDEN;
    case 404:
      return EXIT_NOT_FOUND;
    case 429:
      return EXIT_RATE_LIMIT;
    default:
      return status >= 500 ? EXIT_API : EXIT_USAGE;
  }
}
