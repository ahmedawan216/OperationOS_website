import "server-only";

import type { ZodType } from "zod";

import { runtimeErrorSchema, type RuntimeError } from "./contracts";

export class ContractValidationError extends Error {
  readonly runtimeError: RuntimeError;

  constructor(boundary: string, issues: readonly { path: PropertyKey[]; message: string }[]) {
    const safeIssues = issues.slice(0, 25).map((issue) => ({
      path: issue.path.map(String).join("."),
      message: issue.message,
    }));

    const runtimeError = runtimeErrorSchema.parse({
      code: "VALIDATION_ERROR",
      message: `Invalid payload at ${boundary}`,
      retryable: false,
      safeDetails: { issues: safeIssues },
    });

    super(runtimeError.message);
    this.name = "ContractValidationError";
    this.runtimeError = runtimeError;
  }
}

export function parseContract<T>(schema: ZodType<T>, value: unknown, boundary: string): T {
  const result = schema.safeParse(value);

  if (!result.success) {
    throw new ContractValidationError(boundary, result.error.issues);
  }

  return result.data;
}
