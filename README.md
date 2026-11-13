# Grow Cabinet: shelf study

One cabinet shelf with Alocasia 'Dragon Scale Mint' and 'Black Velvet' pink variegata, built on Three.js 0.160 (ES modules from jsDelivr). No build step.

Deploy: import this folder into Vercel (Framework Preset "Other", no build command, root `./`). Local preview: `npx serve .`

## Files
- `js/plant.js` - growth engine, variety settings (`VARIETIES`), photo-leaf geometry and materials
- `js/shelf.js` - cabinet compartment, LED bar lighting, LECA tray, hygrometer, dust motes
- `js/aquarium.js` - rimless tank, backlit backdrop, aqua soil, layered Seiryu stones, swaying Monte Carlo carpet, bubbles, glassware, neon tetras, cherry shrimp
- `js/water.js` - shared underwater shading: absorption along the real path through the water, caustics, world-space sway
- `js/util.js` - noise and math helpers
- `js/post.js` - camera pipeline: depth prepass, ambient occlusion, depth of field, bloom, grading
- `js/app.js` - scene setup, camera views, click-to-focus, time controls, growth log
- `tex/` - leaf textures cut from real photos: `_c` colour, `_a` cut-out mask, `_n` surface detail; `leaves.json` holds where each leaf's petiole joins and where its tip is

## Adding a leaf photo
Photograph a leaf flat-on under even light. Trace its outline, junction and tip, then align and export it with the same pipeline (colour, mask, normal map, entry in `leaves.json`). Add its name to a variety's `tex` list in `plant.js`.
