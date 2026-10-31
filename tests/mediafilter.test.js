'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');

class FakeElement {
    constructor(kind, attrs = {}, children = [], text = '') {
        this.kind = kind;
        this.nodeType = 1;
        this.tagName = kind === 'regular-img' || kind === 'gif-img' || kind === 'avatar-img' || kind === 'emoji-img' ? 'IMG' : kind === 'video' ? 'VIDEO' : kind === 'source' ? 'SOURCE' : kind === 'iframe' ? 'IFRAME' : kind === 'canvas' ? 'CANVAS' : 'DIV';
        this.events = {};
        this.attrs = { ...attrs };
        this.id = attrs.id || '';
        this.children = children;
        this.textContent = text;
        this.isConnected = true;
        const classes = new Set((attrs.class || '').split(' ').filter(Boolean));
        this.classList = {
            add: (...values) => values.forEach((value) => classes.add(value)),
            remove: (...values) => values.forEach((value) => classes.delete(value)),
            contains: (value) => classes.has(value),
            toggle: (value, force) => {
                if (force ?? !classes.has(value)) classes.add(value);
                else classes.delete(value);
            },
        };
        Object.defineProperty(this, 'className', {
            get: () => [...classes].join(' '),
            set: (value) => { classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach((name) => classes.add(name)); },
        });
        for (const child of children) child.parentElement = this;
    }
    getAttribute(name) { return this.attrs[name] ?? null; }
    setAttribute(name, value) { this.attrs[name] = value; }
    addEventListener(name, callback) { this.events[name] = callback; }
    click() { this.events.click?.({ preventDefault() {}, stopPropagation() {} }); }
    remove() {
        if (!this.parentElement) return;
        this.parentElement.children.splice(this.parentElement.children.indexOf(this), 1);
        this.parentElement = null;
        this.isConnected = false;
    }
    get previousElementSibling() {
        if (!this.parentElement) return null;
        const siblings = this.parentElement.children;
        return siblings[siblings.indexOf(this) - 1] || null;
    }
    insertAdjacentElement(where, other) {
        assert.equal(where, 'afterend');
        other.remove();
        const siblings = this.parentElement.children;
        siblings.splice(siblings.indexOf(this) + 1, 0, other);
        other.parentElement = this.parentElement;
        other.isConnected = true;
    }
    matches(selector) {
        if (selector.includes('chat-messages-') && this.kind === 'row') return true;
        if (selector.includes('stickerNode') && this.kind === 'sticker') return true;
        if (selector.includes('mediaContainer') && this.kind === 'media-wrapper') return true;
        if ((selector.includes('message-accessories') || selector.includes('messageAccessories') || selector.includes('accessories_')) && this.kind === 'accessories') return true;
        if (selector.includes('avatar') && this.kind === 'avatar') return true;
        if (selector.includes('emoji') && this.kind === 'emoji') return true;
        if (selector.includes('reaction') && this.kind === 'reaction') return true;
        if (selector.includes('repliedMessage') && this.kind === 'replied') return true;
        if (selector.startsWith('.') && this.classList.contains(selector.slice(1))) return true;
        return false;
    }
    contains(el) { return this === el || this.children.some((child) => child.contains(el)); }
    closest(selector) {
        if (selector.includes('chat-messages-')) {
            for (let node = this; node; node = node.parentElement) if (node.kind === 'row') return node;
        }
        if (selector.includes('mediaContainer') || selector.includes('visualMediaItem') || selector.includes('embedWrapper') || selector.includes('imageWrapper') || selector.includes('videoContainer')) {
            for (let node = this; node; node = node.parentElement) {
                if (node.kind === 'gif-wrapper' || node.kind === 'media-wrapper') return node;
            }
        }
        if (selector.includes('message-accessories') || selector.includes('messageAccessories') || selector.includes('accessories_')) {
            for (let node = this; node; node = node.parentElement) if (node.kind === 'accessories') return node;
        }
        if (selector.includes('avatar') || selector.includes('repliedMessage') || selector.includes('reaction') || selector.includes('emoji')) {
            for (let node = this; node; node = node.parentElement) {
                if (['avatar', 'replied', 'reaction', 'emoji'].includes(node.kind)) return node;
            }
        }
        if (selector.startsWith('.')) {
            for (let node = this; node; node = node.parentElement) if (node.classList.contains(selector.slice(1))) return node;
        }
        return null;
    }
    querySelectorAll(selector) {
        const all = [];
        function collect(node) { for (const child of node.children) { all.push(child); collect(child); } }
        collect(this);
        if (selector.includes('chat-messages-')) return all.filter((el) => el.kind === 'row');
        if (selector.startsWith('.vac34-mf-')) {
            return all.filter((el) => el.classList.contains(selector.slice(1)));
        }
        if (selector.includes('img[src]') || selector.includes('video[src]') || selector.includes('img, video')) {
            return all.filter((el) => ['gif-img', 'regular-img', 'avatar-img', 'emoji-img', 'video', 'iframe', 'canvas', 'background'].includes(el.kind));
        }
        if (selector.includes('imageWrapper') || selector.includes('mediaContainer') || selector.includes('embedWrapper')) {
            return all.filter((el) => el.kind === 'media-wrapper');
        }
        if (selector.includes('stickerNode')) return all.filter((el) => el.kind === 'sticker');
        if (selector.includes('message-accessories-')) return all.filter((el) => el.kind === 'accessories');
        if (selector.includes('messageContent')) return all.filter((el) => el.kind === 'content');
        if (selector.includes('embedWrapper_')) return all.filter((el) => el.kind === 'ordinary-attachment');
        return [];
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture() {
    const messages = new Map();
    const selectedGuild = { getGuildId: () => 'guild-1' };
    const selectedChannel = { getChannelId: () => 'channel-1' };
    const stores = {
        SelectedGuildStore: selectedGuild,
        SelectedChannelStore: selectedChannel,
        MessageStore: { getMessage: (_channel, id) => messages.get(id) || null },
    };
    const api = {
        React: { isValidElement: () => false },
        Webpack: { getModule: () => undefined, getStore: (name) => stores[name], Stores: stores },
        Data: { load: () => ({}), save: () => {} },
    };
    const source = fs.readFileSync(path.join(__dirname, '..', 'MediaFilter.plugin.js'), 'utf8');
    const context = vm.createContext({
        BdApi: api, module: { exports: {} }, console, URL, window: {},
        document: { createElement: () => new FakeElement('toggle') },
        AbortController, queueMicrotask,
    });
    const exposed = vm.runInContext(source + '\n({ Settings, isGifAttachment, isGifEmbed, isGifMediaElement, gifOnlyMessage, reconcileStickerRows, messageForRow, clearDomMediaFallback, effectiveSettings, updateServerFilter, clearServerFilters, shouldCollapse, shouldCollapseDom, css });', context);
    return { ...exposed, messages, stores };
}

const messageId = '123456789012345678';
const sticker = { id: '555555555555555555' };
const stickerMessage = { id: messageId, content: '', stickerItems: [sticker], attachments: [], embeds: [] };

function row(...children) {
    return new FakeElement('row', { id: 'chat-messages-channel-1-' + messageId }, children);
}

test('sticker-only message disappears even without a recognizable DOM sticker class', () => {
    const f = fixture();
    f.messages.set(messageId, stickerMessage);
    const item = row(new FakeElement('accessories', { id: 'message-accessories-' + messageId }, [new FakeElement('regular-img', { src: 'blob:opaque' })]));
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), true);
});

