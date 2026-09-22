import { z } from "zod";
import { AppError } from "../errors.js";

const serverConfigSchema = z.object({
  GOOGLE_CLIENT_ID: z.string().trim().min(1),
  GOOGLE_CLIENT_SECRET: z.string().trim().min(1),
  GOOGLE_REFRESH_TOKEN: z.string().trim().min(1),
  GOOGLE_SPREADSHEET_ID: z.string().trim().min(1),
  GOOGLE_MASTER_SHEET_NAME: z.string().trim().min(1),
  GOOGLE_SUBMISSION_SHEET_NAME: z.string().trim().min(1),
});

export interface ServerConfig {
  googleClientId: string;
  googleClientSecret: string;
  googleRefreshToken: string;
  spreadsheetId: string;
  masterSheetName: string;
  submissionSheetName: string;
}

export function getServerConfig(environment: NodeJS.ProcessEnv = process.env): ServerConfig {
  const result = serverConfigSchema.safeParse(environment);
  if (!result.success) {
    const missing = result.error.issues.map((issue) => issue.path.join(".")).join(", ");
    throw new AppError(
      "CONFIG_ERROR",
      503,
      `Konfigurasi server tidak lengkap: ${missing}.`,
      "Konfigurasi layanan belum lengkap. Hubungi administrator.",
    );
  }

  return {
    googleClientId: result.data.GOOGLE_CLIENT_ID,
    googleClientSecret: result.data.GOOGLE_CLIENT_SECRET,
    googleRefreshToken: result.data.GOOGLE_REFRESH_TOKEN,
    spreadsheetId: result.data.GOOGLE_SPREADSHEET_ID,
    masterSheetName: result.data.GOOGLE_MASTER_SHEET_NAME,
    submissionSheetName: result.data.GOOGLE_SUBMISSION_SHEET_NAME,
  };
}
