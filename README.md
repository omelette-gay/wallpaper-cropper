# Wallpaper Cropper

Crop photos to your exact wallpaper resolution. Drop in a batch, position the crop on each one, and download them all as a zip. There's optional AI upscaling for photos that are too small. Everything runs in your browser and nothing is uploaded.

**Use it:** https://wallpaper.omelette.gay

**How to use it:** [user-instructions.md](user-instructions.md)

## Features

- Presets for common resolutions (ultrawide, 1440p, 4K, 32:9, phone) or any custom size
- The crop window starts as large as possible; drag, click, zoom or nudge it with the keyboard
- High-quality Lanczos resizing ([pica](https://github.com/nodeca/pica))
- Optional AI upscaling (idealo RDN super-resolution models via [UpscalerJS](https://upscalerjs.com) and [TensorFlow.js](https://www.tensorflow.org/js)), loaded only when you use it
- JPEG, PNG or WebP output; download one at a time or as a zip
- Works on desktop and mobile

### Keyboard

| Key | Action |
|---|---|
| Arrow keys (Shift for faster) | Move crop |
| `+` / `-` or scroll | Zoom |
| `Enter` | Crop and go to the next photo |
| `S` | Skip |
| `[` / `]` | Previous / next |
| `R` | Re-centre |

## Running locally

It's built with [Vite](https://vite.dev), and the dependencies come from npm. You need Node.js (the version in `.nvmrc`). From the repo folder:

```sh
npm ci          # install the exact versions in package-lock.json
npm run dev     # serve with live reload at http://localhost:5173
```

`npm run build` builds the site into `dist/`, and `npm run preview` serves that build at http://localhost:4173.

Pushing to `main` builds the site and deploys it to GitHub Pages ([.github/workflows/pages.yml](.github/workflows/pages.yml)). The same workflow builds every pull request as a check.

## Updating dependencies

Renovate raises a pull request when a dependency in `package.json` has a new version. Merging to `main` is the deploy, so test it on the branch first:

1. Wait for the `pages` check on the pull request to pass. That means it builds.
2. Check out the branch, install and serve the production build:

   ```sh
   git fetch
   git switch <branch name from the pull request, e.g. renovate/ai-upscaling>
   npm ci
   bash scripts/test-images.sh    # first time only: downloads the test photos into test-images/
   npm run build && npm run preview
   ```

3. Open http://localhost:4173. Keep DevTools → Console open to catch errors.
4. Pick the 1080p preset and test what the update touches, using the photos in `test-images/`:

   | Updated | Photos | Check |
   |---|---|---|
   | AI upscaling (TensorFlow.js, UpscalerJS, ESRGAN models) | `upscale-x2-*`, `upscale-x3-*`, `upscale-x4-*` | Each one uses a different AI model; the yellow warning shows how much it's upscaled. Make sure "AI upscale failed, used Lanczos instead" doesn't appear. |
   | pica | `large-*` | Check the output is sharp, not blocky. |
   | JSZip | all of them | Click "Download all (.zip)" and check the zip opens. |
   | Fonts | any | Check the text still looks right. |
   | Vite | all of them | Everything above; a Vite update changes how the whole site is built. |

   Dropping all five photos in at once covers everything in one go.

5. Merge. After an AI upscaling update, try one upscale on a phone once it's live, as phone GPUs are where TensorFlow.js is most likely to break.
6. Switch back with `git switch main` and `git pull`.

To update something by hand, run `npm install <package>@<version>` and test the same way.

UpscalerJS says it needs TensorFlow.js 4.11.x, but newer versions work, so the `overrides` entry in `package.json` makes it use the same TensorFlow.js as the site. If an AI upscaling update breaks, that's the first thing to suspect.

## Limitations

- iPhone HEIC photos aren't supported by most browsers; export them as JPEG first.
- AI upscaling runs on your GPU via WebGL. It takes seconds on a desktop and can take a minute or more on a phone.

## Licence

MIT. Provided as-is, without warranty; see [LICENSE](LICENSE).

The npm dependencies bundled into the site keep their own licences: TensorFlow.js (Apache-2.0), UpscalerJS and its models (MIT), idealo image-super-resolution weights (Apache-2.0), pica (MIT), JSZip (MIT), Inter, Fraunces and JetBrains Mono fonts (SIL OFL 1.1).
