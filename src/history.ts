import fs from 'fs/promises';
import path from 'path';

export interface HistoryEntry {
  title: string;
  date: string;
}

export interface ClientHistory {
  [clientId: string]: HistoryEntry[];
}

const HISTORY_FILE_PATH = path.join(__dirname, '..', 'data', 'history.json');

async function ensureHistoryFileExists(): Promise<void> {
  try {
    await fs.access(HISTORY_FILE_PATH);
  } catch (error) {
    // If the file does not exist, create it with an empty object
    await fs.writeFile(HISTORY_FILE_PATH, '{}', 'utf-8');
  }
}

async function loadHistory(): Promise<ClientHistory> {
  await ensureHistoryFileExists();
  const data = await fs.readFile(HISTORY_FILE_PATH, 'utf-8');
  try {
    return JSON.parse(data) as ClientHistory;
  } catch {
    return {};
  }
}

export async function getRecentTopics(clientId: string, count: number = 10): Promise<string[]> {
  const history = await loadHistory();
  const clientHistory = history[clientId] || [];
  
  // Return the last 'count' titles
  return clientHistory
    .slice(-count)
    .map(entry => entry.title);
}

export async function addHistoryEntry(clientId: string, title: string, date: string): Promise<void> {
  const history = await loadHistory();
  if (!history[clientId]) {
    history[clientId] = [];
  }
  
  history[clientId].push({ title, date });
  
  await fs.writeFile(HISTORY_FILE_PATH, JSON.stringify(history, null, 2), 'utf-8');
}
