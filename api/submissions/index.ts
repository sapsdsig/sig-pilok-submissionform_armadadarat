import type { VercelRequest, VercelResponse } from "@vercel/node";
import { parseRequestBody, rejectMethod, sendApiError } from "../../server/http.js";
import { createArmadaService } from "../../server/services/factory.js";
import type { ArmadaService } from "../../server/services/armadaService.js";

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
