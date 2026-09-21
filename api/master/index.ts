import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rejectMethod, sendApiError, singleQueryValue } from "../../server/http";
import { createArmadaService } from "../../server/services/factory";
import type { ArmadaService } from "../../server/services/armadaService";

export function createMasterHandler(serviceFactory: () => ArmadaService = createArmadaService) {
  return async function masterHandler(request: VercelRequest, response: VercelResponse) {
    try {
      if (request.method !== "GET") rejectMethod(response, ["GET"]);
      const query = singleQueryValue(request.query.query) ?? "";
      const data = await serviceFactory().searchMaster(query);
      response.status(200).json({ data });
    } catch (error) {
      sendApiError(response, error);
    }
  };
}

export default createMasterHandler();
