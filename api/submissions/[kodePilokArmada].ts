import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  parseRequestBody,
  rejectMethod,
  sendApiError,
  singleQueryValue,
} from "../../server/http";
import { createArmadaService } from "../../server/services/factory";
import type { ArmadaService } from "../../server/services/armadaService";

export function createSubmissionByCodeHandler(
  serviceFactory: () => ArmadaService = createArmadaService,
) {
  return async function submissionByCodeHandler(request: VercelRequest, response: VercelResponse) {
    try {
      if (request.method !== "GET" && request.method !== "PUT") {
        rejectMethod(response, ["GET", "PUT"]);
      }
      const code = singleQueryValue(request.query.kodePilokArmada);
      if (request.method === "GET") {
        const data = await serviceFactory().getSubmission(code);
        response.status(200).json({ exists: Boolean(data), data: data ?? null });
        return;
      }
      const data = await serviceFactory().updateSubmission(code, parseRequestBody(request.body));
      response.status(200).json({ data });
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createSubmissionByCodeHandler();
