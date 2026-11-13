import {
  createServer,
  getServerConfiguration,
  serverAction,
  updateServer,
} from "../../servers/services/ServersService.mjs";
import { createTemplate, getTemplate, normalizeConfiguration } from "./ConfigurationTemplateService.mjs";

export async function exportConfiguration(id) {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    configuration: normalizeConfiguration(await getServerConfiguration(id)),
  };
}

export async function createTemplateFromServer(id, input, actor) {
  const document = await exportConfiguration(id);
  return createTemplate({ ...input, configuration: document.configuration }, actor);
}

export async function applyTemplate(id, templateId) {
  const [current, template] = await Promise.all([getServerConfiguration(id), getTemplate(templateId)]);
  return updateServer(id, {
    ...template.configuration,
    name: current.name,
    port: current.port,
    rconPassword: "",
    serverPassword: "",
    clearServerPassword: false,
  });
}

async function deployConfiguration(configuration, overrides) {
  const normalized = normalizeConfiguration({
    ...configuration,
    name: overrides.name,
    port: overrides.port ?? null,
  });
  const created = await createServer({
    name: normalized.name,
    mode: normalized.mode,
    maxPlayers: normalized.maxPlayers,
    startMap: normalized.startMap,
    maps: normalized.maps,
    port: normalized.port,
    rconPassword: "",
    serverPassword: "",
    adminSteamIds: "",
    startImmediately: false,
  });
  const updated = await updateServer(created.instanceId, {
    ...normalized,
    port: created.port,
    rconPassword: "",
    serverPassword: "",
    clearServerPassword: false,
  });
  if (overrides.startImmediately !== false) await serverAction(created.instanceId, "start");
  return {
    ...updated,
    port: created.port,
    rconPassword: created.rconPassword,
    started: overrides.startImmediately !== false,
  };
}

export async function cloneServer(id, input) {
  const configuration = await getServerConfiguration(id);
  return deployConfiguration(configuration, input);
}

export async function importConfiguration(document, input) {
  return deployConfiguration(document.configuration, input);
}
