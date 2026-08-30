import OpenAI from 'openai';
import { ClientConfig } from './config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GenerateResult {
  title: string;
  description: string;
  date: string;
  slug: string;
  markdown_content: string;
}

export async function generateContent(client: ClientConfig, pastTopics: string[]): Promise<GenerateResult> {
  const currentDate = new Date().toISOString().split('T')[0];
  // Wersja bez zew. API - model wykorzystuje własną wiedzę o lokacji na dany sezon
  const systemPrompt = `You are an expert SEO copywriter and local guide for the business: ${client.clientName}.
You generate ultra-natural, SEO-optimized blog articles in Polish.

CLIENT INFO:
- Type: ${client.clientType}
- Location: ${client.location}
- Main attractions nearby: ${client.attractionsList.join(', ')}
- SEO Keywords: ${client.keywords.join(', ')}

CURRENT CONTEXT:
- Today's Date: ${currentDate}
- Context: Use your internal knowledge about the current season, upcoming holidays, and typical tourist events for this location to make the article relevant.

PAST TOPICS (DO NOT REPEAT):
${pastTopics.length > 0 ? pastTopics.map(t => `- ${t}`).join('\n') : "No past topics."}

REQUIREMENTS:
1. Come up with an engaging, click-worthy title for the article. It should be unique and different from past topics.
2. The article must be highly optimized for local SEO, naturally weaving in the provided keywords.
3. Use Markdown formatting for the content (H2, H3, bullet points, bold text).
4. The tone should be inviting, helpful, and professional.
5. Create a short description (meta description) of max 160 characters.
6. Create a URL-friendly slug based on the title.

You must respond ONLY with a JSON object in the following format:
{
  "title": "Article Title",
  "description": "Short meta description",
  "date": "YYYY-MM-DD",
  "slug": "url-friendly-slug",
  "markdown_content": "The full markdown content of the article (without YAML frontmatter)"
}
`;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: "Proszę wygenerować nowy, optymalizowany pod SEO artykuł na bloga uwzględniając obecny sezon lub wydarzenia." }
    ],
    response_format: { type: "json_object" },
    temperature: 0.7,
  });

  const content = completion.choices[0].message.content;
  if (!content) {
    throw new Error("OpenAI returned empty response");
  }

  const result = JSON.parse(content) as GenerateResult;
  return result;
}