test('sticker and real text hides accessories but preserves the message row', () => {
    const f = fixture();
    f.messages.set(messageId, { ...stickerMessage, content: 'Hello' });
    const accessory = new FakeElement('accessories', { id: 'message-accessories-' + messageId }, [new FakeElement('regular-img', { src: 'blob:opaque' })]);
    const content = new FakeElement('content', {}, [], 'Hello');
    const item = row(content, accessory);
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), false);
    assert.equal(accessory.classList.contains('vac34-mf-sticker-accessory-hidden'), true);
    assert.equal(content.textContent, 'Hello');
});

test('virtualized row reuse restores its accessories and row visibility', () => {
    const f = fixture();
    f.messages.set(messageId, stickerMessage);
    const accessory = new FakeElement('accessories', { id: 'message-accessories-' + messageId });
    const item = row(accessory);
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), true);
    f.messages.set(messageId, { id: messageId, content: 'Plain text', stickerItems: [] });
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), false);
    assert.equal(accessory.classList.contains('vac34-mf-sticker-accessory-hidden'), false);
});

test('GIF-only Tenor mp4 with opaque image URL disappears using message metadata', () => {
    const f = fixture();
    const embed = { type: 'gifv', url: 'https://tenor.com/view/example' };
    f.messages.set(messageId, { id: messageId, content: '', embeds: [embed] });
    const item = row(new FakeElement('gif-wrapper', {}, [new FakeElement('gif-img', { src: 'blob:opaque' })]));
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), true);
    assert.equal(f.isGifEmbed(embed), true);
});

