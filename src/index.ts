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

  for (const client of clients) {
    if (!cron.validate(client.cronSchedule)) {
      console.error(`[${client.clientId}] Invalid cron schedule: ${client.cronSchedule}`);
      continue;
    }

    console.log(`[${client.clientId}] Scheduling job with cron: ${client.cronSchedule}`);
    
    cron.schedule(client.cronSchedule, () => {
      console.log(`[${client.clientId}] Cron triggered.`);
      runClientJob(client).catch(err => {
        console.error(`[${client.clientId}] Unhandled error in cron job execution:`, err);
      });
    });
  }

  // Uruchomienie wygenerowania po starcie aplikacji (w tle, sekwencyjnie, by uniknąć rate-limitów OpenAI)
  (async () => {
    console.log('--- Starting initial startup run for all clients ---');
    for (const client of clients) {
      try {
        await runClientJob(client);
      } catch (err) {
        console.error(`[${client.clientId}] Startup run failed:`, err);
      }
    }
    console.log('--- Initial startup run completed ---');
  })();

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
