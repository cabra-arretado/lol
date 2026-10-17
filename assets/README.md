# lol branding

`bb-logo.svg` is the editable source for the Deadpan lol logo. The existing asset filenames stay stable for their consumers.

Run `pnpm --filter @bb/app generate:pwa-icons` from the repository root after editing the SVG. This regenerates:

- Transparent dark, white, and development logos, plus the opaque Discord avatar in this directory.
- Browser favicons, including dark and development variants.
- PWA icons, maskable icons, monochrome masks, and Apple touch icons, including all eight color preferences.
- Stable, nightly, and development desktop PNGs, plus stable and nightly macOS ICNS bundles.

The stable desktop icon has a white tile, nightly has a dark tile, and development retains the grid. Maskable icons keep the mark inside the platform safe area; Apple touch icons have an opaque white background. The ICNS files contain PNG representations from 16 through 1024 pixels.

`generate-pwa-icons.mjs --check`, also run by the app test task, verifies that all generated branding assets match the SVG. PNGs and each ICNS representation are compared by decoded RGBA pixels and dimensions, allowing different compression or metadata across machines. ICNS representation types must also match. Manifest files are compared exactly.

The generator requires a single SVG root and a single path with `fill="#151515"`, without inline styles. Unsupported structure changes fail before writing assets. Update the generator alongside any change to this contract.

The ICNS table includes standard types `icp4`, `icp5`, `ic07`, `ic08`, and `ic09`, plus Retina types `ic11`, `ic12`, `ic13`, `ic14`, and `ic10`. Standard and Retina entries can have the same pixel dimensions while representing different logical sizes.

The shared UI logo, onboarding, and the official plugin collection consume the SVG directly.

`app-screenshot.png` is a historical product screenshot, and `blacksmith-ci.png` belongs to the CI sponsor. Neither is a logo source. Provider and plugin icons retain their own identities.
