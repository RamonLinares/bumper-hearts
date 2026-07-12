# Bumper Hearts — How an AI-assisted browser game came to life

## Showcase logline

What began as a prompt for a cute miniature bumper-car game became a ten-stage arcade romance: a polished Three.js survival game with anime intermissions, generated 3D props, authored arena textures, ElevenLabs sound design, two camera modes, responsive controls, and a continuously tested GitHub Pages release.

Live game: <https://ramonlinares.github.io/bumper-hearts/>

---

## Scene 1 — The first ticket

**On screen:** The original rough arena dissolves into the warm Pocket Fairground: worn paint, tiny bulbs, brass trim, flags, rails, and the teal hero car.

**Narration:**

The project started with a deliberately emotional brief, not a technical specification. The goal was to make a browser game feel like a treasured tabletop fairground discovered in an attic: miniature, detailed, nostalgic, and immediately playable.

**Original prompt, verbatim:**

> “Use set_goal and multiple agents to build and deploy a cute bumper cars game on Sites. Use ImageGen for assets and create a heartwarming, nostalgic environment that feels miniature but highly detailed. Keep iterating until it is polished, deployed, and playable.”

The first implementation established the game loop, Three.js scene, controls, collision response, generated hero car, fairground diorama, ticket-like interface, and automated browser diagnostics. Parallel agents were used for bounded work in stage art, audio production, and QA/design, while the main agent integrated the shared result.

---

## Scene 2 — The player became the art director

**On screen:** A rapid montage of revisions: corrected car orientation, smaller logo, textured floor, improved rivals, blue-teal hero paint, cleaner dialogs, and first-person view.

**Narration:**

The game was shaped through unusually specific visual and control feedback. Each observation became a small implementation-and-test cycle. The car initially moved right while visually facing backward. The result dialog felt childish and its logo overlapped the copy. The floor looked black and synthetic. Rival cars did not match the hero. First-person steering behaved like overhead steering. Later, reverse steering and camera lag exposed subtler problems.

Representative user prompts that drove the design:

> “The logo is too big and overlaps with the text.”

> “The floor is also full black, I would expect some nice texture instead.”

> “Can we use the same car but with different colors?”

> “In POV mode the cursor up or W should move forward… left or A should turn the car counter clockwise.”

> “The story needs Street Fighter II or Ghouls and Ghosts arcade-level storytelling with real graphics.”

> “Our car has this great blueish color in the images; can we make the playfield car match?”

This feedback changed more than presentation. It turned the project into a conversation between player intuition and implementation. Every awkward moment—an old cutscene flashing for one frame, a vibrating cockpit, reverse steering feeling wrong—was treated as a real product defect and given a regression test.

---

## Scene 3 — From score chase to survival arena

**On screen:** The old collectible-heavy field clears. Rival health bars appear. Cars collide, sparks and impact rings burst outward, a rival is eliminated, and “Last car standing” remains in the HUD.

**Narration:**

The largest gameplay pivot came late. Collecting points was pleasant but too easy, so the game became a last-car-standing survival contest.

Cars now have integrity, deal reciprocal collision damage, fight each other as well as the player, and disappear when eliminated. Boost became faster and charge-limited. Heavy hits gained debris, expanding shock rings, stronger sound, and camera impulse. Three timed power-ups changed the rhythm:

- **Repair:** restores integrity.
- **Overdrive:** temporarily increases collision damage.
- **Shock bomb:** damages nearby rivals with a radial electrical discharge.

Power-ups no longer cover the field at the opening. A round begins clean, waits 3.5–6 seconds, then spawns one random power-up at a safe random position. It expires after ten seconds, and the next arrives 5–9 seconds after collection or expiry.

The physics deliberately remained a lightweight custom arcade model rather than a heavyweight rigid-body simulation: fixed 1/60-second updates, circular collision proxies, deterministic arena bounds, impulse response, and per-pair damage cooldowns. The visual GLBs are independent of the gameplay colliders. This kept the handling readable and easy to tune while preserving satisfyingly exaggerated bumps.

Survival balance remained intentionally adjustable. When real play revealed that attacking rivals punished the player too heavily, return damage was reduced by roughly one-third and the maximum single-hit loss dropped from 24 to 16 integrity. Reciprocal risk remained, but aggressive play became viable again—a small example of why feel-testing mattered as much as functional correctness.

---

## Scene 4 — A ten-night arcade romance

**On screen:** Eli, Maya, Rex, and Dot appear across a sequence of bright 16:9 anime intermissions, ending beneath the restored marquee.

**Narration:**

