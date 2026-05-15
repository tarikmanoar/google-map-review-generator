const PROXY_WS =
  "https://hello1.durontobd.net/gemini-proxy/ws/" +
  "google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent";
const PROXY_KEY = "E0EW2cEmxT@EE9K5E81X2l-4IE12qTqQVQ1-2_SShEIAHOzv9Ab1MlZ1c";
const ORIGIN = "https://hello.durontobd.net";
const DEFAULT_MODEL = "models/gemini-2.5-flash-native-audio-preview-09-2025";
const REQUEST_TIMEOUT_MS = 55_000;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type",
  "access-control-max-age": "86400",
};

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...CORS_HEADERS },
  });
}

async function callProxy({ prompt, systemInstruction, model }) {
  const upstream = await fetch(`${PROXY_WS}?key=${PROXY_KEY}`, {
    headers: { Upgrade: "websocket", Origin: ORIGIN },
  });

  const ws = upstream.webSocket;
  if (!ws) {
    throw new Error(`Upstream did not upgrade (status ${upstream.status})`);
  }
  ws.accept();

  return new Promise((resolve, reject) => {
    let transcript = "";
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { ws.close(1000, "done"); } catch {}
      fn(value);
    };

    const timer = setTimeout(
      () => finish(reject, new Error("Upstream timed out")),
      REQUEST_TIMEOUT_MS
    );

    const decoder = new TextDecoder();
    ws.addEventListener("message", (event) => {
      let raw;
      if (typeof event.data === "string") raw = event.data;
      else if (event.data instanceof ArrayBuffer) raw = decoder.decode(event.data);
      else return;

      let msg;
      try { msg = JSON.parse(raw); } catch { return; }

      if (msg.setupComplete) {
        const userText = systemInstruction
          ? `${systemInstruction}\n\n${prompt}`
          : prompt;
        ws.send(
          JSON.stringify({
            clientContent: {
              turns: [{ role: "user", parts: [{ text: userText }] }],
              turnComplete: true,
            },
          })
        );
        return;
      }

      const sc = msg.serverContent;
      if (!sc) return;

      const chunk = sc.outputTranscription?.text;
      if (typeof chunk === "string") transcript += chunk;

      const parts = sc.modelTurn?.parts ?? [];
      for (const part of parts) {
        if (typeof part.text === "string" && part.thought !== true) {
          transcript += part.text;
        }
      }

      if (sc.generationComplete && transcript) {
        finish(resolve, transcript);
        return;
      }
      if (sc.turnComplete) finish(resolve, transcript);
    });

    ws.addEventListener("close", (event) => {
      if (settled) return;
      if (transcript) finish(resolve, transcript);
      else
        finish(
          reject,
          new Error(`Upstream closed (${event.code}): ${event.reason || ""}`)
        );
    });

    ws.addEventListener("error", () =>
      finish(reject, new Error("Upstream websocket error"))
    );

    ws.send(
      JSON.stringify({
        setup: {
          model: model || DEFAULT_MODEL,
          generationConfig: { responseModalities: ["AUDIO"] },
          outputAudioTranscription: {},
        },
      })
    );
  });
}

function cleanTranscript(text) {
  if (typeof text !== "string") return "";
  return text.trim();
}

export default {
  async fetch(request) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    if (request.method === "GET" && url.pathname === "/") {
      return jsonResponse({
        status: "ok",
        usage:
          "POST / with { prompt: string, systemInstruction?: string, model?: string }",
      });
    }

    if (request.method !== "POST") {
      return jsonResponse({ error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: "Body must be JSON" }, 400);
    }

    const { prompt, systemInstruction, model } = body;
    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "Missing 'prompt' string" }, 400);
    }

    try {
      const raw = await callProxy({ prompt, systemInstruction, model });
      const text = cleanTranscript(raw);
      if (!text) {
        return jsonResponse(
          { error: "Model returned no text. Try again or simplify the prompt." },
          502
        );
      }
      return jsonResponse({ text });
    } catch (err) {
      return jsonResponse({ error: err.message || "Worker error" }, 502);
    }
  },
};
