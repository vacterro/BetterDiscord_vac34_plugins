<div align="center">

# BetterDiscord vac34 plugins

**Small BetterDiscord plugins for cleaner chat, calmer media, and less noisy status signaling.**

[![BetterDiscord](https://img.shields.io/badge/BetterDiscord-Plugins-5865F2?logo=discord&logoColor=white)](https://betterdiscord.app/)
[![JavaScript](https://img.shields.io/badge/JavaScript-plain%20JS-F7DF1E?logo=javascript&logoColor=111)](https://developer.mozilla.org/docs/Web/JavaScript)
[![License](https://img.shields.io/badge/license-MIT-D4B86A)](LICENSE)

</div>

## Plugins

| Plugin | What it does | Version | Download |
|---|---|---:|---|
| **MediaFilter** | Collapses images, videos and embeds to a compact `Show` control, removes GIFs and stickers before layout, supports per-server scope, and avoids empty media gaps. | 1.0.0 | [MediaFilter.plugin.js](https://raw.githubusercontent.com/vacterro/BetterDiscord_vac34_plugins/main/MediaFilter.plugin.js) |
| **GoodEmoji** | Rewrites a small set of sad/toxic emoji into deliberately cheerful alternatives. | 1.1.1 | [GoodEmoji.plugin.js](https://raw.githubusercontent.com/vacterro/BetterDiscord_vac34_plugins/main/GoodEmoji.plugin.js) |
| **SilentTyping** | Stops Discord from sending your outgoing typing indicator while leaving incoming typing indicators untouched. | 1.0.0 | [SilentTyping.plugin.js](https://raw.githubusercontent.com/vacterro/BetterDiscord_vac34_plugins/main/SilentTyping.plugin.js) |

### MediaFilter

MediaFilter combines the previously separate HideEmbeds, RemoveGIFS, and RemoveStickers experiments into one plugin with one settings surface and one ownership model.

Default behavior:

- images, video previews, attachments and embeds are collapsed;
- collapsed media leaves only a compact `Show` button;
- `Show` reveals the original media **inline in the message**, not in a fullscreen viewer;
- GIFs are removed before the media subtree reaches layout;
- stickers are removed before Discord creates the sticker accessories layout;
- sticker-only message rows are collapsed so they do not leave large empty gaps;
- generated embed source links can be hidden when Discord already rendered the corresponding preview;
- filtering can run on all servers, only selected servers, all except selected servers, and optionally DMs.

The media path is React-first rather than a late `display:none` pass. Discord frequently gives image, video, GIF and sticker wrappers fixed geometry. Hiding only the leaf media element leaves a magnificent empty parking lot in the chat. Removing/collapsing at the renderer boundary avoids that class of bug.

### GoodEmoji

Current mappings include:

`😭 → 😂` · `💀 → 🙂` · `🥀 → 🌹` · `🤡 → 👍` · `🖕 → ✌️`

It also marks rewritten emoji as plugin-owned media so sibling filters do not accidentally classify them as attachments.

### SilentTyping

SilentTyping patches Discord's `startTyping` / `stopTyping` module calls. It only suppresses **your outgoing typing signal**. It does not hide other people's typing indicators from you.

## Install

1. Install [BetterDiscord](https://betterdiscord.app/).
2. Download the desired `.plugin.js` file from the table above.
3. Copy it to:

```text
%APPDATA%\BetterDiscord\plugins
```

4. Discord → **User Settings → BetterDiscord → Plugins**.
5. Enable the plugin.

A Discord reload (`Ctrl+R`) is usually enough after replacing a plugin file.

## Design rules

- no remote runtime dependencies;
- no telemetry;
- no message-content logging;
- no generated Discord hash class names as primary contracts;
- fail open when media classification is uncertain;
- plugin teardown removes its own patches, observers and UI only;
- media filtering happens as close to Discord's render boundary as practical so hidden content does not reserve dead layout space.

## Development

No npm runtime is required by users. Contributors can syntax-check all published plugins with:

```bash
npm run check
```

## BetterDiscord Store status

This repository is a clean public source home, but **the plugins are not represented here as already approved by the official BetterDiscord Store**. Store review and authorship/licensing requirements are separate from GitHub publication and should be checked against the current BetterDiscord publishing rules before submission.

## Acknowledgements

Some implementation techniques were informed by public BetterDiscord work, especially React render-boundary handling and Discord module discovery. See [NOTICE.md](NOTICE.md) for attribution and license notes.

## Project network

This repository is part of the broader [vacterro](https://github.com/vacterro) tool collection and grew out of BetterDiscord integration work in [Wintage](https://github.com/vacterro/Wintage).

---

<div align="center">

**Less clutter. Fewer dead gaps. Discord can keep changing its furniture.**

</div>
