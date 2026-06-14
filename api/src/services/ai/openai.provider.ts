import { createReadStream } from 'node:fs';
import { unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

export async function transcribeAudio(client: OpenAI, audioBase64: string, ext: string): Promise<string> {
  const buffer = Buffer.from(audioBase64, 'base64');
  const path = join(tmpdir(), `wizcrm-${Date.now()}.${ext}`);
  await writeFile(path, buffer);
  try {
    const res = await client.audio.transcriptions.create({
      model: 'whisper-1',
      file: createReadStream(path),
    });
    return res.text.trim();
  } finally {
    await unlink(path).catch(() => undefined);
  }
}
