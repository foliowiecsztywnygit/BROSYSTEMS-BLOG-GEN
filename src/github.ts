import axios from 'axios';
import { ClientConfig } from './config';

interface GeneratedArticle {
  title: string;
  description: string;
  date: string;
  slug: string;
  markdown_content: string;
  // Extended frontmatter fields (B2B)
  metaTitle?: string;
  metaDescription?: string;
  category?: string;
  readTime?: string;
  updatedAt?: string;
  excerpt?: string;
  relatedSlugs?: string[];
  ctaTitle?: string;
  ctaDescription?: string;
  ctaLabel?: string;
  ctaHref?: string;
}

function escapeYaml(value: string): string {
  return value.replace(/"/g, '\\"');
}

/**
 * Build YAML frontmatter dynamically based on available fields.
 * B2B articles include full 14-field schema (metaTitle, category, CTA, etc.)
 * B2C articles fallback to basic 4-field schema (title, description, date, slug)
 */
function buildFrontmatter(article: GeneratedArticle): string {
  const lines: string[] = ['---'];

  // Title (always)
  lines.push(`title: "${escapeYaml(article.title)}"`);

  // metaTitle (B2B)
  if (article.metaTitle) {
    lines.push(`metaTitle: "${escapeYaml(article.metaTitle)}"`);
  }

  // metaDescription (B2B) — falls back to description for B2C via normalizePost()
  if (article.metaDescription) {
    lines.push(`metaDescription: "${escapeYaml(article.metaDescription)}"`);
  }

  // Slug (always)
  lines.push(`slug: "${article.slug}"`);

  // Category (B2B)
  if (article.category) {
    lines.push(`category: "${escapeYaml(article.category)}"`);
  }

  // Read time (B2B — estimated from body for B2C via normalizePost())
  if (article.readTime) {
    lines.push(`readTime: "${article.readTime}"`);
  }

  // Date: prefer updatedAt (Polish format) for B2B, fallback to ISO date for B2C
  if (article.updatedAt) {
    lines.push(`updatedAt: "${article.updatedAt}"`);
  } else if (article.date) {
    lines.push(`date: "${article.date}"`);
  }

  // Excerpt (B2B) or description (B2C fallback)
  if (article.excerpt) {
    lines.push(`excerpt: "${escapeYaml(article.excerpt)}"`);
  } else if (article.description) {
    lines.push(`description: "${escapeYaml(article.description)}"`);
  }

  // Related slugs (B2B)
  if (article.relatedSlugs && article.relatedSlugs.length > 0) {
    lines.push(`relatedSlugs: [${article.relatedSlugs.map(s => `"${s}"`).join(', ')}]`);
  }

  // CTA fields (B2B)
  if (article.ctaTitle) {
    lines.push(`ctaTitle: "${escapeYaml(article.ctaTitle)}"`);
  }
  if (article.ctaDescription) {
    lines.push(`ctaDescription: "${escapeYaml(article.ctaDescription)}"`);
  }
  if (article.ctaLabel) {
    lines.push(`ctaLabel: "${escapeYaml(article.ctaLabel)}"`);
  }
  if (article.ctaHref) {
    lines.push(`ctaHref: "${article.ctaHref}"`);
  }

  lines.push('---');
  return lines.join('\n');
}

export async function publishToGithub(client: ClientConfig, article: GeneratedArticle): Promise<void> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error(`Global GitHub token not found in environment variable: GITHUB_TOKEN`);
  }

  const { slug, markdown_content } = article;

  // Format content with Frontmatter
  let fileContent = markdown_content;
  if (!fileContent.trim().startsWith('---')) {
    fileContent = `${buildFrontmatter(article)}\n${markdown_content}\n`;
  }

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
