# lol branding

`lol-logo-source.png` is the approved yellow LoL wordmark on green, preserved exactly as selected. Replace this source to update the identity; do not edit generated icons individually. Existing `bb-logo` filenames stay stable for their consumers.

Run `pnpm exec turbo run generate:pwa-icons --filter=@bb/app` from the repository root after replacing the source. This regenerates:

- The full-color logo, transparent white and development glyphs, and the Discord avatar in this directory.
- Browser favicons, including dark, development, and monochrome tint masks.
- PWA icons, maskable icons, monochrome masks, and Apple touch icons, including all eight color preferences.
- Stable, nightly, and development desktop PNGs, plus stable and nightly macOS ICNS bundles.

Default browser, install, and stable desktop icons preserve the yellow-on-green artwork in both themes. Nightly uses a yellow glyph on a dark tile, and development retains its grid. Optional icon colors use the wordmark silhouette on white. Maskable icons keep the lettering inside the platform safe circle, and touch icons are opaque. Monochrome icons and browser tint masks contain only the lettering, with a transparent background.

The generator accepts an opaque square PNG at least 512 pixels wide. It derives the lettering mask from the warm yellow pixels, excluding the green background and dark-green shadow. A source with a different palette needs a corresponding update to the mask extraction.

`generate-pwa-icons.mjs --check`, also run by the app test task, verifies all generated branding assets against the source. PNGs and each ICNS representation are compared by decoded RGBA pixels and dimensions, allowing different compression or metadata across machines. ICNS representation types must also match. Manifest files are compared exactly.

The ICNS table includes standard types `icp4`, `icp5`, `ic07`, `ic08`, and `ic09`, plus Retina types `ic11`, `ic12`, `ic13`, `ic14`, and `ic10`, covering 16 through 1024 pixels. Standard and Retina entries can have the same pixel dimensions while representing different logical sizes.

The shared UI logo, onboarding, official plugin collection, and repository README consume the generated full-color PNG without theme inversion or CSS masking.

`app-screenshot.png` is a historical product screenshot, and `blacksmith-ci.png` belongs to the CI sponsor. Neither is a logo source. Provider and plugin icons retain their own identities.
