import "./dotenv.mjs";

const boolean = (value, fallback = true) => {
  if (value === undefined) return fallback;
  return ["1", "true", "yes", "on"].includes(String(value).toLowerCase());
};

export default {
  showErrorLogs: boolean(process.env.SHOW_ERROR_LOGS),
  showConsoleLogs: boolean(process.env.SHOW_CONSOLE_LOGS),
};
