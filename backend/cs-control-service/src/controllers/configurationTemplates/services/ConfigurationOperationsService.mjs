import { createServer, getServerConfiguration, serverAction } from "../../servers/services/ServersService.mjs";
import { createTemplate, getTemplate, normalizeConfiguration } from "./ConfigurationTemplateService.mjs";
import { updateServerWithHistory } from "../../configurationHistory/services/ConfigurationHistoryService.mjs";

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

export async function applyTemplate(id, templateId, actor) {
  const [current, template] = await Promise.all([getServerConfiguration(id), getTemplate(templateId)]);
  return updateServerWithHistory(
    id,
    {
      ...template.configuration,
      name: current.name,
      port: current.port,
      rconPassword: "",
      serverPassword: "",
      clearServerPassword: false,
    },
    actor,
    `template:${templateId}`,
  );
}

async function deployConfiguration(configuration, overrides, actor, reason) {
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
  const updated = await updateServerWithHistory(
    created.instanceId,
    {
      ...normalized,
      port: created.port,
      rconPassword: "",
      serverPassword: "",
      clearServerPassword: false,
    },
    actor,
    reason,
  );
  if (overrides.startImmediately !== false) await serverAction(created.instanceId, "start");
  return {
    ...updated,
    port: created.port,
    rconPassword: created.rconPassword,
    started: overrides.startImmediately !== false,
  };
}

export async function cloneServer(id, input, actor) {
  const configuration = await getServerConfiguration(id);
  return deployConfiguration(configuration, input, actor, "clone");
}

export async function importConfiguration(document, input, actor) {
  return deployConfiguration(document.configuration, input, actor, "import");
}
