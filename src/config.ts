import fs from 'fs/promises';
import path from 'path';

export interface ClientConfig {
  clientId: string;
  clientName: string;
  clientType: string;
  location: string;
  attractionsList: string[];
  keywords: string[];
  githubRepo: string;
  destinationFolder: string;
  cronSchedule: string;
  deployWebhookUrl?: string;
}

const CONFIG_FILE_PATH = path.resolve(process.cwd(), 'config', 'clients.json');

export async function loadClients(): Promise<ClientConfig[]> {
  try {
    const data = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
    return JSON.parse(data) as ClientConfig[];
  } catch (error) {
    console.error(`Failed to load clients config from ${CONFIG_FILE_PATH}:`, error);
    return [];
  }
}
