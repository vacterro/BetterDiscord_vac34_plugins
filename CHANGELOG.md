# Changelog

## MediaFilter 1.0.4

- Fix off/on collapse regression: discard detached Show/Hide controls and reliably re-hide existing media nodes.
- Recognize unloaded images, source-less videos, embedded iframe players, and opaque media backed by message attachment records.
- Observe CSS background-image replacements without responding to unrelated animation style changes; preserve captions, emoji, avatars, and independent GIF/sticker filtering.
- Add focused regression coverage for virtualization, settings reactivation, lazy media and inline controls (27 passing offline tests total).
- Live BetterDiscord validation still required.

## MediaFilter 1.0.3

- Add a reversible DOM media-collapse fallback for images and videos when Discord's private React media renderer cannot be intercepted. User-visible inline Show/Hide preserves captions, avatars, inline emoji and unrelated attachments.
- Preserve sticker-only removal and independent GIF suppression; do not expose confirmed sticker-only messages with media reveal buttons.
- Restore fallback controls on message virtualization and remove all plugin-owned DOM elements on stop or setting changes.
- Resolve MessageStore metadata using the row's encoded channel snowflake where available, avoiding selected-channel drift during navigation.
- Suppress GIF-only accessory content even when Discord supplies opaque media URLs, including when the message contains text.
- Expand offline coverage to 19 focused tests, including repeated reconciliation and scope-sensitive DOM fallback behavior.
- Live Discord client verification is still required after installation.

## MediaFilter 1.0.2

- Resolve sticker-only messages through Discord's MessageStore when render hooks miss a sticker or Discord changes markup.
- Suppress sticker accessories in mixed text + sticker messages without deleting the text.
- Filter GIF media served by Tenor/Giphy/Klipy as video or WebP, in addition to animated embeds and GIF attachments.
- Track lazy-loaded media URLs, attribute changes, and virtualized rows; restore hidden content when settings or message identity change.
- Coalesce renderer-triggered full reconciliations and scope mutation handling to affected message rows to reduce reflow work.
- Add offline regression tests for sticker-only rows, mixed content, GIF provider media, virtualized row reuse and settings teardown.

## [Unreleased]

- Repository created as the canonical public home for vac34 BetterDiscord plugins.
- Combined the former HideEmbeds, RemoveGIFS, and RemoveStickers experiments into **MediaFilter 1.0.0**.
- Added per-server media scope, inline reveal, GIF suppression, sticker suppression, and sticker-only row collapse.
- Kept **GoodEmoji 1.1.1** as a focused standalone plugin.
- Kept **SilentTyping 1.0.0** as a focused standalone plugin.

## MediaFilter 1.0.1

- Enhanced sticker detection across all payload variants: direct stickers, raw sticker items, legacy stickers, and forwarded message snapshots.
- Multi-tier sticker suppression: pre-render message stripping, React element tree pruning, dedicated sticker component interception, and real-time DOM reconciliation.
- Comprehensive CSS rules to instantly suppress sticker elements, suggestion popups, and picker elements without layout gaps.
- Sticker-only message rows are fully collapsed (including sticker-only replies) to prevent empty chat bubbles.
- Dynamic scope synchronization on server and channel switching via `SelectedGuildStore` and `SelectedChannelStore`.

## MediaFilter 1.0.0

- React-first image, video, attachment and embed collapsing.
- Compact inline `Show` / `Hide` control.
- GIF detection for direct GIFs, GIFV, Tenor, Giphy and Klipy-style embeds.
- Sticker removal before Discord creates the sticker accessories layout.
- Sticker-only message-row collapse to prevent empty vertical gaps.
- Per-server allow/exclude scope and optional DM handling.
- Optional suppression of source links already represented by an embed.
