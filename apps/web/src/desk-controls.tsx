/** Gesture-gated media controls and persisted accessibility preferences. */
import { useEffect, useRef, useState } from "react";
import { useDeskPreferences } from "./desk-preferences.ts";
type AudioModule = typeof import("./desk-audio.ts");
export function DeskControls({ era, notice }: { era: number; notice: string }) {
  const { speed, volume, muted, setSpeed, setVolume, setMuted } =
    useDeskPreferences();
  const module = useRef<AudioModule | null>(null),
    [enabled, setEnabled] = useState(false),
    [error, setError] = useState("");
  useEffect(() => {
    if (module.current)
      void module.current
        .districtAudio(era)
        .catch(() => setError("Audio unavailable; visual cues remain active."));
  }, [era]);
  useEffect(() => {
    module.current?.audioPreferences(volume, muted);
  }, [volume, muted]);
  useEffect(() => {
    if (notice.includes("Operation complete")) module.current?.cue("success");
    else if (notice.includes("Operation failed"))
      module.current?.cue("failure");
  }, [notice]);
  useEffect(() => {
    const click = () => module.current?.cue("click");
    document.addEventListener("click", click);
    return () => {
      document.removeEventListener("click", click);
      module.current?.stopAudio();
    };
  }, []);
  return (
    <details className="desk-controls">
      <summary>Desk preferences · motion & sound</summary>
      <div className="button-row">
        <label>
          Motion speed
          <select
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
          >
            <option value="0">Off</option>
            <option value="0.5">Slow</option>
            <option value="1">Standard</option>
            <option value="1.5">Quick</option>
          </select>
        </label>
        <button
          className="secondary"
          onClick={async () => {
            try {
              if (!enabled) {
                module.current = await import("./desk-audio.ts");
                await module.current.unlockAudio(era, volume);
                setEnabled(true);
                setMuted(false);
              } else setMuted(!muted);
            } catch {
              setError("Audio unavailable; visual cues remain active.");
            }
          }}
        >
          {!enabled ? "Enable audio" : muted ? "Unmute audio" : "Mute audio"}
        </button>
        <label>
          Audio volume
          <input
            aria-label="Audio volume"
            type="range"
            min={0}
            max={0.4}
            step={0.01}
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
      {error && <p role="alert">{error}</p>}
      <small>
        Sound loads only after you enable it. Reduced-motion overrides all
        animation.
      </small>
    </details>
  );
}
