import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";

const port = 5173;
const vercelCli = fileURLToPath(
  new URL("../node_modules/vercel/dist/index.js", import.meta.url),
);

await new Promise((resolve, reject) => {
  const probe = createServer();

  probe.once("error", (error) => {
    reject(error);
  });

  probe.listen({ port, exclusive: true }, () => {
    probe.close(resolve);
  });
}).catch((error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${port} sedang digunakan. Hentikan proses tersebut lalu jalankan npm run dev kembali.`,
    );
  } else {
    console.error(`Tidak dapat memeriksa port ${port}: ${error.message}`);
  }

  process.exit(1);
});

const child = spawn(
  process.execPath,
  [vercelCli, "dev", "--yes", "--listen", String(port)],
  {
    stdio: "inherit",
    env: process.env,
  },
);

child.once("error", (error) => {
  console.error(`Tidak dapat menjalankan Vercel development runtime: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exitCode = code ?? 1;
});
