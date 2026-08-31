import { ClientConfig } from './config';
import { getRecentTopics, addHistoryEntry } from './history';
import { generateContent } from './openai';
import { publishToGithub } from './github';

const RETRY_DELAY_MS = 60 * 60 * 1000; // 1 hour

export async function runClientJob(client: ClientConfig, isRetry: boolean = false): Promise<void> {
  const logPrefix = `[${client.clientId}${isRetry ? ' - RETRY' : ''}]`;
  console.log(`${logPrefix} Starting content generation job...`);

  try {
    // 1. Get history
    const pastTopics = await getRecentTopics(client.clientId, 10);
    console.log(`${logPrefix} Loaded ${pastTopics.length} past topics.`);

    // 2. Generate Content
    console.log(`${logPrefix} Calling OpenAI...`);
    const article = await generateContent(client, pastTopics);
    console.log(`${logPrefix} Generated article: "${article.title}"`);

    // 3. Publish to GitHub
    console.log(`${logPrefix} Publishing to GitHub...`);
    await publishToGithub(client, article);

    // 4. Update History
    console.log(`${logPrefix} Updating history...`);
    await addHistoryEntry(client.clientId, article.title, article.date);

    // 5. Trigger Redeploy (if configured)
    if (client.deployWebhookUrl) {
      console.log(`${logPrefix} Triggering redeploy webhook: ${client.deployWebhookUrl}`);
      try {
        const axios = (await import('axios')).default;
        await axios.get(client.deployWebhookUrl);
        console.log(`${logPrefix} Redeploy triggered successfully!`);
      } catch (webhookErr) {
        console.error(`${logPrefix} Redeploy webhook failed (article was published though):`, webhookErr);
      }
    }

    console.log(`${logPrefix} Job completed successfully.`);
  } catch (error) {
    console.error(`${logPrefix} Job failed:`, error);
    
    // Schedule a retry if it's not already a retry, or if you want infinite retries.
    // The prompt says "spróbuj ponownie za godzinę".
    // We will schedule one retry. If it fails again, we might just wait for the next cron.
    if (!isRetry) {
      console.log(`${logPrefix} Scheduling retry in 1 hour...`);
      setTimeout(() => {
        runClientJob(client, true).catch(err => {
          console.error(`[${client.clientId} - RETRY] Retry job failed as well:`, err);
        });
      }, RETRY_DELAY_MS);
    } else {
      console.error(`${logPrefix} Retry failed. Will wait for the next cron schedule.`);
    }
  }
}
