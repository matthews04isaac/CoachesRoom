import Anthropic from '@anthropic-ai/sdk';
import { ApiError as GoogleApiError, FinishReason, GoogleGenAI } from '@google/genai';
import { HttpError } from './validate.ts';

/**
 * The AI Coach can run on Google Gemini (free tier available) or Anthropic
 * Claude. The provider is picked from whichever key is configured; Gemini wins
 * if both are set unless BENCHIQ_AI_PROVIDER says otherwise.
 */
export type ChatMessage = { role: 'user' | 'assistant'; content: string };
export interface ChatResult {
  text: string;
  truncated: boolean;
  blocked: boolean;
  model: string;
}
interface Provider {
  name: 'gemini' | 'anthropic';
  model: string;
  chat(system: string[], messages: ChatMessage[]): Promise<ChatResult>;
}

const geminiKey = () => process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const anthropicKey = () => process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN;

function gemini(): Provider {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const client = new GoogleGenAI({ apiKey: geminiKey()! });
  return {
    name: 'gemini',
    model,
    async chat(system, messages) {
      const request = {
        model,
        contents: messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
        config: { systemInstruction: system.join('\n\n'), maxOutputTokens: 16000 },
      };
      try {
        // The free tier often answers 503 "high demand"; retry a couple of times with backoff.
        let res;
        for (let attempt = 0; ; attempt++) {
          try {
            res = await client.models.generateContent(request);
            break;
          } catch (e) {
            if (!(e instanceof GoogleApiError) || (e.status !== 503 && e.status !== 500) || attempt >= 2) throw e;
            await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
          }
        }
        const reason = res.candidates?.[0]?.finishReason;
        const blocked = !!res.promptFeedback?.blockReason || reason === FinishReason.SAFETY || reason === FinishReason.PROHIBITED_CONTENT;
        return { text: res.text ?? '', truncated: reason === FinishReason.MAX_TOKENS, blocked, model: res.modelVersion ?? model };
      } catch (e) {
        if (e instanceof GoogleApiError) {
          if (e.status === 400 || e.status === 401 || e.status === 403) throw new HttpError(502, `Google rejected the request — check GEMINI_API_KEY (${e.message.slice(0, 200)})`);
          if (e.status === 429) throw new HttpError(429, 'The free Gemini quota is used up for now. Wait a minute and try again.');
          if (e.status === 503 || e.status === 500) throw new HttpError(503, 'Google’s AI service is busy right now. Try again in a minute.');
          throw new HttpError(502, `AI service error: ${e.message.slice(0, 200)}`);
        }
        throw e;
      }
    },
  };
}

function anthropic(): Provider {
  const model = process.env.BENCHIQ_AI_MODEL || 'claude-opus-5-5';
  const client = new Anthropic();
  return {
    name: 'anthropic',
    model,
    async chat(system, messages) {
      try {
        const res = await client.beta.messages.create({
          model,
          max_tokens: 16000,
          system: system.map((text) => ({ type: 'text' as const, text })),
          messages,
          output_config: { effort: 'medium' },
          // Re-run a safety-classifier decline on Anthropic's recommended fallback model.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        });
        const text = res.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
        return { text, truncated: res.stop_reason === 'max_tokens', blocked: res.stop_reason === 'refusal', model: res.model };
      } catch (e) {
        if (e instanceof Anthropic.AuthenticationError) throw new HttpError(502, 'The AI service rejected the API key. Check ANTHROPIC_API_KEY.');
        if (e instanceof Anthropic.RateLimitError) throw new HttpError(429, 'The AI service is rate limited. Try again in a minute.');
        if (e instanceof Anthropic.APIError) throw new HttpError(502, `AI service error: ${e.message}`);
        throw e;
      }
    },
  };
}

let cached: Provider | null | undefined;
export function aiProvider(): Provider | null {
  if (cached !== undefined) return cached;
  const pref = process.env.BENCHIQ_AI_PROVIDER;
  if (geminiKey() && pref !== 'anthropic') cached = gemini();
  else if (anthropicKey() && pref !== 'gemini') cached = anthropic();
  else cached = null;
  return cached;
}
