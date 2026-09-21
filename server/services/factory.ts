import { getServerConfig } from "../config/env";
import { GoogleSheetsArmadaRepository } from "../sheets/armadaRepository";
import { createSheetsGateway } from "../sheets/gateway";
import { ArmadaService } from "./armadaService";

export function createArmadaService(): ArmadaService {
  const config = getServerConfig();
  const gateway = createSheetsGateway(config);
  const repository = new GoogleSheetsArmadaRepository(gateway, config);
  return new ArmadaService(repository);
}
