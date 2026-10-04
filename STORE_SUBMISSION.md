# BetterDiscord Store preparation

The repository is structured so each distributable plugin is a standalone root-level `.plugin.js` file.

## Candidates

- `MediaFilter.plugin.js` — primary candidate; combines media collapsing, GIF suppression, sticker suppression and per-server scope.
- `GoodEmoji.plugin.js` — separate behavior and independent settings/ownership surface.
- `SilentTyping.plugin.js` — separate privacy behavior; overlap with existing Store plugins should be evaluated before submission.

## Pre-submission checklist

- verify current BetterDiscord publishing/authorship rules;
- run `npm run check`;
- perform live Discord acceptance on the current stable client;
- confirm `stop()` removes patches/observers/UI owned by the plugin;
- verify no private message content is logged;
- verify raw download/source URLs remain stable;
- keep attribution in `NOTICE.md` current;
- submit plugins individually if BetterDiscord review requires one addon per submission.
