import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import { MOCK_MASTER_DATA } from "../data/mockMasterData";
import { INITIAL_MOCK_SUBMISSIONS } from "../data/mockSubmissions";
import type { ArmadaSubmissionRecord } from "../types/armada";
import { calculateArmadaTotals } from "../utils/armada";

Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
  configurable: true,
  value: vi.fn(),
});

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});

let submissions = new Map<string, ArmadaSubmissionRecord>();

export const defaultApiHandler = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = new URL(String(input), "http://localhost");
  const method = init?.method ?? "GET";
  if (url.pathname === "/api/master" && method === "GET") {
    const query = (url.searchParams.get("query") ?? "").toLocaleLowerCase("id-ID");
    const data = MOCK_MASTER_DATA.filter((record) =>
      !query || [record.kodePilokArmada, record.distributorGroup, record.districtName]
        .some((value) => value.toLocaleLowerCase("id-ID").includes(query)),
    );
    return jsonResponse({ data });
  }
  if (url.pathname === "/api/submissions" && method === "POST") {
    const values = JSON.parse(String(init?.body));
    const master = MOCK_MASTER_DATA.find((record) => record.kodePilokArmada === values.kodePilokArmada)!;
    const record: ArmadaSubmissionRecord = {
      ...values,
      distributorGroup: master.distributorGroup,
      districtName: master.districtName,
      total: calculateArmadaTotals(values).total,
      createdAt: "21-09-2026 12:00:00",
      updatedAt: "21-09-2026 12:00:00",
    };
    submissions.set(record.kodePilokArmada, record);
    return jsonResponse({ data: record }, 201);
  }
  const match = url.pathname.match(/^\/api\/submissions\/(\d+)$/);
  if (match && method === "GET") {
    const data = submissions.get(match[1]);
    return jsonResponse({ exists: Boolean(data), data: data ?? null });
  }
  if (match && method === "PUT") {
    const values = JSON.parse(String(init?.body));
    const previous = submissions.get(match[1])!;
    const master = MOCK_MASTER_DATA.find((record) => record.kodePilokArmada === match[1])!;
    const record: ArmadaSubmissionRecord = {
      ...values,
      distributorGroup: master.distributorGroup,
      districtName: master.districtName,
      total: calculateArmadaTotals(values).total,
      createdAt: previous.createdAt,
      updatedAt: "21-09-2026 12:05:00",
    };
    submissions.set(record.kodePilokArmada, record);
    return jsonResponse({ data: record });
  }
  return jsonResponse({ error: { code: "NOT_FOUND", message: "Not found" } }, 404);
};

beforeEach(() => {
  submissions = new Map(INITIAL_MOCK_SUBMISSIONS.map((submission) => {
    const master = MOCK_MASTER_DATA.find((record) => record.kodePilokArmada === submission.kodePilokArmada)!;
    const record: ArmadaSubmissionRecord = {
      ...structuredClone(submission),
      distributorGroup: master.distributorGroup,
      districtName: master.districtName,
      total: calculateArmadaTotals(submission).total,
      createdAt: submission.createdAt!,
      updatedAt: submission.updatedAt!,
    };
    return [record.kodePilokArmada, record];
  }));
  vi.stubGlobal("fetch", vi.fn(defaultApiHandler));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
