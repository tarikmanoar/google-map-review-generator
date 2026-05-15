import WebSocket from "ws";

const PROXY_HOST = "hello1.durontobd.net";
const ORIGIN = "https://hello.durontobd.net";
const API_KEY = "E0EW2cEmxT@EE9K5E81X2l-4IE12qTqQVQ1-2_SShEIAHOzv9Ab1MlZ1c";
const MODEL = "models/gemini-2.5-flash-native-audio-preview-09-2025";
const PROMPT = process.argv.slice(2).join(" ") || "Say hi in one word.";

const url =
  `wss://${PROXY_HOST}/gemini-proxy/ws/` +
  `google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent` +
  `?key=${API_KEY}`;

const ws = new WebSocket(url, { headers: { Origin: ORIGIN } });

const send = (payload) => ws.send(JSON.stringify(payload));

const sendSetup = () =>
  send({
    setup: {
      model: MODEL,
      generationConfig: { responseModalities: ["AUDIO"] },
      outputAudioTranscription: {},
    },
  });

const sendPrompt = (text) =>
  send({
    clientContent: {
      turns: [{ role: "user", parts: [{ text }] }],
      turnComplete: true,
    },
  });

let audioBytes = 0;

const handleMessage = (raw) => {
  const msg = JSON.parse(raw.toString());

  if (msg.setupComplete) {
    console.log("setup complete");
    sendPrompt(PROMPT);
    return;
  }

  const transcript = msg.serverContent?.outputTranscription?.text;
  if (transcript) process.stdout.write(transcript);

  const parts = msg.serverContent?.modelTurn?.parts ?? [];
  for (const part of parts) {
    if (part.text) process.stdout.write(part.text);
    if (part.inlineData?.data) audioBytes += part.inlineData.data.length;
  }

  if (msg.serverContent?.turnComplete) {
    process.stdout.write(`\n[audio: ${audioBytes} base64 bytes]\n`);
    ws.close(1000, "done");
  }
};

ws.on("open", sendSetup);
ws.on("message", handleMessage);
ws.on("error", (e) => console.error("error:", e.message));
ws.on("close", (code, reason) =>
  console.log(`closed ${code}${reason?.length ? ` — ${reason}` : ""}`)
);
