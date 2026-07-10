import { fileURLToPath } from 'node:url';
import { Agent, AgentSession, cli, defineAgent, ServerOptions, type JobContext } from '@livekit/agents';
import * as openai from '@livekit/agents-plugin-openai';
import { JANE_GREETING, JANE_INSTRUCTIONS } from './personas/jane.js';

/**
 * WizAG voice worker — Jane (AI BDR) today, Wanjiru (VSM) once the Meeting
 * Room ships. Which persona runs is decided by room dispatch metadata; the
 * whole point of putting both on LiveKit is that this is the only worker
 * either of them ever needs.
 *
 * VERIFIED against the installed @livekit/agents / agents-plugin-openai /
 * agents-plugin-silero type definitions (v1.x) before writing a line of
 * this — not guessed from docs. Runtime behaviour is still unverified until
 * it's run against a live LiveKit project (see docs/AI-VOICE-LIVEKIT.md §5
 * step 2: Agents Playground first, phone call last).
 */

type PersonaMetadata = { persona?: 'jane' | 'wanjiru' };

export default defineAgent({
  // No prewarm: AgentSession auto-provisions the bundled silero VAD (via
  // @livekit/local-inference) when no `vad=` is passed. The standalone
  // @livekit/agents-plugin-silero package is deprecated as of this SDK
  // version — the framework told us so at runtime, not the docs.
  entry: async (ctx: JobContext) => {
    await ctx.connect();

    const meta: PersonaMetadata = ctx.job.metadata ? JSON.parse(ctx.job.metadata) : {};
    const persona = meta.persona ?? 'jane';

    if (persona !== 'jane') {
      // Wanjiru's Meeting Room persona lands in Phase 4 (docs/VSM-SPEC.md §4.9).
      // Fail loudly rather than silently answering as the wrong persona.
      throw new Error(`Unknown or not-yet-built persona: ${persona}`);
    }

    const session = new AgentSession({
      stt: new openai.STT({ model: 'whisper-1' }),
      llm: new openai.LLM({ model: 'gpt-4o-mini', temperature: 0.7 }),
      tts: new openai.TTS({ voice: 'nova' }),
    });

    const agent = new Agent({ instructions: JANE_INSTRUCTIONS });

    await session.start({ agent, room: ctx.room });

    // The first thing the caller hears — same KDPA-disclosure opener used
    // in every voice path built today.
    session.say(JANE_GREETING);
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'wizag-voice' }));
}
