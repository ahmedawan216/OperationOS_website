import "server-only";

import { runtimeErrorSchema, type RuntimeError } from "./contracts";

export class LearningProviderError extends Error {
  readonly runtimeError: RuntimeError;

  constructor(component: string) {
    const runtimeError = runtimeErrorSchema.parse({
      code: "PROVIDER_ERROR",
      message: `${component} provider failed`,
      retryable: true,
    });
    super(runtimeError.message);
    this.name = "LearningProviderError";
    this.runtimeError = runtimeError;
  }
}
