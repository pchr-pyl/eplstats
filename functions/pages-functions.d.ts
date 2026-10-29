// Minimal ambient types for Cloudflare Pages Functions so tsc --noEmit passes
// without adding @cloudflare/workers-types as a dependency.

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run<T = unknown>(): Promise<T>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
  first<T = Record<string, unknown>>(): Promise<T | null>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

interface EventContext<Env, P extends string, Data> {
  request: Request;
  env: Env;
  params: Record<P, string> & Record<string, string | string[]>;
  data: Data;
  waitUntil(promise: Promise<unknown>): void;
  next(): Promise<Response>;
}

type PagesFunction<Env = unknown, P extends string = string, Data = unknown> = (
  context: EventContext<Env, P, Data>,
) => Response | Promise<Response>;
