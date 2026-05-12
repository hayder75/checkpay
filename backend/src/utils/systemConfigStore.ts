import { promises as fs } from 'fs';
import path from 'path';

export type BillingMode = 'COUNT_BASED' | 'FIXED_PRICE';

interface StoredSystemConfig {
  billingMode: BillingMode;
  updatedAt: string;
  updatedBy?: string;
}

const DEFAULT_CONFIG: StoredSystemConfig = {
  billingMode: 'COUNT_BASED',
  updatedAt: new Date(0).toISOString(),
};

const CONFIG_DIR = path.join(process.cwd(), 'data');
const CONFIG_PATH = path.join(CONFIG_DIR, 'system-config.json');

async function ensureConfigFile(): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });

  try {
    await fs.access(CONFIG_PATH);
  } catch {
    await fs.writeFile(CONFIG_PATH, JSON.stringify(DEFAULT_CONFIG, null, 2), 'utf8');
  }
}

export async function getSystemConfig(): Promise<StoredSystemConfig> {
  await ensureConfigFile();

  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<StoredSystemConfig>;

    if (parsed.billingMode !== 'COUNT_BASED' && parsed.billingMode !== 'FIXED_PRICE') {
      return DEFAULT_CONFIG;
    }

    return {
      billingMode: parsed.billingMode,
      updatedAt: parsed.updatedAt || DEFAULT_CONFIG.updatedAt,
      updatedBy: parsed.updatedBy,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

export async function setBillingMode(billingMode: BillingMode, updatedBy?: string): Promise<StoredSystemConfig> {
  const nextConfig: StoredSystemConfig = {
    billingMode,
    updatedAt: new Date().toISOString(),
    ...(updatedBy ? { updatedBy } : {}),
  };

  await ensureConfigFile();
  await fs.writeFile(CONFIG_PATH, JSON.stringify(nextConfig, null, 2), 'utf8');

  return nextConfig;
}
