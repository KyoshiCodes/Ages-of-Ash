/** Local presentation preferences only. No authoritative player data is persisted in the browser. */
import { create } from "zustand";
const read = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
const initialSpeed = Number(read("ages-motion", "1"));
export const useDeskPreferences = create<{
  speed: number;
  volume: number;
  muted: boolean;
  setSpeed: (value: number) => void;
  setVolume: (value: number) => void;
  setMuted: (value: boolean) => void;
}>((set) => ({
  speed: [0, 0.5, 1, 1.5].includes(initialSpeed) ? initialSpeed : 1,
  volume: Math.max(0, Math.min(0.4, Number(read("ages-volume", ".12")))),
  muted: read("ages-muted", "true") === "true",
  setSpeed: (value) => {
    localStorage.setItem("ages-motion", String(value));
    set({ speed: value });
  },
  setVolume: (value) => {
    localStorage.setItem("ages-volume", String(value));
    set({ volume: value });
  },
  setMuted: (value) => {
    localStorage.setItem("ages-muted", String(value));
    set({ muted: value });
  },
}));
