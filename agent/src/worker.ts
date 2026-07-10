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
 * VERIFIED against the installed @livekit/agents / agents-plugin-openai type
 * definitions (v1.x) before writing a line of this — not guessed from docs.
 *
 * Runs on OpenAI's Realtime API (gpt-realtime-mini) as a single audio-in/
 * audio-out model, not a separate STT -> LLM -> TTS chain. The first live
 * test (recording analysed with ffmpeg silencedetect, not just listened to)
 * measured six gaps of 6-20 seconds per call — the cost of three sequential,
 * un-overlapped network round-trips per turn. A single realtime connection
 * removes that handoff entirely. Cost is comparable, not a step up:
 * gpt-realtime-mini runs ~$0.06-0.15/min in production versus ~$0.04-0.07/min
 * blended for the three-call pipeline it replaces.
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
      llm: new openai.realtime.RealtimeModel({
        model: 'gpt-realtime-mini',
        voice: 'sage',
        // Model-based end-of-turn detection rather than a fixed silence
        // timer: it can tell "I'm done talking" from "I'm mid-thought" by
        // meaning, not just a pause length. A real test call showed the
        // delay growing with utterance length under 'medium' — the model
        // needed more confidence before committing to "their turn is over"
        // on longer, more complex speech. 'high' commits to that call sooner,
        // trading a small risk of jumping in on a mid-thought pause for less
        // dead air on longer turns — tune again from the next real call.
        turnDetection: { type: 'semantic_vad', eagerness: 'high' },
      }),
      // No separate stt/tts: the realtime model handles audio both ways.
    });

    const agent = new Agent({ instructions: JANE_INSTRUCTIONS });

    await session.start({ agent, room: ctx.room });

    // session.say() requires a standalone TTS and throws when there is only
    // a RealtimeModel — checked against the actual say() implementation, not
    // assumed. generateReply() goes through the model itself instead. The
    // greeting carries the KDPA recording/automation disclosure, so it must
    // be said verbatim, not paraphrased — told to explicitly, not left to
    // the model's judgement the way a normal reply would be.
    session.generateReply({
      instructions: `Say exactly this, word for word, with nothing added or changed: "${JANE_GREETING}"`,
    });
  },
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  cli.runApp(new ServerOptions({ agent: fileURLToPath(import.meta.url), agentName: 'wizag-voice' }));
}
