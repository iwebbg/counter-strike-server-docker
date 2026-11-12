import path from "node:path";
import { globSync } from "glob";
import { fileURLToPath, pathToFileURL } from "node:url";
import "./dotenv.mjs";

const sourceDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function discoverRests() {
  const disabledGroups = new Set(
    (process.env.DISABLED_CONTROLLER_GROUPS ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  );
  return globSync(path.join(sourceDirectory, "controllers/*/rest/*.mjs"))
    .filter((file) => !disabledGroups.has(path.relative(sourceDirectory, file).split(path.sep)[1]))
    .sort()
    .map((file) => pathToFileURL(file).href);
}

export default {
  serviceName: process.env.SERVICE_NAME ?? "cs-control-service",
  servicePort: Number.parseInt(process.env.SERVICE_PORT ?? process.env.PANEL_PORT ?? "8080", 10),
  serviceRests: discoverRests(),
};
