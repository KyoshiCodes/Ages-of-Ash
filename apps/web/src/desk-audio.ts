/** Lazy streamed original Opus audio. Instantiated only from an explicit user gesture. */
let base: HTMLAudioElement | undefined, district: HTMLAudioElement | undefined;
let fadingOut: HTMLAudioElement | undefined;
const visibility = () => {
  if (document.hidden) {
    base?.pause();
    district?.pause();
    fadingOut?.pause();
  } else if (!muted) {
    void base?.play().catch(() => undefined);
    void district?.play().catch(() => undefined);
  }
};
let volume = 0.12,
  muted = true,
  current = -1,
  fade: ReturnType<typeof setInterval> | undefined;
const element = (name: string, loop = false) => {
  const audio = new Audio(`/audio/${name}.webm`);
  audio.loop = loop;
  audio.preload = "none";
  return audio;
};
export async function unlockAudio(era: number, level: number) {
  volume = level;
  muted = false;
  base ??= element("ambient-base", true);
  base.volume = volume * 0.3;
  await base.play();
  await districtAudio(era);
  document.addEventListener("visibilitychange", visibility);
}
export async function districtAudio(era: number) {
  if (muted || current === era) return;
  clearInterval(fade);
  fadingOut?.pause();
  current = era;
  const previous = district;
  fadingOut = previous;
  district = element(`district-${era}`, true);
  const next = district;
  next.volume = 0;
  await next.play();
  if (district !== next) {
    next.pause();
    return;
  }
  clearInterval(fade);
  let step = 0;
  fade = setInterval(() => {
    step++;
    const factor = Math.min(1, step / 20);
    next.volume = muted ? 0 : volume * 0.6 * factor;
    if (previous) previous.volume = muted ? 0 : volume * 0.6 * (1 - factor);
    if (factor >= 1) {
      clearInterval(fade);
      previous?.pause();
    }
  }, 40);
}
export function stopAudio() {
  clearInterval(fade);
  base?.pause();
  district?.pause();
  fadingOut?.pause();
  document.removeEventListener("visibilitychange", visibility);
  base = undefined;
  district = undefined;
  fadingOut = undefined;
  current = -1;
  muted = true;
}
export function audioPreferences(nextVolume: number, nextMuted: boolean) {
  volume = nextVolume;
  muted = nextMuted;
  if (base) {
    base.volume = muted ? 0 : volume * 0.3;
    if (muted) base.pause();
    else if (!document.hidden) void base.play().catch(() => undefined);
  }
  if (district) {
    district.volume = muted ? 0 : volume * 0.6;
    if (muted) district.pause();
    else if (!document.hidden) void district.play().catch(() => undefined);
  }
}
export function cue(kind: "click" | "success" | "failure") {
  if (muted || document.hidden) return;
  const audio = element(kind);
  audio.volume = volume * 0.55;
  void audio.play().catch(() => undefined);
}
