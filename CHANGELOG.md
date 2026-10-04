# Changelog

## [Unreleased]

- Repository created as the canonical public home for vac34 BetterDiscord plugins.
- Combined the former HideEmbeds, RemoveGIFS, and RemoveStickers experiments into **MediaFilter 1.0.0**.
- Added per-server media scope, inline reveal, GIF suppression, sticker suppression, and sticker-only row collapse.
- Kept **GoodEmoji 1.1.1** as a focused standalone plugin.
- Kept **SilentTyping 1.0.0** as a focused standalone plugin.

## MediaFilter 1.0.0

- React-first image, video, attachment and embed collapsing.
- Compact inline `Show` / `Hide` control.
- GIF detection for direct GIFs, GIFV, Tenor, Giphy and Klipy-style embeds.
- Sticker removal before Discord creates the sticker accessories layout.
- Sticker-only message-row collapse to prevent empty vertical gaps.
- Per-server allow/exclude scope and optional DM handling.
- Optional suppression of source links already represented by an embed.
