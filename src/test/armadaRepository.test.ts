import { describe, expect, it, vi } from "vitest";
import { searchPilokArmada } from "../services/armadaRepository";

const response = (body: BodyInit | null, status: number, contentType?: string) => new Response(body, {
  status,
  headers: contentType ? { "Content-Type": contentType } : undefined,
});

describe("API client hardening", () => {
  it("menolak HTML 200 dari Vite SPA fallback dengan error aman", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response("<html>Vite fallback</html>", 200, "text/html"));
    await expect(searchPilokArmada()).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 200,
      message: expect.stringContaining("workflow full-stack"),
    });
  });

  it("menolak JavaScript module yang dikembalikan Vite untuk path fisik API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response("export default {}", 200, "text/javascript"));
    await expect(searchPilokArmada()).rejects.toMatchObject({ code: "UNEXPECTED_RESPONSE" });
  });

  it("menangani HTML error response tanpa membaca body atau stack", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response("<html>internal stack SECRET</html>", 500, "text/html"));
    await expect(searchPilokArmada()).rejects.toMatchObject({
      code: "UNEXPECTED_RESPONSE",
      status: 500,
      message: "Server mengembalikan respons yang tidak dikenali. Silakan coba kembali.",
    });
  });

  it("menangani malformed JSON secara defensif", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response("{not-json", 200, "application/json"));
    await expect(searchPilokArmada()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("menolak JSON sukses dengan struktur data yang salah", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response("{}", 200, "application/json"));
    await expect(searchPilokArmada()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("menangani 204 tanpa crash lalu menolak payload kosong untuk endpoint master", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(null, 204));
    await expect(searchPilokArmada()).rejects.toMatchObject({ code: "INVALID_RESPONSE" });
  });

  it("menormalisasi fetch rejection sebagai NETWORK_ERROR", async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(searchPilokArmada()).rejects.toMatchObject({
      code: "NETWORK_ERROR",
      message: "Server tidak dapat dihubungi.",
    });
  });

  it("mempertahankan error JSON aman dari API", async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response(JSON.stringify({
      error: { code: "CONFIG_ERROR", message: "Konfigurasi layanan belum lengkap." },
    }), 503, "application/json"));
    await expect(searchPilokArmada()).rejects.toMatchObject({
      code: "CONFIG_ERROR",
      status: 503,
      message: "Konfigurasi layanan belum lengkap.",
    });
  });
});
