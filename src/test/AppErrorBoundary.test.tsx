import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppErrorBoundary } from "../components/AppErrorBoundary";

function BrokenChild(): never {
  throw new Error("simulated render failure");
}

describe("AppErrorBoundary", () => {
  it("menampilkan branded fallback untuk exception render tak terduga", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    render(
      <AppErrorBoundary>
        <BrokenChild />
      </AppErrorBoundary>,
    );
    expect(screen.getByRole("heading", { name: "PILOK - Armada Truk" })).toBeInTheDocument();
    expect(screen.getByText("Aplikasi tidak dapat ditampilkan")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Muat Ulang" })).toBeInTheDocument();
    consoleError.mockRestore();
  });
});