The story began as text: Eli, a shy teenage electronics nerd, falls for Maya, the brilliant fairground lighting designer who appears to be far outside his social orbit. Rex, the wealthy golden boy and Maya’s boyfriend, grows angrier as Eli survives each night and Maya sees more of who he really is. Dot, the veteran mechanic, anchors the story with dry humor and practical wisdom.

Text boxes were not enough. A new cast bible locked each character’s face, clothing, age, palette, and proportions. The narrative was rebuilt as twelve consistent anime OVA-style images: an opening, ten stage outcomes, and an epilogue. Earlier low-resolution image sheets were discarded in favor of individual 1672×941 masters, encoded as high-quality WebP for runtime delivery.

**Representative reconstructed image prompt:**

> “1990s Japanese OVA anime frame, cinematic 16:9 composition, warm restored indoor fairground at night, miniature bumper-car pavilion filled with practical amber bulbs and teal shadows. Keep Eli, Maya, Rex, and Dot exactly consistent with the supplied cast bible: same faces, hair, ages, clothing, and proportions. Clean cel linework, crisp edges, high detail, bright readable exposure, no diffusion artifacts, no text, no watermark.”

The UI then became image-first: location slate, concise narration, one character line, speaker, mission summary, and action. Loading transitions hide the old artwork before changing the source and reveal the next frame only after decoding, preventing even a single stale-image flash.

---

## Scene 5 — The asset workshop

**On screen:** A pipeline diagram moves from concepts to GLBs, WebP textures, MP3 sound effects, manifests, loaders, normalized models, and the final arena.

**Narration:**

The visual pipeline was hybrid. Important assets came from generative services; repeatable structure, collision proxies, animation hooks, halos, VFX, and world dressing remained in code.

### Image generation

OpenAI ImageGen and the Three.js image-generation workflow were used for early art direction, the nostalgic carnival diorama, marquee/logo work, story concepts, the anime remaster, and ten authored 1024px floor textures. Generated masters were kept separately; runtime images were resized and encoded for the web.

**Representative floor-texture prompt:**

> “Seamless square material texture for a miniature vintage bumper-car arena, painted cream and mustard ticket-grid panels, fine seams, scuffs, rubber arcs, tiny chips and age, orthographic top-down, evenly lit, no central emblem, no objects, no perspective, game-ready surface detail.”

### 3D generation

Tripo generated the detailed bumper car and ten PBR collectible/prop families: ticket, bulb, radio coil, café token, trophy star, fuse, storm lantern, evidence card, love letter, and marquee heart. Models were downloaded as GLB files, normalized to consistent bounds and pivots, cached once, cloned at runtime, and paired with simple collision proxies. Face limits of roughly 5,000–6,000 kept the browser budget controlled.

The hero’s imported body was selectively recolored to deep blue-teal `#0c6f7a`, preserving cream panels, brass, chrome, rubber, seat fabric, and wear. Rivals reuse the same detailed car family with distinct paint identities, exactly as the player requested.

### Audio generation

ElevenLabs created ambience, interface cues, impacts, boost, stage outcomes, boss arrival, repair, overdrive, shock bomb, and elimination sounds. The user’s song, **Crash for You**, was converted into a clean looping 44.1 kHz runtime MP3. Music and effects have separate Web Audio buses and persistent mute controls (`N` for music, `M` for FX).

Example ElevenLabs prompts, verbatim from the audio manifest:

> “Short spectacular high-speed bumper-car collision, massive rubber compression, deep metal chassis slam, electrical sparks and suspension rattle, no glass, music or voice.”

> “Short radial electricity bomb, transformer crack, circular discharge and multiple distant car-body zaps, no debris, music or voice.”

> “Seamless miniature 1980s indoor fairground bumper-car arena ambience, distant cheerful crowd murmur, gentle electric ceiling-grid hum, faint ride machinery and occasional faraway rubber bump, warm nostalgic room tone, no melody, no music, no voice, restrained mix beneath gameplay.”

Manifests record provider, prompt, duration, loop behavior, model task IDs, and face limits so the asset origin remains inspectable.

---

## Scene 6 — Architecture: small systems, explicit state

**On screen:** The game peels apart into labeled layers around the canvas.

**Narration:**

The runtime is intentionally compact: Vite, TypeScript, Three.js, HTML, and CSS—no UI framework and no server dependency.

The architecture separates responsibilities:

