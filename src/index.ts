import 'dotenv/config';
import cron from 'node-cron';
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

  console.log('AI Content Engine Turbo is running in the background.');
}

bootstrap().catch(err => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
