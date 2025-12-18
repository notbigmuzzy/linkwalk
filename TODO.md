# Virtual Museum — TODO

Goal: Desktop-only web app (Three.js) where each “room” is generated from a Wikipedia article. FPS controls (WASD + mouse look + SPACE jump). Vaporwave vibes via materials + lighting. Entrance lobby with doors for different “shows” (Geography, History, Art, etc.).

<!-- ---

 ## Milestone 0 — Project Skeleton (Day 0–1)
- [x] Choose tooling: Vite + vanilla JS (recommended) OR plain `index.html` + local server
- [x] Initialize project scaffold
  - [x] `index.html` + JS entry
  - [x] Dev server (`npm run dev`) and build (`npm run build`) if using Vite
- [x] Add dependencies
  - [x] `three`
- [x] Create base file structure (keep simple)
  - [x] `src/main.js` (boot)
  - [x] `src/engine/` (scene/camera/renderer loop)
  - [x] `src/game/` (player, rooms, navigation)
  - [x] `src/wiki/` (fetch + normalize)
  - [x] `src/ui/` (HUD/overlays/credits)
- [x] Basic full-screen canvas render
  - [x] Scene + camera + renderer
  - [x] Resize handling
  - [x] Animation loop w/ delta time

**Definition of done:** Opening the dev server shows a full-screen rendered scene. 

--- 

## Milestone 1 — FPS Controls (Day 1–2)
- [x] Pointer lock flow
  - [x] Click to lock pointer (mouse look)
  - [x] `Esc` unlock (browser default) + show “Click to play” overlay
- [x] Keyboard input
  - [x] WASD movement
  - [x] SPACE jump (required)
  - [x] Optional: Shift sprint (only if trivial)
- [x] Movement model
  - [x] Player velocity (x/z) + gravity (y)
  - [x] Grounded check + `canJump`
- [x] Collisions (MVP-simple)
  - [x] Floor collision (don’t fall through)
  - [x] Room bounds collision (don’t pass through walls)
  - [x] Keep everything axis-aligned initially

**Definition of done:** You can walk around a box room, look around, and jump.

--- 

## Milestone 2 — Room Generator (Geometry + Layout) (Day 2–3)
- [x] Procedural room dimensions
  - [x] Width/length/height randomized within sane ranges
  - [x] Seeded by article title (stable per article)
- [x] Room construction from primitives
  - [x] Floor + ceiling + 4 walls (planes or thin boxes)
  - [x] Simple lights (ambient + directional/point)
- [X] Wall “display slots”
  - [X] Reserve 1 “hero wall” for title + main frame
  - [X] Reserve remaining walls for frames/plaques/doors
- [x] Door/portal placeholders
  - [x] Visual door frame objects (no real wall cutouts required)
  - [x] Trigger volume to activate door

**Definition of done:** Rooms spawn with consistent layout and reserved spaces.

--- 

## Milestone 3 — Wikipedia Data (Day 3–4)
- [ ] Implement Wikipedia fetch (REST summary)
  - [ ] Endpoint: `https://en.wikipedia.org/api/rest_v1/page/summary/{title}`
  - [ ] Handle URL encoding / spaces
- [ ] Normalize response into `RoomData`
  - [ ] `title`
  - [ ] `extract` (short description)
  - [ ] `thumbnailUrl` if available
  - [ ] `pageUrl` (for attribution/link)
- [ ] Robust error handling
  - [ ] Missing page / bad title
  - [ ] No thumbnail
  - [ ] Disambiguation pages (fallback message + choose another)

**Definition of done:** Given a title string, you can fetch and obtain a stable `RoomData` object.

--- 

## Milestone 4 — “Article Room” Rendering (Day 4–6)
- [x] Spawn room shell immediately (no blank screen)
- [x] Add “loading placeholders”
  - [x] Empty frames
  - [x] “Installing exhibit…” plaque
- [x] Render title + extract
  - [x] Prefer HTML overlay for readable text (CSS2DRenderer or a simple HUD)
- [x] Render images
  - [x] Apply thumbnail as a texture on a plane in a frame
  - [x] Use `TextureLoader` / `ImageBitmapLoader`
  - [x] Ensure correct aspect ratio in frame

