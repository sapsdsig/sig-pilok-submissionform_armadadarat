import type { VercelRequest, VercelResponse } from "@vercel/node";
import { rejectMethod, sendApiError } from "../../server/http.js";

export function healthHandler(request: VercelRequest, response: VercelResponse): void {
  try {
    if (request.method !== "GET") rejectMethod(response, ["GET"]);
    response.status(200).json({ ok: true, runtime: "vercel" });
  } catch (error) {
    sendApiError(response, error);
  }
}

export default healthHandler;
