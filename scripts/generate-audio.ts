/** Render original synthesized tones to streamed Opus assets using native Chromium's MediaRecorder. No third-party music. */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const definitions = [
  { name: "ambient-base", seconds: 8, frequencies: [55, 110], ambient: true },
  ...[82.4, 98, 73.4, 123.5].map((f, i) => ({
    name: `district-${i}`,
    seconds: 8,
    frequencies: [f, f * 1.5, f * 2],
    ambient: true,
  })),
  {
    name: "success",
    seconds: 0.65,
    frequencies: [440, 550, 660],
    ambient: false,
  },
  {
    name: "failure",
    seconds: 0.65,
    frequencies: [220, 196, 146.8],
    ambient: false,
  },
  { name: "click", seconds: 0.12, frequencies: [900], ambient: false },
];
mkdirSync("apps/web/public/audio", { recursive: true });
const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required"],
});
try {
  await Promise.all(
    definitions.map(async (def) => {
      const page = await browser.newPage();
      const bytes = await page.evaluate(
        async ({ seconds, frequencies, ambient }) => {
          const context = new AudioContext({ sampleRate: 48000 });
          await context.resume();
          const destination = context.createMediaStreamDestination();
          const recorder = new MediaRecorder(destination.stream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: 48000,
          });
          const chunks: Blob[] = [];
          const result = new Promise<number[]>((resolve) => {
            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = async () =>
              resolve(
                Array.from(
                  new Uint8Array(await new Blob(chunks).arrayBuffer()),
                ),
              );
          });
          recorder.start();
          for (const [fIndex, f] of frequencies.entries()) {
            const oscillator = context.createOscillator(),
              gain = context.createGain();
            oscillator.frequency.value = f;
            oscillator.type = "sine";
            const start = context.currentTime + (ambient ? 0 : fIndex * 0.07);
            gain.gain.setValueAtTime(0, start);
            gain.gain.linearRampToValueAtTime(
              ambient ? 0.12 : 0.18,
              start + (ambient ? 0.6 : 0.025),
            );
            gain.gain.linearRampToValueAtTime(0, start + seconds - 0.02);
            oscillator.connect(gain).connect(destination);
            oscillator.start(start);
            oscillator.stop(context.currentTime + seconds);
          }
          await new Promise((resolve) =>
            setTimeout(resolve, seconds * 1000 + 150),
          );
          recorder.stop();
          const value = await result;
          await context.close();
          return value;
        },
        def,
      );
      writeFileSync(
        `apps/web/public/audio/${def.name}.webm`,
        Buffer.from(bytes),
      );
      await page.close();
      console.log(`${def.name}: ${bytes.length} bytes`);
    }),
  );
} finally {
  await browser.close();
}
