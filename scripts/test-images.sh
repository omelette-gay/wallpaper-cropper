#!/usr/bin/env bash
# Downloads the photos used to test the site (see "Updating dependencies" in README.md) into test-images/, which git
# ignores. They come from Lorem Picsum by fixed photo ID, so it's the same photos every time. The photos are from
# Unsplash, under the Unsplash licence.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p test-images

# Picsum photo ID, width, height, file name. With the 1080p preset, the 16:9 sizes below pick each AI model
images=(
  "1015 1000 563  upscale-x2-1000x563.jpg"   # 1920/1000 = 1.92x, ×2 model
  "1018 700  394  upscale-x3-700x394.jpg"    # 1920/700 = 2.74x, ×3 model
  "1036 400  225  upscale-x4-400x225.jpg"    # 1920/400 = 4.8x, ×4 model
  "1043 3840 2160 large-3840x2160.jpg"       # downscaled by pica
  "29   2560 1440 large-2560x1440.jpg"       # a second large photo, for the zip download
)

for image in "${images[@]}"; do
  read -r id width height name <<< "$image"
  echo "test-images/$name"
  curl --fail --silent --show-error --location --retry 3 --output "test-images/$name" \
    "https://picsum.photos/id/$id/$width/$height.jpg"
done
