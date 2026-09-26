type Closer = () => void | Promise<void>;

interface CloserEntry {
  name: string;
  close: Closer;
}

const closers = new Map<string, CloserEntry>();
let running: Promise<void> | undefined;
let signalsInstalled = false;

const SHUTDOWN_TIMEOUT_MS = 5_000;
const SIGNALS = ["SIGINT", "SIGTERM"] as const;

/**
 * Register a named shutdown task. Registration by the same name replaces
 * the previous entry, so HMR re-evaluation cannot double-register.
 */
export function registerShutdownHandler(name: string, close: Closer): void {
  closers.set(name, { name, close });
}

/**
 * Run every registered closer exactly once (subsequent calls return the
 * in-flight result), each isolated so one failure cannot block the rest.
 * The whole sequence is bounded by a timeout.
 */
export function runShutdown(): Promise<void> {
  running ??= (async () => {
    const entries = [...closers.values()];
    await Promise.race([
      Promise.allSettled(
        entries.map(async ({ name, close }) => {
          try {
            await close();
          } catch (error) {
            process.stderr.write(
              `shutdown handler "${name}" failed: ${
                error instanceof Error ? error.message : String(error)
              }\n`,
            );
          }
        }),
      ),
      new Promise<void>((resolve) => setTimeout(resolve, SHUTDOWN_TIMEOUT_MS)),
    ]);
  })();
  return running;
}

/**
 * Wire process signals to the shutdown sequence — installed once per
 * process, guarded against duplicate registration.
 */
export function installSignalHandlers(): void {
  if (signalsInstalled) {
    return;
  }
  signalsInstalled = true;
  for (const signal of SIGNALS) {
    process.on(signal, () => {
      void runShutdown().finally(() => process.exit(0));
    });
  }
}

/** Test hook: reset lifecycle state. Never used in app code. */
export function resetShutdownForTest(): void {
  closers.clear();
  running = undefined;
  signalsInstalled = false;
}
