import { readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import type { VercelRequest, VercelResponse } from "@vercel/node";
import { describe, expect, it, vi } from "vitest";
import { healthHandler } from "../../api/health/index.js";

const collectTypeScriptFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return collectTypeScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
  });

const createResponse = () => {
  const response = {
    setHeader: vi.fn(),
    status: vi.fn(),
    json: vi.fn(),
  };
  response.status.mockReturnValue(response);
  response.json.mockReturnValue(response);
  return response;
};

describe("Vercel production runtime", () => {
  it("health endpoint memberi JSON tanpa mengakses layanan eksternal", () => {
    const response = createResponse();

    healthHandler(
      { method: "GET" } as VercelRequest,
      response as unknown as VercelResponse,
    );

    expect(response.status).toHaveBeenCalledWith(200);
    expect(response.json).toHaveBeenCalledWith({ ok: true, runtime: "vercel" });
  });

  it("health endpoint menolak method lain dengan error JSON", () => {
    const response = createResponse();

    healthHandler(
      { method: "POST" } as VercelRequest,
      response as unknown as VercelResponse,
    );

    expect(response.setHeader).toHaveBeenCalledWith("Allow", "GET");
    expect(response.status).toHaveBeenCalledWith(405);
    expect(response.json).toHaveBeenCalledWith({
      error: {
        code: "METHOD_NOT_ALLOWED",
        message: "Metode permintaan tidak didukung.",
      },
    });
  });

  it("semua import relatif pada graph Function memakai ekstensi ESM", () => {
    const projectRoot = resolve(process.cwd());
    const runtimeFiles = [
      ...collectTypeScriptFiles(join(projectRoot, "api")),
      ...collectTypeScriptFiles(join(projectRoot, "server")),
      join(projectRoot, "src/constants/armada.ts"),
      join(projectRoot, "src/utils/armada.ts"),
    ];
    const importPattern = /(?:from\s+|import\s*\()\s*["'](\.{1,2}\/[^"']+)["']/g;

    for (const file of runtimeFiles) {
      const source = readFileSync(file, "utf8");
      const relativeImports = [...source.matchAll(importPattern)].map((match) => match[1]);
      for (const specifier of relativeImports) {
        expect(specifier, file).toMatch(/\.(?:c?m?js|json)$/);
      }
    }
  });
});
