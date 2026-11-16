#!/usr/bin/env bash
# Downloads the third-party files the site serves from lib/, models/ and fonts/.
#
# There's no build step, so these files are committed as-is. Renovate bumps the versions below, and
# .github/workflows/vendor.yml runs this script on the pull request and commits the new files. To update by
# hand, change a version and run `bash scripts/vendor.sh`.
set -euo pipefail
cd "$(dirname "$0")/.."

# renovate: datasource=npm depName=@tensorflow/tfjs
TFJS_VERSION="4.22.0"
# renovate: datasource=npm depName=upscaler
UPSCALER_VERSION="1.0.0"
# renovate: datasource=npm depName=@upscalerjs/esrgan-medium
ESRGAN_MEDIUM_VERSION="1.0.0"
# renovate: datasource=npm depName=pica
PICA_VERSION="10.0.3"
# renovate: datasource=npm depName=jszip
JSZIP_VERSION="3.10.2"
# renovate: datasource=npm depName=@fontsource/inter
INTER_VERSION="5.3.0"
# renovate: datasource=npm depName=@fontsource/fraunces
FRAUNCES_VERSION="5.3.0"
# renovate: datasource=npm depName=@fontsource/jetbrains-mono
JETBRAINS_MONO_VERSION="5.3.0"

fetch() {
  echo "$1 -> $2"
  curl --fail --silent --show-error --location --retry 3 --output "$2" "https://cdn.jsdelivr.net/npm/$1"
}

fetch "@tensorflow/tfjs@$TFJS_VERSION/dist/tf.min.js" lib/tf.min.js
fetch "upscaler@$UPSCALER_VERSION/dist/browser/umd/upscaler.min.js" lib/upscaler.min.js
fetch "pica@$PICA_VERSION/dist/pica.min.js" lib/pica.min.js
fetch "jszip@$JSZIP_VERSION/dist/jszip.min.js" lib/jszip.min.js

for scale in 2 3 4; do
  esrgan="@upscalerjs/esrgan-medium@$ESRGAN_MEDIUM_VERSION"
  fetch "$esrgan/dist/umd/models/esrgan-medium/src/x$scale/index.min.js" "lib/esrgan-medium-x$scale.min.js"
  fetch "$esrgan/models/x$scale/model.json" "models/x$scale/model.json"
  fetch "$esrgan/models/x$scale/group1-shard1of1.bin" "models/x$scale/group1-shard1of1.bin"
done

for weight in 400 500 600 700; do
  fetch "@fontsource/inter@$INTER_VERSION/files/inter-latin-$weight-normal.woff2" "fonts/inter-latin-$weight-normal.woff2"
done
fetch "@fontsource/fraunces@$FRAUNCES_VERSION/files/fraunces-latin-600-italic.woff2" fonts/fraunces-latin-600-italic.woff2
for weight in 400 500; do
  fetch "@fontsource/jetbrains-mono@$JETBRAINS_MONO_VERSION/files/jetbrains-mono-latin-$weight-normal.woff2" \
    "fonts/jetbrains-mono-latin-$weight-normal.woff2"
done