**Definition of done:** Entering a room shows title/extract + at least one framed image if available.

--- 

## Milestone 5 — Entrance Lobby + Shows (Day 6–7)
- [x] Create a fixed “Entrance Room” that loads first
- [x] Create show doors (categories)
  - [x] Geography
  - [x] History
  - [x] Art
  - [x] Science
  - [x] Technology
  - [x] Music
  - [x] (optional) Random
- [x] Decide show → articles mapping (start simple)
  - [x] MVP: curated list per show
  - [x] Later: add search-based expansion
- [x] Door interaction
  - [x] Walking into door trigger loads first article room
  - [x] Optional: click-to-enter via raycast

**Definition of done:** On page load you start in lobby and can pick a show via doors.

--- 

## Milestone 6 — Navigation Between Rooms (Day 7–9)
- [x] Add “related doors” inside article rooms
  - [x] MVP: pick from curated list / random from same show
  - [x] Later: use wiki links/search results
- [x] Add “Return to Lobby” option
  - [x] A door in each room OR keybind (keep it simple)
- [x] Basic state management
  - [x] `currentShow`
  - [x] `currentArticleTitle`
  - [x] History stack (optional)

**Definition of done:** You can go lobby → article room → another room → back to lobby.

--- 

## Milestone 7 — Vaporwave Visual Style (Day 9–10)
- [x] Create 4–6 theme presets (no image textures)
  - [x] Wall/floor/ceiling colors
  - [x] Roughness/metalness values
  - [x] Light colors + intensities
  - [x] Optional: fog for atmospheric themes
- [x] Choose theme per article (seeded)
- [x] Ensure exhibits remain readable (contrast)

**Definition of done:** Rooms have consistent vaporwave mood with a small set of coherent themes.

--- 

## Milestone 8 — Caching + Memory Safety (Day 10–12)
- [x] Data cache (small, safe)
  - [x] Cache `RoomData` by title in memory
  - [x] Optional: persist to IndexedDB later
- [x] Texture cache policy
  - [x] Start: keep only current room textures
  - [x] Upgrade: small LRU cache (e.g., last 10–30 textures)
- [x] Proper cleanup when leaving rooms
  - [x] Remove room group from scene
  - [x] Dispose geometries/materials/textures you won’t reuse
  - [x] Avoid GPU memory leaks

**Definition of done:** Visiting many rooms doesn’t steadily degrade performance or crash the tab.

--- -->

## Milestone 9 — Attribution + UX Polish (Day 12–13)
- [ ] Display attribution
  - [ ] “Source: Wikipedia” + page link
  - [ ] Image credit strategy (minimal plaque or UI panel)
- [x] Nice onboarding overlay
  - [x] “Click to start”
  - [x] Controls reminder (WASD, mouse, SPACE)
- [x] Small UX improvements
  - [x] Sensitivity control (optional)
  - [x] Pause/help overlay (optional)

**Definition of done:** You can show the project publicly without ignoring attribution.

---

## Milestone 10 — Hardening + Edge Cases (Day 13–14)
- [ ] Handle missing/odd Wikipedia content gracefully
  - [ ] No image → typography wall layout
  - [ ] Short extract → larger hero title + decor
  - [ ] Fetch failure → retry + fallback article
- [ ] Prevent infinite loading
  - [ ] Timeouts + fallback UI
- [ ] Basic logging for debugging

**Definition of done:** The app feels stable even when Wikipedia data is imperfect.

---

## Nice-to-haves (Only after core is solid)
- [ ] Better “related” generation via search API
- [ ] Inspect mode: walk up to an exhibit, click to expand details
- [ ] Add 1–2 simple GLTF decor props (bench/statue) (optional Blender)
- [ ] Simple minimap / compass (optional)

---

## Notes / Guardrails
- Keep it desktop-only (don’t chase mobile/touch).
- Avoid heavy physics early; axis-aligned collisions are enough for MVP.
- Text readability: prefer HTML overlays over 3D text geometry.
- Avoid keeping unlimited rooms in memory; dispose GPU resources.