test('Tenor GIFs served as mp4/webp are caught in DOM, normal image is left alone', () => {
    const f = fixture();
    const tenor = new FakeElement('gif-img', { src: 'https://media.tenor.com/x/tenor.mp4' });
    const gifWrapper = new FakeElement('gif-wrapper', {}, [tenor]);
    const regularWrapper = new FakeElement('gif-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/img.png' })]);
    const item = row(new FakeElement('content', {}, [], 'caption'), gifWrapper, regularWrapper);
    f.reconcileStickerRows(item);
    assert.equal(gifWrapper.classList.contains('vac34-mf-gif-hidden'), true);
    assert.equal(regularWrapper.classList.contains('vac34-mf-gif-hidden'), false);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), false);
});

test('disabling sticker and GIF filtering restores all plugin-owned hidden classes', () => {
    const f = fixture();
    const accessory = new FakeElement('accessories', { id: 'message-accessories-' + messageId });
    const gif = new FakeElement('gif-img', { src: 'https://media.tenor.com/test/tenor.mp4' });
    const gifWrapper = new FakeElement('gif-wrapper', {}, [gif]);
    const item = row(accessory, gifWrapper);
    f.messages.set(messageId, { ...stickerMessage, embeds: [{ type: 'gifv' }] });
    f.reconcileStickerRows(item);
    f.Settings.current.hideGifs = false;
    f.Settings.current.hideStickers = false;
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), false);
    assert.equal(accessory.classList.contains('vac34-mf-sticker-accessory-hidden'), false);
    assert.equal(gifWrapper.classList.contains('vac34-mf-gif-hidden'), false);
});

test('mixed sticker and regular attachment keeps the media accessories mounted', () => {
    const f = fixture();
    f.messages.set(messageId, {
        ...stickerMessage,
        content: 'Please keep the photo',
        attachments: [{ filename: 'photo.png', url: 'https://cdn.discordapp.com/attachments/photo.png' }],
    });
    const stickerElement = new FakeElement('sticker', { class: 'stickerNode_fake' });
    const accessory = new FakeElement('accessories', { id: 'message-accessories-' + messageId }, [stickerElement]);
    const item = row(new FakeElement('content', {}, [], 'Please keep the photo'), accessory);
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), false);
    assert.equal(accessory.classList.contains('vac34-mf-sticker-accessory-hidden'), false);
    assert.equal(stickerElement.classList.contains('vac34-mf-sticker-hidden'), true);
});

test('media virtualization updates GIF hiding when src changes without replacing the node', () => {
    const f = fixture();
    const media = new FakeElement('gif-img', { src: 'https://media.tenor.com/x/tenor.webp' });
    const wrapper = new FakeElement('gif-wrapper', {}, [media]);
    const item = row(new FakeElement('content', {}, [], 'caption'), wrapper);
    f.reconcileStickerRows(item);
    assert.equal(wrapper.classList.contains('vac34-mf-gif-hidden'), true);
    media.attrs.src = 'https://cdn.discordapp.com/attachments/photo.png';
    f.reconcileStickerRows(item);
    assert.equal(wrapper.classList.contains('vac34-mf-gif-hidden'), false);
});


test('ordinary Discord attachment is collapsed with an accessible inline Show/Hide fallback', () => {
    const f = fixture();
    f.messages.set(messageId, { id: messageId, content: 'caption', attachments: [{ filename: 'meme.png' }] });
    const image = new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/123/456/meme.png' });
    const media = new FakeElement('media-wrapper', {}, [image]);
    const item = row(new FakeElement('content', {}, [], 'caption'), media);
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
    const button = item.querySelector('.vac34-mf-dom-media-toggle');
    assert.ok(button, 'fallback control must be mounted outside the image wrapper');
    assert.equal(button.textContent, 'Show');
    button.click();
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), false);
    assert.equal(button.textContent, 'Hide');
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), false, 'reconcile must preserve reveal state');
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 1);
    button.click();
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
});

test('sticker-only record still removes entire row rather than exposing the sticker with Show', () => {
    const f = fixture();
    f.messages.set(messageId, stickerMessage);
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'blob:sticker' })]);
    const item = row(new FakeElement('accessories', {}, [media]));
    f.reconcileStickerRows(item);
    assert.equal(item.classList.contains('vac34-mf-sticker-empty-row'), true);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 0);
});

test('avatars and inline emoji are never collapsed by media fallback', () => {
    const f = fixture();
    const avatar = new FakeElement('avatar', {}, [new FakeElement('avatar-img', { src: 'https://cdn.discordapp.com/avatars/11/abc.png' })]);
    const emoji = new FakeElement('emoji', {}, [new FakeElement('emoji-img', { src: 'https://cdn.discordapp.com/emojis/22.png' })]);
    const item = row(avatar, new FakeElement('content', {}, [emoji], 'Hello'));
    f.reconcileStickerRows(item);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 0);
});

