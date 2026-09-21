import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandHeader, FormShell, SectionCard, StatusBanner } from "./FormLayout";

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Unexpected application render failure.", error, info);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <FormShell>
        <BrandHeader />
        <SectionCard>
          <StatusBanner variant="error" title="Aplikasi tidak dapat ditampilkan">
            <p>Terjadi gangguan tak terduga. Muat ulang halaman untuk mencoba kembali.</p>
            <button
              type="button"
              className="button-secondary mt-3"
              onClick={() => window.location.reload()}
            >
              Muat Ulang
            </button>
          </StatusBanner>
        </SectionCard>
      </FormShell>
    );
  }
}
