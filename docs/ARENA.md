# Motion Arena

Original Blender-built architecture loaded by Three.js. Navy enclosure, cyan lighting strips, magenta accents, stepped spectator seating and overhead fixtures. Gameplay geometry remains driven by the existing court dimensions. The static GLB is batched into five material groups. Characters and match simulation are still the existing procedural game implementation.

## Installed on this machine

- Blender 4.5.9 LTS: `~/.local/opt/blender-4.5.9-linux-x64`
- Runtime libraries: `~/.local/opt/blender-runtime-libs`
- MCP for Blender, registered with `codex mcp add blender -- uvx mcp-for-blender`
- Addon: `~/.config/blender/4.5/scripts/addons/blender_mcp.py`

Upstream: https://github.com/ahujasid/mcp-for-blender (community integration).
The local headless adapter explicitly drains the addon's command queue on Blender's main thread because GUI timers do not run in background mode. It depends on addon internals; recheck it when upgrading the addon. It binds only to localhost port 9876. Do not run a second Blender addon listener on this port.

## Rebuild assets

From the repository root, start Blender in one terminal:

```bash
./scripts/start-blender-mcp.sh
```

Then in another terminal:

```bash
uv run --with mcp python scripts/export-arena-mcp.py
npm run build
```

The export script calls the MCP `execute_blender_code` tool. Output:

- `assets/source/motion-arena.blend`: editable source
- `src/client/public/models/motion-arena.glb`: web asset

The installed Blender paths and addon version are machine-specific; this is a working local setup, not a cross-platform installer.

## Preview

Run `npm run dev`, then:

```bash
LD_LIBRARY_PATH="$HOME/.local/opt/blender-runtime-libs" node scripts/preview-arena.mjs
```

This connects a controller browser, opens an AI match and captures `docs/arena-preview.png`. The page is checked for uncaught JavaScript errors. Rendering was checked using Chromium software WebGL; hardware FPS has not been benchmarked.

## Pickle Garden theme

The game now loads `src/client/public/models/pickle-garden.glb`, an original pastel garden with trees, planters, benches and shrubs. Editable source: `assets/source/pickle-garden.blend` (scene `Pickle Garden`). The original arena file is retained.

`scripts/build-pickle-garden.py` runs in the connected Blender UI through MCP and creates a new scene. It exports only garden decorations; the preview court stays in Blender while Three.js builds the precise gameplay court. Set `ROOT` to your checkout if using another machine. Re-running creates another scene rather than replacing hand edits.

Characters remain procedural in `src/client/host/characters.ts` and animated in `src/client/host/stage.ts`; they are not rigged Blender assets. The palette and responsive menu are in `src/client/style.css`. No match rules or networking protocol changed.

With `npm run dev` running, `node scripts/preview-garden.mjs` checks room pairing, starting an AI match, loading the model and returning to the menu, and saves desktop/mobile screenshots under `docs/garden-*.png`. This browser check uses a simulated controller tab; physical phone motion and GPU performance require device testing.


## Character roster

Six original characters are defined in `src/shared/characters.ts`: Ren/Aiko (anime), Bảo/Mimi (chibi), and Kuma/Yuki (animal hood outfits). `src/client/host/characters.ts` builds their meshes and the matching 3D portrait images. They share paddle reach and game attributes.

The lobby picker allows selecting both local sides, persists validated IDs in localStorage, and applies selections when starting a match. In online play each host chooses its own character; `character`/`character-reply` messages synchronize the two choices over the existing opponent relay without altering match-state packets. The second local selection is used for AI/local play, not to override a remote player's choice.

`e2e/characters.test.ts` covers selecting before phone pairing, persistence, changing between matches, invalid stored IDs, and correct online side mapping. `scripts/preview-characters.mjs` captures the roster at desktop/mobile sizes.
