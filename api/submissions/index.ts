import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseRequestBody, rejectMethod, sendApiError } from "../../server/http";
import { createArmadaService } from "../../server/services/factory";
import type { ArmadaService } from "../../server/services/armadaService";

export function createSubmissionHandler(serviceFactory: () => ArmadaService = createArmadaService) {
  return async function submissionHandler(request: VercelRequest, response: VercelResponse) {
    try {
      if (request.method !== "POST") rejectMethod(response, ["POST"]);
      const data = await serviceFactory().createSubmission(parseRequestBody(request.body));
      response.status(201).json({ data });
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createSubmissionHandler();
