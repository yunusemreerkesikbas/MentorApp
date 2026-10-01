# Puhu planning flight assets

Produced once during development on 2026-10-01, not per plan request.

- `desktop.webp`, `mobile.webp`: imagegen reference-based sky scenes, no baked text or UI. Reference identity: `puhu-default.png`, `coach-hero.png`; existing files are unchanged.
- `day-island.webp`, `paper-bird.webp`: imagegen assets with transparent backgrounds, delivered at 256px.
- `desktop.mp4`, `mobile.mp4`: local motion graphics from the posters with smooth camera movement and a glowing star visiting the glasses before floating away. Eight seconds, 30fps, silent H.264/yuv420p with faststart. Matching endpoints let the video loop without delaying the service result. This is a composed animation, not generative character performance or a Seedance output.

The original Seedance 2.0 preflight was 72 credits per clip (144 total). Balance was eight credits. The user requested that we produce the videos ourselves, so no Seedance job was submitted and no paid video-generation credits were spent.

To recreate the videos, run `node --experimental-strip-types scripts/render-puhu-flight.ts` from `apps/web` with FFmpeg available (or `FFMPEG_PATH` pointing to its executable). FFmpeg is a development tool only; the application serves the committed assets. No new application dependencies were installed.

Original imagegen sources (preserved in the user's generated-images directory): desktop `exec-0c40fc6c-fd36-4dc5-b0c5-e19e9b2894db.png`; mobile `exec-fe346c50-6670-48ea-b8e4-0264a7904fca.png`; island `exec-1366794d-ec69-4342-929f-ae7f6198c7f9.png`; bird `exec-34b59438-f3a2-4f3b-aadf-1a1722207687.png`.

## Desktop production brief

Soft premium 3D animation-film still, 16:9 landscape. One Puhu preserves fluffy white body, navy round glasses, blue ear tufts and wing tips, friendly dark eyes, tiny yellow-orange beak, pink cheeks, cream belly and blue chest heart. Deep navy star-lined cape with gold clasp and blue star. Puhu hovers in a star valley with a golden star wand, pale blue cloud layers, distant floating islands and warm stardust arcs. Calm dark sky at the top and bottom for live UI. No text, numbers, UI, hats, phones, desks or logos. Reference-based generation from the existing default and coach-hero mascot assets.

## Mobile prompt

Create a finished mobile portrait cinematic poster, 9:16, same soft premium 3D animation film world and EXACT same Puhu owl character as supplied landscape and hero references. Preserve white fluffy body, navy round glasses, very large friendly dark eyes, blue tufts, blue heart on belly, yellow tiny beak, pink cheeks and rich navy star-lined cape with gold clasp and blue star. Puhu floats in the middle third, smaller than landscape to allow lots of calm UI space top 20 percent and bottom 25 percent. Golden star wand in right wing gently draws an arc of warm stardust. Vertical layers of pale blue clouds and distant little floating magical islands create depth, waterfalls and pinprick warm stars, midnight navy sky. A tiny star near the glasses. Quiet joyful companionship, breathtaking yet readable dark sky, lush tactile feathers. Compose for a phone screen, all important character features within middle 65 percent of width. Use the reference scene as visual continuity, but independently compose vertically; not a crop. No text, numbers, UI, logos, hats, phones, desks. Still frame used as both loop start/end and reduced-motion poster.

## Day island prompt

Create ONE reusable decorative game asset on a fully transparent background: a tiny rounded magical floating day island, soft premium 3D fantasy animation style matching the supplied Puhu sky scene. Pale icy blue cotton clouds surround a small smooth navy-blue rock island, a little golden five-point star sprouts at its top, a delicate blue waterfall/tassel beneath. Front three-quarter view, centered, isolated, generous transparent padding, no scene or sky, no owl, no text or numbers, no rectangular plate, no UI. Calm friendly tactile clay and cloud material, lighting warm gold from upper right, small enough to use behind a day label in a web scene. Produce square canvas.

## Paper bird prompt

ONE isolated origami paper bird on a fully transparent background. Small friendly folded-paper swallow, wings spread in flight, three-quarter side view pointing to the right, off-white and pale icy blue paper with subtle gold edges and tiny blue star seal. Premium soft 3D animation film render matching supplied fantasy sky art, warm rim light, softly shaded clean geometric folds. Centered square canvas with transparent generous padding. No owl, no island, no landscape, no text, no symbols apart from simple star seal, no letters or UI. Reusable tiny decorative asset for subject birds in a web scene.
