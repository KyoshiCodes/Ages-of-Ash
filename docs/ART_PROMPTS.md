# Later art direction

The current game uses zero external image assets. `apps/web/public/icon.svg` and the inline Sigil component provide complete placeholders. `pnpm exec tsx scripts/generate-icons.ts` regenerates deterministic era sigils under public/icons; no network or model is involved.

Shared prompt suffix: original fantasy world, no recognizable copyrighted characters or logos, dark archival dossier, engraved geometry, limited warm metallic highlights, strong negative space for UI, readable silhouette at 64px, no text, no watermarks. Deliver transparent PNG at 512px plus wide scene at 1600×900; convert to optimized assets only after licensing/provenance review.

- Veiled Streets: rain-dark Cinder Quay counting house, brass ledger seals, sootglass knife, amber windows reflected in still canal water, restrained contemporary underworld atmosphere.
- Tidebound Accord: Sereglass Steps monastery overlooking a salt basin, four abstract natural-domain seals, translucent reflection realm beneath stone bridges, pale jade and sea-glass palette.
- Crownfall Reach: Veyrwood boundary shrine between mountain forge, deep forest and silver marsh, Thornward oath-iron on a weathered plinth, violet and muted lichen accents, unsettling empty crown silhouette.
- Far Ember Expanse: Quiet Meridian courier ship crossing the Nacre Drift, distant fractured orbital ring, narrow blue arcblade light, charcoal/navy and cool silver, no familiar spacecraft silhouettes.
- Glasswrit Sentinel: angular glass-and-script automaton, three distinct readable stances (open guard, pulse shield, exposed core), amber fractures, isolated orthographic silhouettes.
- Sablecoil Leviathan: vast coiled void creature with a luminous current through segmented ribs, elegant threatening silhouette, no gore, dark cyan and ash-white accents.

Keep all replacement art decorative: text labels, keyboard access and game state must remain available without it. Do not add visual engine dependencies.
