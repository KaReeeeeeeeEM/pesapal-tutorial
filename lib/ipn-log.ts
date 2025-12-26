import { promises as fs } from "fs";
import path from "path";

export type IpnLogEntry = {
  receivedAt: string;
  raw: string;
  parsed?: unknown;
};

const LOG_FILE = path.join(process.cwd(), "data", "pesapal-ipn-log.json");

async function ensureLogFile() {
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  try {
    await fs.access(LOG_FILE);
  } catch {
    await fs.writeFile(LOG_FILE, "[]", "utf8");
  }
}

export async function appendIpnLog(raw: string) {
  await ensureLogFile();
  let payload: unknown = undefined;
  try {
    payload = JSON.parse(raw);
  } catch {
    payload = undefined;
  }
  const entry: IpnLogEntry = {
    receivedAt: new Date().toISOString(),
    raw,
    parsed: payload,
  };
  const entries = await readIpnLog();
  entries.push(entry);
  await fs.writeFile(LOG_FILE, JSON.stringify(entries, null, 2));
  return entry;
}

export async function readIpnLog() {
  await ensureLogFile();
  const contents = await fs.readFile(LOG_FILE, "utf8");
  try {
    const parsed = JSON.parse(contents);
    return Array.isArray(parsed) ? (parsed as IpnLogEntry[]) : [];
  } catch {
    return [];
  }
}
