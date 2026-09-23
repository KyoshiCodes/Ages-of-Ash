# Physical-device and accessibility validation worksheet

Status: **not executed on physical devices**. Hosted Chromium Release foundation measured 4 Mbps / 80 ms signed-out shell ready 761 ms, first paint 240 ms, first contentful paint 656 ms, and no initial media requests in run 35798559620 at commit 47bc4a1. That is emulation only; it does not certify 60 fps, authenticated paint, touch, screen readers or OCI.

Complete one row per real device/browser and attach traces in the restricted release evidence store. Required targets: a mid-range Android phone (4 GB RAM class) in Chrome stable; a current supported iPhone in Safari; and a Windows laptop forced to integrated graphics at 60 Hz. Record exact model/SoC, RAM, OS/build, browser/version, viewport/DPR/refresh rate, release SHA, battery percent/charging/power-saving mode, starting and ending temperature/thermal-throttle indication, ambient network type, packet loss, and test date/operator. Record whether the device supports and was tested with 3D; no fallback may lose a game action.

| Device/OS/browser | Network Mbps/RTT/loss | Battery/thermal start→end | Cold shell median/worst (5) | Auth shell median/worst (5) | JS gzip | Frame p50/p95/p99 | Frames ≤16.7 ms | Input p95/max | Peak tab memory | Result/trace |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| <MODEL/OS/BROWSER> | <VALUE> | <VALUE> | <MS> | <MS> | <KIB> | <MS> | <%> | <MS> | <MIB> | <PASS/FAIL/LINK> |

Procedure: use a release build over staging HTTPS with realistic API and a disposable account. Clear browser cache/service worker for each of five cold starts; set 4 Mbps downstream and 80 ms RTT in browser devtools or a measured network shaper, and also record an unshaped field run. Capture navigation, network, long tasks and filmstrip. Require first meaningful playable shell <2 s on the 4 Mbps profile and eager JS <400 KiB gzip. Measure authenticated return and Ember Ledger report separately; do not substitute signed-out CI timing. Record median and worst of five, plus exact cache state.

For pacing, record a 60-second trace at 60 Hz for: ten operations including tactical reveal, era navigation, supply map, relic inspection, long codex scroll, live WebSocket update, tab-hide/return and post-restart reconnect. Run with optional 3D disabled, then explicitly enabled; verify 2D fallback on unsupported/reduced-motion devices. Aim for at least 95% frames at or below 16.7 ms, no input stall >100 ms, and record p50/p95/p99 frame time, dropped frames, event-to-paint latency and peak tab memory. Repeat under warm and thermally constrained conditions; a device that drops below 60 Hz cannot establish a 60 fps claim. Confirm initial network and build graph have no audio/3D requests, and optional media loads only on consent.

Accessibility checklist, mark PASS/FAIL/N/A with evidence for each platform:

- [ ] Keyboard-only register/guest, operation, equipment, crew, holding, boss, leaderboard and logout; visible logical focus with no trap.
- [ ] Android TalkBack and iOS VoiceOver announce controls, resource changes and resolution results; no duplicate live-region chatter.
- [ ] Contrast in every era/badge/error/disabled state meets WCAG AA text 4.5:1 (large text 3:1) and non-text 3:1; record sampled pairs/tool output.
- [ ] At 200% text zoom and 320 CSS px viewport, no clipped primary action or horizontal overflow that hides information.
- [ ] OS reduced-motion and app speed Off stop decorative motion/3D; information remains available without animation.
- [ ] Mute persists, default volume is low/zero as configured, zero volume truly silences playback, audio starts only after a gesture, no audio-only cue.
- [ ] Touch targets are at least 44×44 CSS px where feasible, with spacing and no accidental double action.
- [ ] Android PWA install/offline shell and iOS home-screen launch are checked separately; offline game actions require reconnection to the authoritative server.
- [ ] Browser back/forward, reconnect, high contrast and landscape orientation do not lose state or focus.

Pass criteria: all core flow and security/accessibility checks pass; cold shell and JS budgets pass; measured frame/input targets pass on named devices. A fail blocks the relevant release claim and becomes a defect. Record each defect as: `<ID, severity, SHA, device/OS/browser, network/thermal, route/action, expected, actual, steps, screenshot/trace link, owner placeholder, fix SHA, retest result>`. The public-beta authority reviews the table and unresolved defects; it cannot infer device results from CI emulation.

`// TODO(agent): Execute this worksheet on named physical Android, iOS and integrated-GPU Windows devices and attach raw traces and defects to the release evidence store.`
