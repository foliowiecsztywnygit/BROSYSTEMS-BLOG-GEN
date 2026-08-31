import 'dotenv/config';
import cron from 'node-cron';
import http from 'http';
import { loadClients } from './config';
import { runClientJob } from './engine';

async function bootstrap() {
  console.log('Starting AI Content Engine Turbo...');

  const clients = await loadClients();
  if (clients.length === 0) {
    console.warn('No clients found in config/clients.json. Exiting.');
    process.exit(1);
  }

  console.log(`Loaded ${clients.length} clients from config.`);

  // System kolejkowania zadań, aby uniknąć równoległych deploymentów (ochrona RAMu serwera)
  const jobQueue: typeof clients = [];
  let isProcessingQueue = false;

  async function processQueue() {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    while (jobQueue.length > 0) {
      const client = jobQueue.shift();
      if (client) {
        try {
          await runClientJob(client);
        } catch (err) {
          console.error(`[${client.clientId}] Job in queue failed:`, err);
        }
        
        // Jeśli są kolejne zadania w kolejce, czekamy 5 minut (300 000 ms),
        // aby dać czas Coolify na ukończenie poprzedniego deploymentu bez przeciążania RAMu.
        if (jobQueue.length > 0) {
          console.log(`[Queue] Waiting 5 minutes before starting the next job...`);
          await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
        }
      }
    }

    isProcessingQueue = false;
  }

  for (const client of clients) {
    if (!cron.validate(client.cronSchedule)) {
      console.error(`[${client.clientId}] Invalid cron schedule: ${client.cronSchedule}`);
      continue;
    }

    console.log(`[${client.clientId}] Scheduling job with cron: ${client.cronSchedule}`);
    
    cron.schedule(client.cronSchedule, () => {
      console.log(`[${client.clientId}] Cron triggered. Adding to queue.`);
      jobQueue.push(client);
      processQueue();
    });
  }

  // Uruchomienie wygenerowania po starcie aplikacji (w tle, sekwencyjnie z przerwami)
  console.log('--- Adding initial startup run to queue for all clients ---');
  for (const client of clients) {
    jobQueue.push(client);
  }
  processQueue();

  // Uruchomienie prostego serwera HTTP do health checków dla Coolify
  const port = process.env.PORT || 3000;
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('OK');
  });

  server.listen(port, () => {
    console.log(`Health check server listening on port ${port}`);
  });

  console.log('AI Content Engine Turbo is running in the background.');
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
