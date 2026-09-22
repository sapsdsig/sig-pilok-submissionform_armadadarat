import { google } from "googleapis";
import type { ServerConfig } from "../config/env.js";
import { AppError } from "../errors.js";
import { createGoogleOAuthClient } from "../google/auth.js";

export interface SheetsGateway {
  getValues(range: string): Promise<unknown[][]>;
  appendValues(range: string, values: unknown[][]): Promise<void>;
  updateValues(range: string, values: unknown[][]): Promise<void>;
  getSheetTitles(): Promise<string[]>;
}

export function createSheetsGateway(config: ServerConfig): SheetsGateway {
  const auth = createGoogleOAuthClient(config);
  const sheets = google.sheets({ version: "v4", auth });

  return {
    async getValues(range) {
      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range,
          valueRenderOption: "UNFORMATTED_VALUE",
        });
        return (response.data.values ?? []) as unknown[][];
      } catch (error) {
        throw new AppError(
          "SHEETS_READ_ERROR",
          503,
          `Gagal membaca Google Sheets pada range ${range}.`,
          "Data belum dapat dimuat dari layanan penyimpanan. Silakan coba kembali.",
          { cause: error },
        );
      }
    },

    async appendValues(range, values) {
      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: config.spreadsheetId,
          range,
          valueInputOption: "RAW",
          insertDataOption: "INSERT_ROWS",
          requestBody: { values },
        });
      } catch (error) {
        throw new AppError(
          "SHEETS_WRITE_ERROR",
          503,
          `Gagal menambah row Google Sheets pada range ${range}.`,
          "Data belum dapat disimpan. Silakan coba kembali.",
          { cause: error },
        );
      }
    },

    async updateValues(range, values) {
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: config.spreadsheetId,
          range,
          valueInputOption: "RAW",
          requestBody: { values },
        });
      } catch (error) {
        throw new AppError(
          "SHEETS_WRITE_ERROR",
          503,
          `Gagal memperbarui Google Sheets pada range ${range}.`,
          "Data belum dapat disimpan. Silakan coba kembali.",
          { cause: error },
        );
      }
    },

    async getSheetTitles() {
      try {
        const response = await sheets.spreadsheets.get({
          spreadsheetId: config.spreadsheetId,
          fields: "sheets.properties.title",
        });
        return (response.data.sheets ?? [])
          .map((sheet) => sheet.properties?.title)
          .filter((title): title is string => Boolean(title));
      } catch (error) {
        throw new AppError(
          "SHEETS_READ_ERROR",
          503,
          "Spreadsheet tidak dapat diakses.",
          "Layanan penyimpanan belum dapat diakses. Silakan coba kembali.",
          { cause: error },
        );
      }
    },
  };
}
