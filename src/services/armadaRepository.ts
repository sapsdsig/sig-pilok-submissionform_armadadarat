import type {
  ArmadaFormValues,
  ArmadaSubmissionRecord,
  PilokArmadaMaster,
} from "../types/armada";
import { z } from "zod";

interface ApiErrorPayload {
  error?: { code?: string; message?: string };
}

export class ApiClientError extends Error {
  constructor(readonly code: string, readonly status: number, message: string) {
    super(message);
    this.name = "ApiClientError";
  }
}

const masterSchema = z.object({
  kodePilokArmada: z.string().min(1),
  distributorGroup: z.string().min(1),
  districtName: z.string().min(1),
});

const countsSchema = z.object({
  ton2: z.number().int().min(0),
  ton4: z.number().int().min(0),
  ton6: z.number().int().min(0),
  ton8: z.number().int().min(0),
  ton10: z.number().int().min(0),
  ton16: z.number().int().min(0),
  ton24: z.number().int().min(0),
  ton32: z.number().int().min(0),
});

const submissionRecordSchema = z.object({
  kodePilokArmada: z.string().min(1),
  distributorGroup: z.string().min(1),
  districtName: z.string().min(1),
  armada: z.object({ milik: countsSchema, sewa: countsSchema }),
  total: z.number().int().min(0),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

function parseApiPayload<T>(schema: z.ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      502,
      "Server mengembalikan struktur data yang tidak dikenali.",
    );
  }
  return result.data;
}

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init?.body
        ? { "Content-Type": "application/json", ...init.headers }
        : init?.headers,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiClientError("NETWORK_ERROR", 0, "Server tidak dapat dihubungi.");
  }

  if (response.status === 204) {
    if (!response.ok) {
      throw new ApiClientError("API_ERROR", response.status, "Permintaan tidak dapat diproses.");
    }
    return null;
  }

  const contentType = response.headers.get("content-type")?.toLocaleLowerCase("en-US") ?? "";
  if (!contentType.includes("json")) {
    throw new ApiClientError(
      "UNEXPECTED_RESPONSE",
      response.status,
      response.ok
        ? "API lokal tidak tersedia. Jalankan workflow full-stack untuk mengakses data Google."
        : "Server mengembalikan respons yang tidak dikenali. Silakan coba kembali.",
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError(
      "INVALID_RESPONSE",
      response.status,
      "Server mengembalikan JSON yang tidak valid.",
    );
  }

  if (!response.ok) {
    const errorPayload = payload as ApiErrorPayload;
    throw new ApiClientError(
      errorPayload.error?.code ?? "API_ERROR",
      response.status,
      errorPayload.error?.message ?? "Permintaan tidak dapat diproses.",
    );
  }
  return payload;
}

export async function searchPilokArmada(
  query = "",
  signal?: AbortSignal,
): Promise<PilokArmadaMaster[]> {
  const params = new URLSearchParams();
  if (query.trim()) params.set("query", query.trim());
  const suffix = params.size ? `?${params.toString()}` : "";
  const payload = await requestJson(`/api/master${suffix}`, { signal });
  return parseApiPayload(z.object({ data: z.array(masterSchema) }), payload).data;
}

export async function getPilokArmadaByCode(
  kodePilokArmada: string,
  signal?: AbortSignal,
): Promise<PilokArmadaMaster | undefined> {
  const records = await searchPilokArmada(kodePilokArmada, signal);
  return records.find((record) => record.kodePilokArmada === kodePilokArmada);
}

export async function getExistingSubmission(
  kodePilokArmada: string,
  signal?: AbortSignal,
): Promise<ArmadaSubmissionRecord | undefined> {
  const payload = await requestJson(`/api/submissions/${encodeURIComponent(kodePilokArmada)}`, { signal });
  const response = parseApiPayload(z.object({
    exists: z.boolean(),
    data: submissionRecordSchema.nullable(),
  }), payload);
  return response.exists && response.data ? response.data : undefined;
}

export async function createSubmission(values: ArmadaFormValues): Promise<ArmadaSubmissionRecord> {
  const payload = await requestJson("/api/submissions", {
    method: "POST",
    body: JSON.stringify(values),
  });
  return parseApiPayload(z.object({ data: submissionRecordSchema }), payload).data;
}

export async function updateSubmission(
  kodePilokArmada: string,
  values: ArmadaFormValues,
): Promise<ArmadaSubmissionRecord> {
  const payload = await requestJson(
    `/api/submissions/${encodeURIComponent(kodePilokArmada)}`,
    { method: "PUT", body: JSON.stringify(values) },
  );
  return parseApiPayload(z.object({ data: submissionRecordSchema }), payload).data;
}