- `Game.ts` owns state transitions, the fixed-step simulation, combat, stage progression, power-up scheduling, and diagnostics.
- `Player.ts`, `Rival.ts`, and `Pickup.ts` own entity state and visuals.
- `CollisionSystem.ts` handles car impulses, arena bounds, and pickup sensors.
- `CameraRig.ts` owns overhead and cockpit poses. Overhead uses cinematic lag; POV is rigidly mounted to prevent the nearby car from vibrating.
- `AudioSystem.ts` loads the manifest into Web Audio groups and manages unlock, looping, pause/resume, and independent mute persistence.
- `Hud.ts` renders the ticket-marquee HUD, story dialogs, accessibility state, responsive layout, and cutscene loading transitions.
- `Campaign.ts` is the data-driven ten-stage story, difficulty, theme, boss, and cutscene map.
- Asset loaders normalize, cache, clone, and safely dispose imported GLBs and textures.

The game exposes `window.render_game_to_text`, `window.__THREE_GAME_DIAGNOSTICS__`, and a deterministic `window.advanceTime(ms)` hook in development. Diagnostics include state, stage, health, rival health, power-up timers and position, audio status, camera pose, renderer calls, triangles, geometries, textures, and canvas dimensions. This made the graphical game inspectable as structured state rather than relying only on screenshots.

---

## Scene 7 — Skills and working method

**On screen:** A loop repeats: implement → play → pause → inspect screenshot/state → profile → fix → test → deploy.

**Narration:**

The project used a family of specialized Codex skills rather than one giant undifferentiated prompt:

- **threejs-game-director** coordinated broad phases and quality gates.
- **threejs-gameplay-systems** shaped controls, collisions, combat, power-ups, camera behavior, and game feel.
- **threejs-aaa-graphics-builder** guided authored surfaces, material roles, world layering, VFX, readability, and visual scorecards.
- **threejs-game-ui-designer** guided the HUD, dialogs, responsive safe areas, typography, controls, and story presentation.
- **threejs-image-generator / imagegen** produced concepts, cutscenes, textures, backgrounds, and UI art.
- **threejs-3d-generator** handled the Tripo vehicle and collectible pipeline.
- **threejs-audio-generator** generated and prepared ElevenLabs game audio.
- **threejs-debug-profiler** diagnosed orientation, camera vibration, asset loading, runtime errors, and performance.
- **threejs-qa-release** covered production builds, base paths, canvas inspection, responsive checks, and release readiness.
- **develop-web-game** enforced short real-input play loops with screenshots, diagnostics, deterministic stepping, and console inspection.
- **Playwright** automated desktop Chrome and mobile Safari behavior.

The guiding practice was small, observable iterations. A change was not considered finished because the code looked plausible. It had to be played through real input, represented correctly in diagnostics, shown in an active screenshot, checked for console/page errors, and—when it fixed a bug—protected by a regression test.

Examples include tests for car nose direction, relative POV controls, reverse steering, rigid cockpit offset, separate music/FX mute, damage and healing, overdrive and shock, randomized timed power-ups, story progression, and delayed cutscene loading.

---

## Scene 8 — From Sites to GitHub Pages

**On screen:** The build travels from source to a green GitHub Actions run and finally opens at the public URL.

**Narration:**

The first deployment target was Sites. Packaging scripts copied the correct static client bundle and adapted model asset extensions for that environment. When the publishing route became unreliable—and the player explicitly requested GitHub Pages—the project gained environment-aware Vite base paths, a centralized `assetUrl()` helper, a static SPA fallback, and a GitHub Actions Pages workflow.

Every push to `main` now installs dependencies, builds the game, uploads `dist/client`, and deploys it at the repository subpath. Production checks verify that HTML, hashed JS/CSS, story art, audio, textures, and GLBs all resolve below `/bumper-hearts/`.

The final result is still a static website. All simulation, rendering, campaign state, and audio run locally in the browser; session progress is stored client-side. That makes Bumper Hearts inexpensive to host, easy to share, and fitting for the small web.

---

## Closing frame — What actually made it work

**On screen:** The teal car stops beneath the marquee while the arena lights remain on.

**Narration:**

Bumper Hearts was not generated in one shot. Its character came from repeated negotiation between a clear human taste and an AI-assisted production pipeline. Generative tools supplied raw visual and sonic material; code gave those assets behavior, consistency, performance boundaries, and a dependable home. The most valuable prompts were often not grand creative briefs but precise observations: “that car faces backward,” “this dialog feels childish,” “the old image flashes,” “reverse steering feels wrong.”

The showcase lesson is simple: AI can accelerate every discipline in a small game—art direction, 3D, sound, narrative, programming, testing, and deployment—but polish still comes from noticing what feels wrong, making one controlled change, and playing again.

**Credits and services:** Three.js, TypeScript, Vite, OpenAI/Codex, OpenAI ImageGen, Google/Gemini image generation workflow, Tripo 3D generation, ElevenLabs audio generation, Playwright, GitHub Actions, and GitHub Pages. Music supplied by the project owner.
