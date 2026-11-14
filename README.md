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

## Limitations

- iPhone HEIC photos aren't supported by most browsers; export them as JPEG first.
- AI upscaling runs on your GPU via WebGL. It takes seconds on a desktop and can take a minute or more on a phone.

## Licence

MIT. Provided as-is, without warranty; see [LICENSE](LICENSE).

Third-party code and models in `lib/` and `models/` keep their own licences: TensorFlow.js (Apache-2.0), UpscalerJS and its models (MIT), idealo image-super-resolution weights (Apache-2.0), pica (MIT), JSZip (MIT), Inter and JetBrains Mono fonts (SIL OFL 1.1).
