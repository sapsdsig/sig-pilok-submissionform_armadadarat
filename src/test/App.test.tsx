import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import App from "../App";
import { defaultApiHandler } from "./setup";

async function selectCode(code: string) {
  const user = userEvent.setup();
  const combobox = screen.getByRole("combobox", { name: /Kode Pilok Armada/i });
  await user.click(combobox);
  await user.clear(combobox);
  await user.type(combobox, code);
  await user.click(await screen.findByRole("option", { name: new RegExp(code) }));
  return user;
}

describe("PILOK Armada Darat", () => {
  it("menampilkan loading master selama request startup belum selesai", async () => {
    let resolveMaster: ((response: Response) => void) | undefined;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise<Response>((resolve) => {
      resolveMaster = resolve;
    }));
    render(<App />);
    expect(screen.getByRole("heading", { name: "PILOK - Armada Darat" })).toBeInTheDocument();
    expect(screen.getByText("Memuat master data…")).toBeInTheDocument();
    resolveMaster?.(new Response(JSON.stringify({ data: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }));
    expect(await screen.findByText("Master data kosong")).toBeInTheDocument();
    expect(screen.queryByText("Memuat master data…")).not.toBeInTheDocument();
  });

  it("HTML dari /api/master tidak membuat blank screen dan Retry memulihkan master", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockResolvedValueOnce(new Response("<html>Vite fallback</html>", {
      status: 200,
      headers: { "Content-Type": "text/html" },
    }));
    const user = userEvent.setup();
    render(<App />);
    expect(screen.getByRole("heading", { name: "PILOK - Armada Darat" })).toBeInTheDocument();
    expect(await screen.findByText("Master data tidak tersedia")).toBeInTheDocument();
    expect(screen.queryByText("Memuat master data…")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Coba Lagi" }));
    await waitFor(() => expect(screen.getByRole("combobox")).toBeEnabled());
    await user.click(screen.getByRole("combobox"));
    expect(await screen.findByRole("option", { name: /20001/ })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("fetch rejection menyelesaikan loading dan menampilkan error state", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError("Failed to fetch"));
    render(<App />);
    expect(await screen.findByText("Master data tidak tersedia")).toBeInTheDocument();
    expect(screen.queryByText("Memuat master data…")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Coba Lagi" })).toBeInTheDocument();
    consoleError.mockRestore();
  });

  it("tidak menampilkan error wajib sebelum interaksi atau submit", () => {
    render(<App />);
    expect(screen.queryByText("Kode Pilok Armada wajib dipilih.")).not.toBeInTheDocument();
  });

  it("searchable select memfilter berdasarkan distributor dan district", async () => {
    const user = userEvent.setup();
    render(<App />);
    const combobox = screen.getByRole("combobox", { name: /Kode Pilok Armada/i });
    await user.click(combobox);
    await user.type(combobox, "aceh barat");
    expect(await screen.findByRole("option", { name: /20006/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /20001/i })).not.toBeInTheDocument();
  });

  it("memilih kode menyelesaikan Distributor Group dan District Name", async () => {
    render(<App />);
    await selectCode("20001");
    expect(await screen.findByText("Edit Data")).toBeInTheDocument();
    expect(screen.getByText("ABADI PUTERA WIRAJAYA, PT")).toBeInTheDocument();
    expect(screen.getByText("MADIUN")).toBeInTheDocument();
  });

  it("kode baru masuk mode Submission Baru dan seluruh input bernilai nol", async () => {
    render(<App />);
    await selectCode("20002");
    expect(await screen.findByText("Submission Baru")).toBeInTheDocument();
    const quantities = screen.getAllByRole("spinbutton");
    expect(quantities).toHaveLength(16);
    quantities.forEach((input) => expect(input).toHaveValue(0));
  });

  it("20001 memuat nilai existing dan total 9, 0, 9", async () => {
    render(<App />);
    await selectCode("20001");
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
    await selectCode("20002");
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

  it("menampilkan dan memfokuskan error Kode Pilok pada submit invalid", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "Simpan Data" }));
    const combobox = screen.getByRole("combobox", { name: /Kode Pilok Armada/i });
    expect(await screen.findByText("Kode Pilok Armada wajib dipilih.")).toBeInTheDocument();
    await waitFor(() => expect(combobox).toHaveFocus());
  });

  it("submit valid membuka dialog dan cancel mempertahankan nilai", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectCode("20002");
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
    await selectCode("20002");
    await user.click(screen.getByRole("button", { name: "Simpan Data" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Data Armada berhasil disimpan.")).toBeInTheDocument();
  });

  it("konfirmasi edit menampilkan success state perubahan", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectCode("20001");
    await user.click(await screen.findByRole("button", { name: "Simpan Perubahan" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Simpan" }));
    expect(await screen.findByText("Perubahan data Armada berhasil disimpan.")).toBeInTheDocument();
  });

  it("pergantian kode tidak membocorkan nilai Armada", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectCode("20002");
    const input = screen.getByLabelText("Milik 2 Ton");
    await user.clear(input);
    await user.type(input, "7");

    await user.click(screen.getByRole("button", { name: "Hapus pilihan Kode Pilok Armada" }));
    const combobox = screen.getByRole("combobox", { name: /Kode Pilok Armada/i });
    await user.type(combobox, "20003");
    await user.click(await screen.findByRole("option", { name: /20003/ }));
    await screen.findByText("Submission Baru");
    expect(screen.getByLabelText("Milik 2 Ton")).toHaveValue(0);

    await user.click(screen.getByRole("button", { name: "Hapus pilihan Kode Pilok Armada" }));
    await user.type(screen.getByRole("combobox"), "20001");
    await user.click(await screen.findByRole("option", { name: /20001/ }));
    await screen.findByText("Edit Data");
    expect(screen.getByLabelText("Milik 8 Ton")).toHaveValue(6);
  });

  it("menolak negatif dan desimal dengan pesan aksesibel", async () => {
    render(<App />);
    await selectCode("20002");
    const negative = screen.getByLabelText("Milik 2 Ton");
    fireEvent.change(negative, { target: { value: "-1" } });
    expect(await screen.findByText("Jumlah armada tidak boleh negatif.")).toBeInTheDocument();
    const decimal = screen.getByLabelText("Sewa 2 Ton");
    fireEvent.change(decimal, { target: { value: "1.5" } });
    expect(await screen.findByText("Jumlah armada harus berupa bilangan bulat.")).toBeInTheDocument();
    expect(negative).toHaveAttribute("aria-invalid", "true");
  });

  it("response kode lama tidak dapat menimpa pilihan kode yang lebih baru", async () => {
    let resolveOldRequest: ((response: Response) => void) | undefined;
    const oldRequest = new Promise<Response>((resolve) => { resolveOldRequest = resolve; });
    vi.mocked(fetch).mockImplementation((input, init) => {
      if (String(input).endsWith("/api/submissions/20002")) return oldRequest;
      return defaultApiHandler(input, init);
    });
    render(<App />);
    await selectCode("20002");
    await selectCode("20003");
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
  });

  it("save gagal mempertahankan seluruh nilai form", async () => {
    const user = userEvent.setup();
    render(<App />);
    await selectCode("20002");
    await screen.findByText("Submission Baru");
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
  });
});
