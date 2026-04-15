export function createLogger(functionName: string, requestId: string) {
  return {
    info(message: string, data?: Record<string, unknown>) {
      console.log(JSON.stringify({
        level: 'info', ts: new Date().toISOString(),
        function: functionName, requestId, message, ...data,
      }));
    },
    warn(message: string, data?: Record<string, unknown>) {
      console.warn(JSON.stringify({
        level: 'warn', ts: new Date().toISOString(),
        function: functionName, requestId, message, ...data,
      }));
    },
    error(message: string, error?: unknown, data?: Record<string, unknown>) {
      console.error(JSON.stringify({
        level: 'error', ts: new Date().toISOString(),
        function: functionName, requestId, message,
        error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error),
        ...data,
      }));
    },
  };
}

export function generateRequestId(): string {
  return crypto.randomUUID().slice(0, 8);
}
