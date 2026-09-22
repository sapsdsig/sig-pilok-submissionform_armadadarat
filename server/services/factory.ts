import { getServerConfig } from "../config/env.js";
import { GoogleSheetsArmadaRepository } from "../sheets/armadaRepository.js";
import { createSheetsGateway } from "../sheets/gateway.js";
import { ArmadaService } from "./armadaService.js";

export function createArmadaService(): ArmadaService {
  const config = getServerConfig();
  const gateway = createSheetsGateway(config);
  const repository = new GoogleSheetsArmadaRepository(gateway, config);
  return new ArmadaService(repository);
}
