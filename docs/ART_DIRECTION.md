# The Ember Desk — direction before assets

Palette: ash #101514, charcoal #19201d, ember #eb944d, bone #eee4cf, verdigris #6db4a1, brass #b69861. Danger uses burnt vermilion #db7667 and always a text label. Body text on parchment uses #29271e. Exactly two font families: system Segoe UI/sans-serif and Georgia/serif; no font downloads.

Spacing uses an 8px grid: 8, 16, 24, 32, 48, 64. Controls are at least 44px, usually 48px. Elevation 0 is the desk, 1 the ledger (0 8px 24px black/20%), 2 instruments (0 16px 40px black/30%), 3 dialogs (0 24px 64px black/45%). Glow 0 off, 1 focus/selection (0 0 12px ember/12%), 2 momentary success (0 0 24px ember/22%); no permanent full-screen bloom.

Ledger pages use procedural CSS grain, ruled lines and a sewn margin. Brass clock rings, SVG wax seals and folded page corners provide depth without image dependencies. One SVG icon family uses 1.75-unit strokes with round caps. Achievement materials progress ash → iron → brass → ember-glass, with text labels so color is never the sole distinction.

Motion: subtle roll-ups and one resolution reveal; user speed 0, .5, 1 or 1.5. Reduced-motion disables all spatial animation, background motion and optional 3D. Screen transitions animate opacity only. Graphics default to the 2D supply-map; optional 3D mounts only on request and unloads when closed. No game information depends on 3D or sound. Keep device pixel ratio ≤1.5 and render on demand unless an inspection is active.

Audio: original synthesized ambient stems, low-volume UI clicks and outcome stingers; pre-rendered Opus streams, requested only after explicit Enable audio gesture. Persist mute and volume. Pause on hidden tabs. District changes crossfade between streams; all outcome cues also have text. Unsupported audio falls back to visual cues.

Tone bible: the narrator is an exhausted but exacting clerk. Concrete material details, short sentences, implied history. Nobody describes a mechanic as a mechanic in lore. A success costs someone ink, loyalty or sleep. Avoid heroic bombast, contemporary memes and borrowed proper nouns. Codex forms are fragments, intercepted letters and audit memoranda; each reveals one fact and leaves one question.
