import OpenAI from 'openai';
import { config } from '../../config.js';

export function createOpenAIClient(): OpenAI | null {
  if (!config.openaiApiKey) return null;
  return new OpenAI({ apiKey: config.openaiApiKey });
}

export async function chatJson<T>(
  client: OpenAI,
  system: string,
  user: string,
): Promise<T> {
  const res = await client.chat.completions.create({
    model: config.openaiModel,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });
  const text = res.choices[0]?.message?.content;
  if (!text) throw new Error('Empty LLM response');
  return JSON.parse(text) as T;
}
