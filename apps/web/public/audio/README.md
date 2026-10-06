# Audio

## Study session room sounds

Each study-room theme plays two loops together: the room's ambience and a quiet music bed.
Catalog: `apps/web/src/lib/ambient-tracks.ts`.

| File | Source | Licence |
|---|---|---|
| `scene-library-ambience.mp3` | [Warsaw University Library](https://pixabay.com/sound-effects/film-special-effects-warsaw-university-library-58740/) (freesound_community) | Pixabay Content License |
| `scene-library-music.mp3` | [Piano Background Gentle Study Flow](https://pixabay.com/music/small-drama-piano-background-gentle-study-flow-578490/) (alex-morgan) | Pixabay Content License |
| `scene-cafe-ambience.mp3` | [Cofee shop Ambience](https://pixabay.com/sound-effects/household-cofee-shop-ambience-59432/) (freesound_community) | Pixabay Content License |
| `scene-cafe-music.mp3` | [Jazz Cafe Morning Music](https://pixabay.com/music/modern-jazz-jazz-cafe-morning-music-556238/) (alex-morgan) | Pixabay Content License |
| `scene-home-ambience.mp3` | [Gentle Rain on Window](https://pixabay.com/sound-effects/nature-gentle-rain-on-window-350529/) (Eryliaa) | Pixabay Content License |
| `scene-home-music.mp3` | [Lofi Study Rainy Night](https://pixabay.com/music/lofi-lofi-study-rainy-night-568166/) (alex-morgan) | Pixabay Content License |

Pixabay Content License: free for commercial use, no attribution required; do not redistribute the
files on their own. To swap a sound, replace the file under the same name and update this table.

The files are re-encoded to 96 kbps (source sample rate and channels kept, tags and cover art
dropped), about 1.4–1.8 MB each, which is plenty for a room tone and a quiet music bed:

```bash
ffmpeg -i source.mp3 -map 0:a -map_metadata -1 -codec:a libmp3lame -b:a 96k scene-<theme>-<layer>.mp3
```

## Weekly recap

`mixkit-*` files: Mixkit free licence, used by `apps/web/src/lib/weekly-recap.ts`.
