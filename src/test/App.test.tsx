import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { MASTER_PILOK_URL } from "../components/PilokEntryGate";
import { defaultApiHandler } from "./setup";

async function waitForGateReady() {
  await waitFor(() => expect(screen.getByRole("button", { name: "Lanjutkan" })).toBeEnabled());
}

async function continueWithCode(code: string) {
  const user = userEvent.setup();
  await waitForGateReady();
  const input = screen.getByRole("textbox", { name: /Kode PILOK/i });
  await user.clear(input);
  await user.type(input, code);
  await user.click(screen.getByRole("button", { name: "Lanjutkan" }));
  return user;
}

describe("PILOK Armada Darat", () => {
  it("initial page hanya menampilkan gate Kode PILOK", async () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: "PILOK - Armada Darat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Masukkan Kode PILOK" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Data Armada Darat" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Ringkasan Armada" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Simpan Data|Simpan Perubahan/ })).not.toBeInTheDocument();
    await waitForGateReady();
  });

  it("link master memakai URL aman dan membuka tab baru", () => {
    render(<App />);
    const link = screen.getByRole("link", { name: "Lihat Master PILOK di tab baru" });
    expect(link).toHaveAttribute("href", MASTER_PILOK_URL);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("menampilkan loading master dengan gate tetap terlihat dan Lanjutkan disabled", async () => {
    let resolveMaster: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveMaster = resolve;
    }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "Masukkan Kode PILOK" })).toBeInTheDocument();
    expect(screen.getByText("Memuat data master...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lanjutkan" })).toBeDisabled();
    resolveMaster?.(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    expect(await screen.findByText("Master data kosong")).toBeInTheDocument();
    expect(screen.queryByText("Memuat data master...")).not.toBeInTheDocument();
  });

  it("HTML dari /api/master tidak membuat blank screen dan Retry memulihkan master", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html>Vite fallback</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }));
    const user = userEvent.setup();
    render(<App />);
    expect(await screen.findByText("Master data tidak tersedia")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Lihat Master PILOK di tab baru" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lanjutkan" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Coba Lagi" }));
    await waitForGateReady();
    expect(screen.getByRole("textbox", { name: /Kode PILOK/i })).toBeEnabled();
    consoleError.mockRestore();
  });

  it("fetch rejection menyelesaikan loading dan menampilkan Retry", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<App />);
    expect(await screen.findByText("Master data tidak tersedia")).toBeInTheDocument();
    expect(screen.queryByText("Memuat data master...")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("kode kosong menampilkan validasi dan memfokuskan input", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForGateReady();
    await user.click(screen.getByRole("button", { name: "Lanjutkan" }));
    const input = screen.getByRole("textbox", { name: /Kode PILOK/i });
    expect(await screen.findByText("Kode PILOK wajib diisi.")).toBeInTheDocument();
    await waitFor(() => expect(input).toHaveFocus());
    expect(input).toHaveAttribute("aria-describedby", "pilok-code-error");
  });

  it("Enter pada input menjalankan validasi kode", async () => {
    const user = userEvent.setup();
    render(<App />);
    await waitForGateReady();
    const input = screen.getByRole("textbox", { name: /Kode PILOK/i });
    await user.type(input, "99999{enter}");
    expect(await screen.findByText("Periksa kembali kode atau lihat daftar Master PILOK.")).toBeInTheDocument();
  });

  it("kode invalid tidak membuka form utama", async () => {
    render(<App />);
    await continueWithCode("99999");
    expect(await screen.findByText("Periksa kembali kode atau lihat daftar Master PILOK.")).toBeInTheDocument();
    expect(screen.getByText("Kode PILOK tidak ditemukan.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Data Armada Darat" })).not.toBeInTheDocument();
  });

  it("kode valid menampilkan identity read-only dan form utama", async () => {
    render(<App />);
    await continueWithCode("20001");
    expect(await screen.findByText("Edit Data")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Informasi PILOK" })).toBeInTheDocument();
    expect(screen.getByText("ABADI PUTERA WIRAJAYA, PT")).toBeInTheDocument();
    expect(screen.getByText("MADIUN")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Data Armada Darat" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ringkasan Armada" })).toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("kode baru masuk mode Submission Baru dan seluruh input bernilai nol", async () => {
    render(<App />);
    await continueWithCode("20002");
    expect(await screen.findByText("Submission Baru")).toBeInTheDocument();
    const quantities = screen.getAllByRole("spinbutton");
    expect(quantities).toHaveLength(16);
    quantities.forEach((input) => expect(input).toHaveValue(0));
  });

  it("kode existing memuat nilai dan total 9, 0, 9", async () => {
    render(<App />);
    await continueWithCode("20001");
    await screen.findByText("Edit Data");
    expect(screen.getByLabelText("Milik 8 Ton")).toHaveValue(6);
    expect(screen.getByLabelText("Milik 32 Ton")).toHaveValue(3);
    expect(screen.getByLabelText("Total Armada Milik")).toHaveTextContent("9");
    expect(screen.getByLabelText("Total Armada Sewa")).toHaveTextContent("0");
    expect(screen.getByLabelText("Total Armada", { selector: "output" })).toHaveTextContent("9");
  });

  it("total berubah reaktif dan ditampilkan sebagai output non-editable", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    const owned = screen.getByLabelText("Milik 2 Ton");
    const rented = screen.getByLabelText("Sewa 4 Ton");
    await user.clear(owned);
    await user.type(owned, "4");
    await user.clear(rented);
    await user.type(rented, "2");
    expect(screen.getByLabelText("Total Armada Milik")).toHaveTextContent("4");
    expect(screen.getByLabelText("Total Armada Sewa")).toHaveTextContent("2");
    const total = screen.getByLabelText("Total Armada", { selector: "output" });
    expect(total).toHaveTextContent("6");
    expect(total.tagName).toBe("OUTPUT");
  });

  it("Ganti Kode PILOK kembali ke gate dan membersihkan identity", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    await screen.findByText("Submission Baru");
    await user.click(screen.getByRole("button", { name: "Ganti Kode PILOK" }));
    expect(screen.getByRole("heading", { name: "Masukkan Kode PILOK" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Kode PILOK/i })).toHaveValue("");
    expect(screen.queryByText("MAGETAN")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Data Armada Darat" })).not.toBeInTheDocument();
  });

  it("Ganti Kode PILOK meminta konfirmasi bila form sudah berubah", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    const input = screen.getByLabelText("Milik 2 Ton");
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Ganti Kode PILOK" }));
    const dialog = screen.getByRole("dialog", { name: "Ganti Kode PILOK?" });
    await user.click(within(dialog).getByRole("button", { name: "Tetap di Form" }));
    expect(input).toHaveValue(7);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("konfirmasi buang perubahan mereset form ke gate", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    const input = screen.getByLabelText("Milik 2 Ton");
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Ganti Kode PILOK" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Ganti Kode" }));
    expect(screen.getByRole("heading", { name: "Masukkan Kode PILOK" })).toBeInTheDocument();
  });

  it("submit valid membuka dialog dan cancel mempertahankan nilai", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    const input = screen.getByLabelText("Milik 2 Ton");
    await user.clear(input);
    await user.type(input, "7");
    await user.click(screen.getByRole("button", { name: "Simpan Data" }));
    const dialog = await screen.findByRole("dialog", { name: "Konfirmasi Penyimpanan" });
    expect(within(dialog).getAllByText("7 Unit")).toHaveLength(2);
    await user.click(within(dialog).getByRole("button", { name: "Kembali" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Milik 2 Ton")).toHaveValue(7);
  });

  it("konfirmasi submission baru menampilkan success state yang tepat", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    await user.click(screen.getByRole("button", { name: "Simpan Data" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Data Armada berhasil disimpan.")).toBeInTheDocument();
  });

  it("konfirmasi edit menampilkan success state perubahan", async () => {
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20001");
    await user.click(await screen.findByRole("button", { name: "Simpan Perubahan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Perubahan data Armada berhasil disimpan.")).toBeInTheDocument();
  });

  it("menolak negatif dan desimal dengan pesan aksesibel", async () => {
    render(<App />);
    await continueWithCode("20002");
    const negative = screen.getByLabelText("Milik 2 Ton");
    fireEvent.change(negative, { target: { value: "-1" } });
    expect(await screen.findByText("Jumlah armada tidak boleh negatif.")).toBeInTheDocument();
    const decimal = screen.getByLabelText("Sewa 2 Ton");
    fireEvent.change(decimal, { target: { value: "1.5" } });
    expect(await screen.findByText("Jumlah armada harus berupa bilangan bulat.")).toBeInTheDocument();
    expect(negative).toHaveAttribute("aria-invalid", "true");
  });

  it("response kode lama tidak dapat menimpa kode baru", async () => {
    let resolveOldRequest: ((response: Response) => void) | undefined;
    const oldRequest = new Promise<Response>((resolve) => { resolveOldRequest = resolve; });
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input).endsWith("/api/submissions/20002")) return oldRequest;
      return defaultApiHandler(input, init);
    });
    const user = userEvent.setup();
    render(<App />);
    await waitForGateReady();
    const input = screen.getByRole("textbox", { name: /Kode PILOK/i });
    await user.type(input, "20002");
    await user.click(screen.getByRole("button", { name: "Lanjutkan" }));
    expect(screen.getByRole("button", { name: "Memuat data..." })).toBeDisabled();
    await user.clear(input);
    await user.type(input, "20003");
    await user.click(screen.getByRole("button", { name: "Lanjutkan" }));
    expect(await screen.findByText("Submission Baru")).toBeInTheDocument();

    resolveOldRequest?.(new Response(JSON.stringify({
      exists: true,
      data: {
        kodePilokArmada: "20002",
        distributorGroup: "OLD",
        districtName: "OLD",
        armada: {
          milik: { ton2: 99, ton4: 0, ton6: 0, ton8: 0, ton10: 0, ton16: 0, ton24: 0, ton32: 0 },
          sewa: { ton2: 0, ton4: 0, ton6: 0, ton8: 0, ton10: 0, ton16: 0, ton24: 0, ton32: 0 },
        },
        total: 99,
        createdAt: "20-09-2026 08:00:00",
        updatedAt: "20-09-2026 08:00:00",
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await waitFor(() => expect(screen.getByText("NGAWI")).toBeInTheDocument());
    expect(screen.getByLabelText("Milik 2 Ton")).toHaveValue(0);
    expect(screen.queryByText("OLD")).not.toBeInTheDocument();
  });

  it("save gagal mempertahankan seluruh nilai form", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    render(<App />);
    await continueWithCode("20002");
    const input = screen.getByLabelText("Milik 2 Ton");
    await user.clear(input);
    await user.type(input, "7");
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify({
      error: { code: "SHEETS_WRITE_ERROR", message: "Data belum dapat disimpan." },
    }), { status: 503, headers: { "Content-Type": "application/json" } }));
    await user.click(screen.getByRole("button", { name: "Simpan Data" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText(/Data gagal disimpan/)).toBeInTheDocument();
    expect(screen.getByLabelText("Milik 2 Ton")).toHaveValue(7);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    consoleError.mockRestore();
  });
});
