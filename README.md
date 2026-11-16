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

It's a static site with no build step. Serve the folder with anything, for example:

```sh
python3 -m http.server
```

Then open http://localhost:8000. Opening `index.html` straight from disk works for cropping, but AI upscaling needs it served over HTTP.

## Updating dependencies

The files in `lib/`, `models/` and `fonts/` are downloaded by [scripts/vendor.sh](scripts/vendor.sh), which lists their versions. Renovate raises a pull request when a new version comes out, and the `vendor` workflow then commits the new files to that pull request.

The site deploys from `main` on GitHub Pages, so merging the pull request is the deploy. Test it on the branch first:

1. Wait for the "Download vendored files…" commit from the workflow on the pull request. Until it's there, only the version number has changed.
2. Check out the branch and serve it:

   ```sh
   gh pr checkout <PR number>
   bash scripts/test-images.sh    # first time only: downloads the test photos into test-images/
   python3 -m http.server
   ```

3. Open http://localhost:8000 in a private window, or with DevTools → Network → "Disable cache" ticked, so the browser doesn't use old copies of the files. Keep DevTools → Console open to catch errors.
4. Pick the 1080p preset and test what the update touches, using the photos in `test-images/`:

   | Updated | Photos | Check |
   |---|---|---|
   | AI upscaling (TensorFlow.js, UpscalerJS, ESRGAN models) | `upscale-x2-*`, `upscale-x3-*`, `upscale-x4-*` | Each one uses a different AI model; the yellow warning shows how much it's upscaled. Make sure "AI upscale failed, used Lanczos instead" doesn't appear. |
   | pica | `large-*` | Check the output is sharp, not blocky. |
   | JSZip | all of them | Click "Download all (.zip)" and check the zip opens. |
   | Fonts | any | Check the text still looks right. |

   Dropping all five photos in at once covers everything in one go.

5. Merge. After an AI upscaling update, try one upscale on a phone once it's live, as phone GPUs are where TensorFlow.js is most likely to break.

To update something by hand, change its version in `scripts/vendor.sh`, run `bash scripts/vendor.sh` and test the same way.

## Limitations

- iPhone HEIC photos aren't supported by most browsers; export them as JPEG first.
- AI upscaling runs on your GPU via WebGL. It takes seconds on a desktop and can take a minute or more on a phone.

## Licence

MIT. Provided as-is, without warranty; see [LICENSE](LICENSE).

Third-party code and models in `lib/` and `models/` keep their own licences: TensorFlow.js (Apache-2.0), UpscalerJS and its models (MIT), idealo image-super-resolution weights (Apache-2.0), pica (MIT), JSZip (MIT), Inter and JetBrains Mono fonts (SIL OFL 1.1).
