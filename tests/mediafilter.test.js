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
        this.attrs = { ...attrs };
        this.id = attrs.id || '';
        this.children = children;
        this.textContent = text;
        this.isConnected = true;
        const classes = new Set((attrs.class || '').split(' ').filter(Boolean));
        this.classList = {
            add: (value) => classes.add(value),
            remove: (value) => classes.delete(value),
            contains: (value) => classes.has(value),
            toggle: (value, force) => {
                if (force ?? !classes.has(value)) classes.add(value);
                else classes.delete(value);
            },
        };
        for (const child of children) child.parentElement = this;
    }
    getAttribute(name) { return this.attrs[name] ?? null; }
    matches(selector) {
        if (selector.includes('chat-messages-') && this.kind === 'row') return true;
        if (selector.includes('stickerNode') && this.kind === 'sticker') return true;
        return false;
    }
    contains(el) { return this === el || this.children.some((child) => child.contains(el)); }
    closest(selector) {
        if (selector.includes('chat-messages-')) {
            for (let node = this; node; node = node.parentElement) if (node.kind === 'row') return node;
        }
        if (selector.includes('avatar') || selector.includes('repliedMessage')) return null;
        if (selector.includes('embedWrapper') || selector.includes('visualMediaItem')) {
            for (let node = this; node; node = node.parentElement) if (node.kind === 'gif-wrapper') return node;
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
        if (selector.includes('img[src]') || selector.includes('video[src]')) {
            return all.filter((el) => el.kind === 'gif-img' || el.kind === 'regular-img');
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
        BdApi: api, module: { exports: {} }, console, URL, window: {}, document: {},
        AbortController, queueMicrotask,
    });
    const exposed = vm.runInContext(source + '\n({ Settings, isGifAttachment, isGifEmbed, isGifMediaElement, gifOnlyMessage, reconcileStickerRows, messageForRow });', context);
    return { ...exposed, messages };
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
