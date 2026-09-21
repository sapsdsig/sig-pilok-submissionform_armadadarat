import type { ArmadaSubmissionRecord, PilokArmadaMaster } from "../../src/types/armada";
import type { ServerConfig } from "../config/env";
import { columnNumberToLetter, quoteSheetName } from "./columns";
import type { SheetsGateway } from "./gateway";
import {
  buildSubmissionRow,
  parseMasterSheet,
  parseSubmissionSheet,
  type SubmissionSheetContext,
} from "./parsers";

export interface ArmadaPersistence {
  listMaster(): Promise<PilokArmadaMaster[]>;
  getMasterByCode(kodePilokArmada: string): Promise<PilokArmadaMaster | undefined>;
  lookupSubmission(kodePilokArmada: string): Promise<SubmissionSheetContext>;
  appendSubmission(record: ArmadaSubmissionRecord, context: SubmissionSheetContext): Promise<void>;
  updateSubmission(record: ArmadaSubmissionRecord, context: SubmissionSheetContext): Promise<void>;
}

export class GoogleSheetsArmadaRepository implements ArmadaPersistence {
  constructor(
    private readonly gateway: SheetsGateway,
    private readonly config: ServerConfig,
  ) {}

  async listMaster(): Promise<PilokArmadaMaster[]> {
    const values = await this.gateway.getValues(`${quoteSheetName(this.config.masterSheetName)}!A:ZZZ`);
    return parseMasterSheet(values, this.config.masterSheetName);
  }

  async getMasterByCode(kodePilokArmada: string): Promise<PilokArmadaMaster | undefined> {
    const master = await this.listMaster();
    return master.find((record) => record.kodePilokArmada === kodePilokArmada);
  }

  async lookupSubmission(kodePilokArmada: string): Promise<SubmissionSheetContext> {
    const values = await this.gateway.getValues(`${quoteSheetName(this.config.submissionSheetName)}!A:ZZZ`);
    return parseSubmissionSheet(values, this.config.submissionSheetName, kodePilokArmada);
  }

  async appendSubmission(record: ArmadaSubmissionRecord, context: SubmissionSheetContext): Promise<void> {
    const row = buildSubmissionRow(context, record);
    await this.gateway.appendValues(
      `${quoteSheetName(this.config.submissionSheetName)}!A:${columnNumberToLetter(context.headers.length)}`,
      [row],
    );
  }

  async updateSubmission(record: ArmadaSubmissionRecord, context: SubmissionSheetContext): Promise<void> {
    if (!context.match) throw new Error("Submission context requires a matching row.");
    const row = buildSubmissionRow(context, record);
    const lastColumn = columnNumberToLetter(context.headers.length);
    await this.gateway.updateValues(
      `${quoteSheetName(this.config.submissionSheetName)}!A${context.match.rowNumber}:${lastColumn}${context.match.rowNumber}`,
      [row],
    );
  }
}
