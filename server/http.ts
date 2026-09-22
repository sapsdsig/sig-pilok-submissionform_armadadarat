import type { VercelResponse } from "@vercel/node";
import { AppError, toPublicApiError } from "./errors.js";

export function sendApiError(response: VercelResponse, error: unknown): void {
  const normalized = toPublicApiError(error);
  if (error instanceof Error) console.error(`[API] ${error.name}: ${error.message}`);
  else console.error("[API] Unknown non-Error failure.");
  response.status(normalized.status).json(normalized.body);
}

export function rejectMethod(response: VercelResponse, allowed: readonly string[]): never {
  response.setHeader("Allow", allowed.join(", "));
  throw new AppError(
    "METHOD_NOT_ALLOWED",
    405,
    `Method tidak diizinkan. Gunakan ${allowed.join(" atau ")}.`,
    "Metode permintaan tidak didukung.",
  );
}

export function parseRequestBody(body: unknown): unknown {
  if (typeof body !== "string") return body;
  try {
    return JSON.parse(body) as unknown;
  } catch (error) {
    throw new AppError(
      "INVALID_REQUEST",
      400,
      "Request body bukan JSON yang valid.",
      "Data yang dikirim tidak dapat dibaca.",
      { cause: error },
    );
  }
}

export function singleQueryValue(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? undefined : value;
}
