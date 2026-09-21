# Performance and accessibility evidence

The default experience is semantic DOM/CSS/SVG. Two system font stacks avoid font downloads. Content textures are gradients, badges are SVG/CSS, and motion uses a shared speed preference plus `prefers-reduced-motion`. Resource caps/power/reward settlement come from the server; number roll-ups interpolate display only.

`pnpm build` validates content and recursively measures the entry manifest's static imports with gzip. It fails at 400 KiB of initial JavaScript or if an optional media module enters the eager graph. Current measured initial graph is approximately **165 KiB gzip**; the optional 3D chunk is approximately 237 KB gzip and fetched only on inspection. The audio module is under 1 KB gzip; eight original Opus assets total about 230 KB and stream only after Enable audio.

`pnpm exec tsx scripts/check-performance.ts` serves the real production build with gzip, blocks service-worker caching, applies Chromium's 4 Mbps/80 ms throttle and waits for the usable signed-out controls. The 2026-09-21 check measured **889 ms usable shell**, **684 ms first contentful paint**, zero optional media requests, and no styleguide overflow at 390/1440 px. Results and screenshots are written into test-results. This checks the signed-out shell, not authenticated production API latency.

Optional inspection uses a capped 1.5 device-pixel ratio, no antialiasing, low-power preference and demand rendering. Rotation is opt-in; hidden tabs pause animation and audio. Reduced-motion or speed Off unmounts inspection and leaves the complete 2D game usable. Closing the view disposes its canvas. R3F currently emits a Three.Clock deprecation notice; behavior passes browser smoke tests, but monitor upstream compatibility before changing pinned versions.

Four real Chromium journeys cover the original core loop, guest upgrade/live updates, retention systems, and media lazy loading/zero-volume persistence. Keyboard-native controls, labelled selects/sliders, focus-visible outlines and a native recap dialog are included. The styleguide contains desk materials, SVG families and operation outcomes. Locked badges retain readable contrast rather than fading their text away.

The **60 fps integrated-GPU target remains unverified on physical hardware**. Headless Chromium is not a substitute for that measurement or mid-range Android. Under-2s authenticated first meaningful paint also needs the deployed API/network. Do not report these as measured successes.

Local planning RSS remains one PostgreSQL service (roughly 150–500 MB), API (100–250 MB), worker (100–200 MB), Vite (200–500 MB), excluding OS/browser/editor. These are planning ranges, not process measurements. Production builds are lightweight and do not require local GPU inference.

// TODO(agent): Profile a physical integrated-GPU laptop and mid-range Android at 60 Hz; record frame-time percentiles for operations, supply inspection and relic rotation.
// TODO(agent): Measure authenticated first meaningful paint with deployed API latency and a cold 4 Mbps connection; retain a trace with the release.
// TODO(agent): Run a screen-reader/keyboard audit and Android PWA install/offline verification on physical devices.
