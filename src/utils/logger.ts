const timers = new Map<string, number>();

export const logger = {
  info: (msg: string, data?: unknown) => {
    const ts = new Date().toISOString().substring(11, 23);
    if (data !== undefined) {
      console.log(`[${ts}] INFO  ${msg}`, data);
    } else {
      console.log(`[${ts}] INFO  ${msg}`);
    }
  },

  warn: (msg: string, data?: unknown) => {
    const ts = new Date().toISOString().substring(11, 23);
    console.warn(`[${ts}] WARN  ${msg}`, data ?? '');
  },

  error: (msg: string, err?: unknown) => {
    const ts = new Date().toISOString().substring(11, 23);
    console.error(`[${ts}] ERROR ${msg}`, err ?? '');
  },

  step: (label: string) => {
    const ts = new Date().toISOString().substring(11, 23);
    console.log(`[${ts}] STEP  ── ${label}`);
    timers.set(label, Date.now());
  },

  done: (label: string) => {
    const start = timers.get(label);
    const elapsed = start ? `${Date.now() - start}ms` : '?ms';
    const ts = new Date().toISOString().substring(11, 23);
    console.log(`[${ts}] DONE  ── ${label} (${elapsed})`);
    timers.delete(label);
  },
};