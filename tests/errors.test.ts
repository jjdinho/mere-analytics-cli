import { describe, it, expect } from "vitest";
import {
  CliError,
  httpStatusToExitCode,
  EXIT_USAGE,
  EXIT_NOT_FOUND,
  EXIT_AUTH,
  EXIT_FORBIDDEN,
  EXIT_RATE_LIMIT,
  EXIT_API,
} from "../src/errors.js";

describe("CliError", () => {
  it("carries a message and exit code", () => {
    const err = new CliError("nope", EXIT_USAGE);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("nope");
    expect(err.exitCode).toBe(EXIT_USAGE);
    expect(err.name).toBe("CliError");
  });
});

describe("httpStatusToExitCode", () => {
  it("maps known statuses to exit codes", () => {
    expect(httpStatusToExitCode(401)).toBe(EXIT_AUTH);
    expect(httpStatusToExitCode(403)).toBe(EXIT_FORBIDDEN);
    expect(httpStatusToExitCode(404)).toBe(EXIT_NOT_FOUND);
    expect(httpStatusToExitCode(429)).toBe(EXIT_RATE_LIMIT);
  });

  it("treats 5xx as API errors and other 4xx as usage errors", () => {
    expect(httpStatusToExitCode(500)).toBe(EXIT_API);
    expect(httpStatusToExitCode(503)).toBe(EXIT_API);
    expect(httpStatusToExitCode(400)).toBe(EXIT_USAGE);
    expect(httpStatusToExitCode(422)).toBe(EXIT_USAGE);
  });
});
