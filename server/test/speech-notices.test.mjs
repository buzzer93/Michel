import test from "node:test";
import assert from "node:assert/strict";
import { ReplyStream, stripRuntimeNotices } from "../speech.mjs";

const NOTICE = "↪️ Model Fallback: ollama/qwen3.5:4b (selected openai/gpt-6-astra; timeout (+1 more attempts))";

test("secours : la mention technique d'OpenClaw n'est ni dite ni affichée", () => {
  assert.equal(stripRuntimeNotices(`12 fois 12 font 144.${NOTICE}`), "12 fois 12 font 144.");
  assert.equal(stripRuntimeNotices(`<voix>Il fait beau.</voix>\n${NOTICE}\nDétail.`), "<voix>Il fait beau.</voix>\nDétail.");
  const s = new ReplyStream();
  assert.deepEqual(s.update(`12 fois 12 font 144.${NOTICE}`, true), ["12 fois 12 font 144."]);
  assert.equal(s.full, "12 fois 12 font 144.");
  assert.equal(stripRuntimeNotices("Le modèle de secours est Qwen."), "Le modèle de secours est Qwen.");   // ordinary text kept
});
