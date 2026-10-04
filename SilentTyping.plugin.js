/**
 * @name SilentTyping
 * @version 1.0.0
 * @author vacterro
 * @description Stops Discord from sending your typing indicator while leaving incoming typing indicators untouched.
 * @source https://github.com/vacterro/BetterDiscord_vac34_plugins/blob/main/SilentTyping.plugin.js
 * @website https://github.com/vacterro/BetterDiscord_vac34_plugins
 * @license MIT
 */
/* global BdApi */
'use strict';

const CALLER = 'SilentTyping-vacterro';

module.exports = class SilentTyping {
    constructor() {
        this.typingModule = null;
        this.blocked = 0;
    }

    start() {
        const Filters = BdApi?.Webpack?.Filters;
        this.typingModule = Filters
            ? BdApi.Webpack.getModule(Filters.byKeys('startTyping', 'stopTyping'))
            : BdApi?.Webpack?.getByKeys?.('startTyping', 'stopTyping');

        if (!this.typingModule?.startTyping || !this.typingModule?.stopTyping) {
            BdApi?.UI?.showToast?.('SilentTyping: Discord typing module not found', { type: 'warning' });
            return;
        }

        BdApi.Patcher.instead(CALLER, this.typingModule, 'startTyping', () => {
            this.blocked++;
        });
        BdApi.Patcher.instead(CALLER, this.typingModule, 'stopTyping', () => {});
    }

    stop() {
        BdApi?.Patcher?.unpatchAll?.(CALLER);
        this.typingModule = null;
    }

    getSettingsPanel() {
        const panel = document.createElement('div');
        panel.style.padding = '12px';
        panel.innerHTML =
            '<h3 style="margin:0 0 8px">SilentTyping</h3>' +
            '<div>Outgoing typing indicators are blocked while this plugin is enabled.</div>' +
            '<div style="margin-top:8px;color:var(--text-muted)">Blocked this session: ' + this.blocked + '</div>';
        return panel;
    }
};
