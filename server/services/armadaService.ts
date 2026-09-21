import { ZodError } from "zod";
import type { ArmadaFormValues, ArmadaSubmissionRecord, PilokArmadaMaster } from "../../src/types/armada";
import { calculateArmadaTotals } from "../../src/utils/armada";
import { AppError } from "../errors";
import type { ArmadaPersistence } from "../sheets/armadaRepository";
import { formatWibTimestamp } from "../time/wib";
import { routeCodeSchema, serverSubmissionSchema } from "../validation/submission";

const invalidRequest = (error: ZodError) => new AppError(
  "INVALID_REQUEST",
  400,
  `Payload tidak valid: ${error.issues.map((issue) => issue.message).join(" ")}`,
  "Data yang dikirim tidak valid. Periksa kembali jumlah Armada.",
);

export class ArmadaService {
  constructor(
    private readonly persistence: ArmadaPersistence,
    private readonly now: () => string = () => formatWibTimestamp(),
  ) {}

  async searchMaster(query = ""): Promise<PilokArmadaMaster[]> {
    const master = await this.persistence.listMaster();
    const normalized = query.trim().toLocaleLowerCase("id-ID");
    if (!normalized) return master;
    return master.filter((record) =>
      [record.kodePilokArmada, record.distributorGroup, record.districtName].some((value) =>
        value.toLocaleLowerCase("id-ID").includes(normalized),
      ),
    );
  }

  async getSubmission(rawCode: unknown): Promise<ArmadaSubmissionRecord | undefined> {
    const parsedCode = routeCodeSchema.safeParse(rawCode);
    if (!parsedCode.success) throw invalidRequest(parsedCode.error);
    return (await this.persistence.lookupSubmission(parsedCode.data)).match?.data;
  }

  async createSubmission(payload: unknown): Promise<ArmadaSubmissionRecord> {
    const parsed = serverSubmissionSchema.safeParse(payload);
    if (!parsed.success) throw invalidRequest(parsed.error);
    const values = parsed.data as ArmadaFormValues;
    const master = await this.requireMaster(values.kodePilokArmada);
    const context = await this.persistence.lookupSubmission(values.kodePilokArmada);
    if (context.match) {
      throw new AppError(
        "SUBMISSION_ALREADY_EXISTS",
        409,
        `Submission ${values.kodePilokArmada} sudah ada.`,
        "Data Armada untuk kode ini sudah ada. Muat ulang lalu simpan sebagai perubahan.",
      );
    }
    const timestamp = this.now();
    const record = this.buildRecord(values, master, timestamp, timestamp);
    await this.persistence.appendSubmission(record, context);
    return record;
  }

  async updateSubmission(rawCode: unknown, payload: unknown): Promise<ArmadaSubmissionRecord> {
    const parsedCode = routeCodeSchema.safeParse(rawCode);
    if (!parsedCode.success) throw invalidRequest(parsedCode.error);
    const parsed = serverSubmissionSchema.safeParse(payload);
    if (!parsed.success) throw invalidRequest(parsed.error);
    if (parsed.data.kodePilokArmada !== parsedCode.data) {
      throw new AppError(
        "INVALID_REQUEST",
        400,
        "Kode route dan payload tidak sama.",
        "Kode Pilok Armada pada permintaan tidak konsisten.",
      );
    }
    const values = parsed.data as ArmadaFormValues;
    const master = await this.requireMaster(parsedCode.data);
    const context = await this.persistence.lookupSubmission(parsedCode.data);
    if (!context.match) {
      throw new AppError(
        "SUBMISSION_NOT_FOUND",
        404,
        `Submission ${parsedCode.data} tidak ditemukan.`,
        "Data Armada belum ditemukan. Muat ulang form sebelum menyimpan.",
      );
    }
    const record = this.buildRecord(values, master, context.match.data.createdAt, this.now());
    await this.persistence.updateSubmission(record, context);
    return record;
  }

  private async requireMaster(kodePilokArmada: string): Promise<PilokArmadaMaster> {
    const master = await this.persistence.getMasterByCode(kodePilokArmada);
    if (!master) {
      throw new AppError(
        "MASTER_NOT_FOUND",
        404,
        `Kode ${kodePilokArmada} tidak ditemukan pada master.`,
        "Kode PILOK Armada tidak ditemukan pada master data.",
      );
    }
    return master;
  }

  private buildRecord(
    values: ArmadaFormValues,
    master: PilokArmadaMaster,
    createdAt: string,
    updatedAt: string,
  ): ArmadaSubmissionRecord {
    return {
      kodePilokArmada: values.kodePilokArmada,
      distributorGroup: master.distributorGroup,
      districtName: master.districtName,
      armada: structuredClone(values.armada),
      total: calculateArmadaTotals(values).total,
      createdAt,
      updatedAt,
    };
  }
}
