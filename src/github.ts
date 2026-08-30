import axios from 'axios';
import { ClientConfig } from './config';

interface GeneratedArticle {
  title: string;
  description: string;
  date: string;
  slug: string;
  markdown_content: string;
}

export async function publishToGithub(client: ClientConfig, article: GeneratedArticle): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(`Global GitHub token not found in environment variable: GITHUB_TOKEN`);
  }

  const { title, description, date, slug, markdown_content } = article;

  // Format content with Frontmatter
  const fileContent = `---
title: "${title.replace(/"/g, '\\"')}"
description: "${description.replace(/"/g, '\\"')}"
date: "${date}"
slug: "${slug}"
---
${markdown_content}
`;

  // Encode to Base64
  const contentBase64 = Buffer.from(fileContent, 'utf-8').toString('base64');

  const filePath = `${client.destinationFolder.replace(/^\/+|\/+$/g, '')}/${slug}.md`;
  const url = `https://api.github.com/repos/${client.githubRepo}/contents/${filePath}`;

  // We are creating a new file, but we should handle the case where it might already exist.
  // The prompt doesn't strictly specify handling file updates, so we assume file creation.
  // If it fails with 422, it might already exist.

  const commitMessage = "feat(seo): auto-generate seasonal article via AI Content Engine";

  await axios.put(
    url,
    {
      message: commitMessage,
      content: contentBase64,
    },
    {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );
  
  console.log(`[${client.clientId}] Successfully published article ${slug}.md to ${client.githubRepo}`);
}