test('when collapsing is disabled all DOM fallback markers and controls are removed', () => {
    const f = fixture();
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/1/2/a.png' })]);
    const item = row(media);
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
    f.Settings.current.collapseMedia = false;
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), false);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 0);
});

test('media DOM fallback drops stale button on virtualized media replacement', () => {
    const f = fixture();
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/1/2/a.png' })]);
    const item = row(media);
    f.reconcileStickerRows(item);
    const previous = item.querySelector('.vac34-mf-dom-media-toggle');
    media.children = [];
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), false);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
    assert.equal(previous.isConnected, false);
});

test('source URL does not itself turn an unwrapped inline emoji into an attachment', () => {
    const f = fixture();
    const item = row(new FakeElement('content', {}, [new FakeElement('emoji-img', { src: 'https://cdn.discordapp.com/emojis/123.png' })]));
    f.reconcileStickerRows(item);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 0);
});

test('bare attachment CDN image gets a control without hiding adjacent text or links', () => {
    const f = fixture();
    const content = new FakeElement('content', {}, [], 'This is important');
    const image = new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/123/456/photo.jpg' });
    const accessories = new FakeElement('accessories', {}, [image]);
    const item = row(content, accessories);
    f.reconcileStickerRows(item);
    assert.equal(image.classList.contains('vac34-mf-dom-media-hidden'), true);
    assert.equal(accessories.classList.contains('vac34-mf-dom-media-hidden'), false);
    assert.equal(content.textContent, 'This is important');
    assert.ok(item.querySelector('.vac34-mf-dom-media-toggle'));
});

test('GIFs do not become revealable through the image fallback', () => {
    const f = fixture();
    const gif = new FakeElement('gif-img', { src: 'https://media.tenor.com/id/tenor.webp' });
    const wrapper = new FakeElement('gif-wrapper', {}, [gif]);
    const item = row(wrapper);
    f.reconcileStickerRows(item);
    assert.equal(wrapper.classList.contains('vac34-mf-gif-hidden'), true);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
});

test('React-wrapped media is not double-collapsed by the DOM fallback', () => {
    const f = fixture();
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/1/2/a.png' })]);
    const shell = new FakeElement('media-shell', { class: 'vac34-mf-shell' }, [media]);
    const item = row(shell);
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), false);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
});

test('a row channel snowflake takes precedence over the selected channel', () => {
    const f = fixture();
    const channel = '222222222222222222';
    const item = new FakeElement('row', { id: 'chat-messages-' + channel + '-' + messageId });
    const channels = [];
    const msg = { id: messageId, content: 'from another channel' };
    f.stores.MessageStore.getMessage = (channelId, id) => {
        channels.push(channelId);
        return id === messageId && channelId === channel ? msg : null;
    };
    assert.equal(f.messageForRow(item), msg);
    assert.deepEqual(channels, [channel]);
});

test('reconciliation creates no additional fallback buttons on repeated runs', () => {
    const f = fixture();
    const item = row(new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/1/2/a.png' })]));
    for (let i = 0; i < 30; ++i) f.reconcileStickerRows(item);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 1);
});


test('opaque GIF embed with text suppresses accessories without deleting the text', () => {
    const f = fixture();
    f.messages.set(messageId, { id: messageId, content: 'caption', embeds: [{ type: 'gifv', url: 'https://tenor.com/view/123' }] });
    const content = new FakeElement('content', {}, [], 'caption');
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'blob:opaque' })]);
    const accessory = new FakeElement('accessories', {}, [media]);
    const item = row(content, accessory);
    f.reconcileStickerRows(item);
    assert.equal(accessory.classList.contains('vac34-mf-gif-hidden'), true);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
    assert.equal(content.textContent, 'caption');
});


test('regression: disable and re-enable collapse must hide the same media target again', () => {
    const f = fixture();
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/1/2/photo.png' })]);
    const item = row(media);
    f.reconcileStickerRows(item);
    const first = item.querySelector('.vac34-mf-dom-media-toggle');
    first.click();
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), false);
    f.Settings.current.collapseMedia = false;
    f.reconcileStickerRows(item);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
    f.Settings.current.collapseMedia = true;
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 1);
    assert.notEqual(item.querySelector('.vac34-mf-dom-media-toggle'), first);
});

