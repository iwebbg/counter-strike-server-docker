const webhook = process.env.DISCORD_WEBHOOK_URL || "";
const importantActions = new Set([
  "server.create",
  "server.delete",
  "server.start",
  "server.stop",
  "server.restart",
  "server.image.update",
  "server.image.update-fleet",
  "player.kick",
  "player.ban",
  "ban.revoke",
  "backup.restore",
  "backup.policy.run",
  "evidence.start",
  "evidence.stop",
]);

export function validDiscordWebhook(value) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(url.hostname) &&
      url.pathname.startsWith("/api/webhooks/")
    );
  } catch {
    return false;
  }
}

export function discordPayload(event, actor = "System") {
  const success = event.status === "success";
  return {
    username: "CS 1.6 Server CP",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        title: `${success ? "✅" : "⚠️"} ${event.action}`,
        color: success ? 0x7ed321 : 0xe74c3c,
        fields: [
          { name: "Operator", value: String(actor || "System").slice(0, 256), inline: true },
          { name: "Status", value: String(event.status || "success"), inline: true },
          ...(event.serverId ? [{ name: "Server", value: String(event.serverId).slice(0, 256), inline: true }] : []),
        ],
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

export async function notifyDiscord(event, actor) {
  if (!validDiscordWebhook(webhook) || !importantActions.has(event.action)) return false;
  const response = await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(discordPayload(event, actor)),
    signal: AbortSignal.timeout(Number(process.env.DISCORD_WEBHOOK_TIMEOUT_MS || 3000)),
  });
  if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}`);
  return true;
}
