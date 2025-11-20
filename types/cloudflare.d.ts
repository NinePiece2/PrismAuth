/**
 * Cloudflare Workers Runtime Types
 */

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<ArrayBuffer>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
  exec(query: string): Promise<D1ExecResult>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
  raw<T = unknown>(): Promise<T[]>;
}

export interface D1Result<T = unknown> {
  results: T[];
  success: boolean;
  meta: {
    duration: number;
    size_after: number;
    rows_read: number;
    rows_written: number;
    changes?: number;
  };
}

export interface D1ExecResult {
  count: number;
  duration: number;
}

export interface KVNamespace {
  get(key: string, options?: { type: "text" }): Promise<string | null>;
  get(key: string, options: { type: "json" }): Promise<unknown | null>;
  get(
    key: string,
    options: { type: "arrayBuffer" },
  ): Promise<ArrayBuffer | null>;
  get(key: string, options: { type: "stream" }): Promise<ReadableStream | null>;
  put(
    key: string,
    value: string | ArrayBuffer | ReadableStream,
    options?: KVPutOptions,
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: KVListOptions): Promise<KVListResult>;
}

export interface KVPutOptions {
  expiration?: number;
  expirationTtl?: number;
  metadata?: Record<string, unknown>;
}

export interface KVListOptions {
  prefix?: string;
  limit?: number;
  cursor?: string;
}

export interface KVListResult {
  keys: {
    name: string;
    expiration?: number;
    metadata?: Record<string, unknown>;
  }[];
  list_complete: boolean;
  cursor?: string;
}
