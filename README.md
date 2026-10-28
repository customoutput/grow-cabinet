# Aquaponic Grow Cabinet

Real-time 3D grow cabinet built with Three.js r128 (loaded from CDN). No build step.

## Deploy to Vercel
Import this folder as a project (Framework Preset "Other", no build command, output directory `.`), or run `npx vercel` inside it.
Local preview: `npx serve .`

## Files
- `js/core.js` – helpers, noise, cabinet dimensions, growth clock (`PC.EPOCH`, `PC.START_AGE`)
- `js/textures.js` – room, soil, water, fish and sprite textures
- `js/leaves.js` – variegated leaf textures: outline, veins, relief and colour pattern per variety (`SPECS`)
- `js/plants.js` – growth habit per variety (`VARIETIES`), the 12-plant shelf layout (`PC.buildPlants`) and the two floor plants with pots, moss pole and wall spotlights (`PC.buildFloorPlants`)
- `js/cabinet.js` – cabinet, shelves, hydro trays, LEDs, fans, tubing, doors, hygrometer, black LED humidifier and mist nozzles
- `js/mist.js` – humidifier fog, shelf haze and glass condensation
- `js/aquarium.js` – tank, faceted Seiryu stones with per-pixel detail, gravel chips, carpet, water, CO2, fine bubbles (pearling, outflow, trickle), neon tetras, breeding cherry shrimp colony
- `js/main.js` – renderer, camera views, time model, controls, UI

## Growth
Plant age = `START_AGE` (30 days) + days since Oct 27, 2026, so every visitor sees the same cabinet.
Each leaf emerges rolled, unfurls, expands, hardens off from its new-leaf colour, and the oldest yellows and drops.
Each leaf picks its own variegation texture. The shrimp colony starts at 24 and grows in clutches toward ~96.

## Lighting
Auto runs grow lights 08:00–20:00 (tank 10:00–21:00) and switches to violet-blue UV night lighting after dark. Day, Night and Off force a mode.
