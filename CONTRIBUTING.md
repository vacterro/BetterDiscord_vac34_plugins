# Contributing

Keep changes narrow and reproducible.

Before opening a pull request:

1. Run `npm run check`.
2. Test the changed plugin in the current BetterDiscord build.
3. Include the Discord state that reproduced the issue: ordinary message, embed, GIF, sticker, attachment, bot embed, DM, or guild.
4. Do not include private message text, user IDs, channel IDs, attachment URLs, or authentication data in logs/screenshots unless they are intentionally public test fixtures.
5. Prefer stable Discord module/semantic contracts over generated CSS hash classes.
6. If a selector/module cannot be identified confidently, fail open rather than hiding unrelated UI.
