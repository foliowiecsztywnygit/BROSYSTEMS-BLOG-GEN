import fs from 'fs/promises';
import path from 'path';

export interface HistoryEntry {
  title: string;
  date: string;
}

export interface ClientHistory {
  [clientId: string]: HistoryEntry[];
}

// Use process.cwd() for Docker compatibility (WORKDIR /app)
// Falls back correctly in both ts-node dev and compiled dist/ contexts
const HISTORY_FILE_PATH = path.resolve(process.cwd(), 'data', 'history.json');

async function ensureHistoryFileExists(): Promise<void> {
  try {
    await fs.access(HISTORY_FILE_PATH);
    console.log(`[History] File found at: ${HISTORY_FILE_PATH}`);
  } catch (error) {
    console.log(`[History] File not found at: ${HISTORY_FILE_PATH}, creating...`);
    // Ensure data directory exists
    await fs.mkdir(path.dirname(HISTORY_FILE_PATH), { recursive: true });
    await fs.writeFile(HISTORY_FILE_PATH, '{}', 'utf-8');
  }
}

async function loadHistory(): Promise<ClientHistory> {
  await ensureHistoryFileExists();
  const data = await fs.readFile(HISTORY_FILE_PATH, 'utf-8');
  try {
    const parsed = JSON.parse(data) as ClientHistory;
    const totalEntries = Object.values(parsed).reduce((sum, entries) => sum + entries.length, 0);
    console.log(`[History] Loaded history: ${Object.keys(parsed).length} clients, ${totalEntries} total entries`);
    return parsed;
  } catch (e) {
    console.error(`[History] Failed to parse history JSON, resetting:`, e);
    return {};
  }
}

export async function getRecentTopics(clientId: string, count: number = 10): Promise<string[]> {
  const history = await loadHistory();
  const clientHistory = history[clientId] || [];
  
  const topics = clientHistory
    .slice(-count)
    .map(entry => entry.title);
  
  console.log(`[History] Client "${clientId}" has ${clientHistory.length} entries, returning last ${topics.length} topics:`);
  topics.forEach((t, i) => console.log(`  ${i + 1}. ${t}`));
  
  return topics;
}

export async function addHistoryEntry(clientId: string, title: string, date: string): Promise<void> {
  const history = await loadHistory();
  if (!history[clientId]) {
    history[clientId] = [];
  }
  
  history[clientId].push({ title, date });
  
  const json = JSON.stringify(history, null, 2);
  await fs.writeFile(HISTORY_FILE_PATH, json, 'utf-8');
  console.log(`[History] Saved entry for "${clientId}": "${title}" (${date}). Total entries for client: ${history[clientId].length}`);
}
