import { google } from "googleapis";
import type { ServerConfig } from "../config/env";

export function createGoogleOAuthClient(config: ServerConfig) {
  const client = new google.auth.OAuth2(
    config.googleClientId,
    config.googleClientSecret,
  );
  client.setCredentials({ refresh_token: config.googleRefreshToken });
  return client;
}
