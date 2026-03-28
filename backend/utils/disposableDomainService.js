import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import cron from "node-cron";

const DISPOSABLE_DOMAIN_SOURCE_URL =
  "https://raw.githubusercontent.com/disposable/disposable-email-domains/master/domains.txt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_DISPOSABLE_FILE_PATH = path.join(
  __dirname,
  "..",
  "data",
  "disposable-domains.txt",
);

let disposableDomainSet = new Set();
let loadedFromDisk = false;

const normalizeDomain = (domain) => domain.trim().toLowerCase();

const parseDomains = (rawText) => {
  const nextSet = new Set();

  rawText.split(/\r?\n/).forEach((line) => {
    const normalized = normalizeDomain(line);
    if (!normalized || normalized.startsWith("#")) {
      return;
    }

    nextSet.add(normalized);
  });

  return nextSet;
};

const ensureDomainFile = async (filePath) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });

  try {
    await fs.access(filePath);
  } catch {
    await fs.writeFile(filePath, "", "utf8");
  }
};

export const loadDisposableDomainsFromFile = async ({
  filePath = DEFAULT_DISPOSABLE_FILE_PATH,
  forceReload = false,
} = {}) => {
  if (!forceReload && loadedFromDisk) {
    return disposableDomainSet;
  }

  await ensureDomainFile(filePath);
  const rawText = await fs.readFile(filePath, "utf8");

  disposableDomainSet = parseDomains(rawText);
  loadedFromDisk = true;

  return disposableDomainSet;
};

export const updateDisposableDomainsFile = async ({
  sourceUrl = DISPOSABLE_DOMAIN_SOURCE_URL,
  filePath = DEFAULT_DISPOSABLE_FILE_PATH,
} = {}) => {
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to fetch disposable domains: ${response.status} ${response.statusText}`,
    );
  }

  const rawText = await response.text();
  const nextSet = parseDomains(rawText);

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${[...nextSet].join("\n")}\n`, "utf8");

  disposableDomainSet = nextSet;
  loadedFromDisk = true;

  return {
    count: disposableDomainSet.size,
    filePath,
    updatedAt: new Date().toISOString(),
  };
};

export const getDisposableDomainSet = () => disposableDomainSet;

export const isDisposableDomain = (domain) => {
  if (!domain) {
    return false;
  }

  return disposableDomainSet.has(normalizeDomain(domain));
};

export const startDisposableDomainAutoUpdate = async ({
  cronExpression = "0 */6 * * *",
  runInitialFetch = true,
  sourceUrl = DISPOSABLE_DOMAIN_SOURCE_URL,
  filePath = DEFAULT_DISPOSABLE_FILE_PATH,
  logger = console,
} = {}) => {
  await loadDisposableDomainsFromFile({ filePath });

  if (runInitialFetch) {
    try {
      const result = await updateDisposableDomainsFile({ sourceUrl, filePath });
      logger.log(
        `[disposable-domains] initial update complete (${result.count} domains)`,
      );
    } catch (error) {
      logger.error(
        `[disposable-domains] initial update failed: ${error.message}`,
      );
    }
  }

  const task = cron.schedule(cronExpression, async () => {
    try {
      const result = await updateDisposableDomainsFile({ sourceUrl, filePath });
      logger.log(
        `[disposable-domains] periodic update complete (${result.count} domains)`,
      );
    } catch (error) {
      logger.error(
        `[disposable-domains] periodic update failed: ${error.message}`,
      );
    }
  });

  return task;
};

export { DISPOSABLE_DOMAIN_SOURCE_URL, DEFAULT_DISPOSABLE_FILE_PATH };