test('regression: replacement and reuse of a media target must not preserve stale reveal state', () => {
    const f = fixture();
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/1/2/photo.png' })]);
    const item = row(media);
    f.reconcileStickerRows(item);
    item.querySelector('.vac34-mf-dom-media-toggle').click();
    media.children = [];
    f.reconcileStickerRows(item);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
    const photo = new FakeElement('regular-img', { src: 'https://cdn.discordapp.com/attachments/3/4/new.png' });
    photo.parentElement = media;
    media.children = [photo];
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
    assert.equal(item.querySelectorAll('.vac34-mf-dom-media-toggle').length, 1);
});

test('lazy image without src inside a media boundary is collapsed before loading', () => {
    const f = fixture();
    const media = new FakeElement('media-wrapper', {}, [new FakeElement('regular-img')]);
    const item = row(media);
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
});

test('video without src is collapsed while message caption remains visible', () => {
    const f = fixture();
    const video = new FakeElement('video');
    const media = new FakeElement('media-wrapper', {}, [video]);
    const caption = new FakeElement('content', {}, [], 'Video caption');
    const item = row(caption, media);
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
    assert.equal(caption.textContent, 'Video caption');
});

test('iframe video preview in the accessories is collapsed', () => {
    const f = fixture();
    const frame = new FakeElement('iframe', { src: 'https://www.youtube.com/embed/example' });
    const media = new FakeElement('media-wrapper', {}, [frame]);
    const item = row(new FakeElement('accessories', {}, [media]));
    f.reconcileStickerRows(item);
    assert.equal(media.classList.contains('vac34-mf-dom-media-hidden'), true);
});

test('opaque media in accessories uses attachment record, but never masks the caption', () => {
    const f = fixture();
    f.messages.set(messageId, { id: messageId, content: 'A caption', attachments: [{ filename: 'photo.jpg' }] });
    const image = new FakeElement('regular-img', { src: 'blob:opaque' });
    const content = new FakeElement('content', {}, [], 'A caption');
    const accessory = new FakeElement('accessories', {}, [image]);
    const item = row(content, accessory);
    f.reconcileStickerRows(item);
    assert.equal(image.classList.contains('vac34-mf-dom-media-hidden'), true);
    assert.equal(accessory.classList.contains('vac34-mf-dom-media-hidden'), false);
    assert.equal(content.textContent, 'A caption');
});

test('no media records means unrelated iframe and avatar never gain Show', () => {
    const f = fixture();
    const item = row(new FakeElement('content', {}, [new FakeElement('iframe')], 'text'),
        new FakeElement('avatar', {}, [new FakeElement('avatar-img', { src: 'blob:avatar' })]));
    f.reconcileStickerRows(item);
    assert.equal(item.querySelector('.vac34-mf-dom-media-toggle'), null);
});

test('per-server overrides are independent and preserve global defaults', () => {
    const f = fixture();
    f.Settings.current.hideReactions = false;
    f.Settings.current.collapseImages = true;
    f.updateServerFilter('guild-1', 'hideReactions', true);
    f.updateServerFilter('guild-1', 'collapseImages', false);
    assert.equal(f.effectiveSettings().hideReactions, true);
    assert.equal(f.shouldCollapse('media'), false);
    assert.equal(f.shouldCollapse('video'), true);
    f.stores.SelectedGuildStore.getGuildId = () => 'guild-2';
    assert.equal(f.effectiveSettings().hideReactions, false);
    assert.equal(f.shouldCollapse('media'), true);
    f.updateServerFilter('guild-2', 'hideStickers', false);
    assert.equal(f.effectiveSettings().hideStickers, false);
    f.stores.SelectedGuildStore.getGuildId = () => 'guild-1';
    assert.equal(f.effectiveSettings().hideStickers, true);
    f.clearServerFilters('guild-1');
    assert.equal(f.effectiveSettings().hideReactions, false);
    assert.equal(f.Settings.current.serverFilters['guild-2'].hideStickers, false);
});

test('reaction hiding targets message reaction containers only, not inline emoji', () => {
    const f = fixture();
    assert.equal(f.Settings.current.hideReactions, false);
    assert.match(f.css, /data-vac34-mf-reactions/);
    assert.match(f.css, /reactions_/);
    assert.match(f.css, /chat-messages-/);
    assert.doesNotMatch(f.css.split('html[data-vac34-mf-reactions]')[1].split('{')[0], /emoji_/);
});

test('DM profile is independent of guild profiles', () => {
    const f = fixture();
    f.updateServerFilter(null, 'hideReactions', true);
    f.stores.SelectedGuildStore.getGuildId = () => null;
    assert.equal(f.effectiveSettings().hideReactions, true);
    f.stores.SelectedGuildStore.getGuildId = () => 'guild-1';
    assert.equal(f.effectiveSettings().hideReactions, false);
});
