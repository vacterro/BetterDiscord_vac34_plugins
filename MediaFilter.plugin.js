/**
 * @name MediaFilter
 * @version 1.0.0
 * @author vacterro
 * @description Collapses images, videos and embeds with inline reveal, removes GIFs and stickers, and supports per-server scope.
 * @source https://github.com/vacterro/BetterDiscord_vac34_plugins/blob/main/MediaFilter.plugin.js
 * @website https://github.com/vacterro/BetterDiscord_vac34_plugins
 * @license MIT
 *
 * React-first media filtering for BetterDiscord. Media is handled at Discord's
 * render boundaries so hidden previews do not leave fixed-height empty shells.
 */
/*@cc_on @if (@_jscript)
var pluginName = WScript.ScriptName.split(".")[0];
var shell = WScript.CreateObject("WScript.Shell");
shell.Popup(
    "Do NOT run scripts from the internet with the Windows Script Host!\nMove this file to your BetterDiscord plugins folder.",
    0,
    pluginName + ": Warning!",
    0x1030,
);
var fso = new ActiveXObject("Scripting.FileSystemObject");
var pluginsPath = shell.expandEnvironmentStrings("%appdata%\\BetterDiscord\\plugins");
if (!fso.FolderExists(pluginsPath)) {
    var popup = shell.Popup(
        "Unable to find BetterDiscord on your computer.\nOpen the download page of BetterDiscord?",
        0,
        pluginName + ": BetterDiscord not found",
        0x34,
    );
    if (popup === 6) {
        shell.Exec('explorer "https://betterdiscord.app"');
    }
} else if (WScript.ScriptFullName === pluginsPath + "\\" + WScript.ScriptName) {
    shell.Popup(
        'This plugin is already in the correct folder.\nNavigate to the "Plugins" settings tab in Discord and enable it there.',
        0,
        pluginName,
        0x40,
    );
} else {
    var popup = shell.Popup("Open the BetterDiscord plugins folder?", 0, pluginName, 0x34);
    if (popup === 6) {
        shell.Exec("explorer " + pluginsPath);
    }
}
WScript.Quit();
@else @*/

'use strict';

let meta;
const getMeta = () => {
    if (meta) {
        return meta;
    }
    else {
        throw Error("Accessing meta before initialization");
    }
};
const setMeta = (newMeta) => {
    meta = newMeta;
};

const load = (key) => BdApi.Data.load(getMeta().name, key);
const save = (key, value) => BdApi.Data.save(getMeta().name, key, value);

const checkObjectValues = (target) => target !== window && target instanceof Object && target.constructor?.prototype !== target;
const byEntry = (filter, every = false) => {
    return ((target, ...args) => {
        if (checkObjectValues(target)) {
            const values = Object.values(target);
            return values.length > 0 && values[every ? "every" : "some"]((value) => filter(value, ...args));
        }
        else {
            return false;
        }
    });
};
const byKeys$1 = (...keys) => {
    return (target) => target instanceof Object && keys.every((key) => key in target);
};
const byProtos$1 = (...protos) => {
    return (target) => target instanceof Object
        && target.prototype instanceof Object
        && protos.every((proto) => proto in target.prototype);
};
const bySource$1 = (...fragments) => {
    return (target) => {
        while (target instanceof Object && "$$typeof" in target) {
            target = target.render ?? target.type;
        }
        if (target instanceof Function) {
            const source = target.toString();
            const renderSource = target.prototype?.render?.toString();
            return fragments.every((fragment) => typeof fragment === "string"
                ? source.includes(fragment) || renderSource?.includes(fragment)
                : fragment(source) || (renderSource && fragment(renderSource)));
        }
        else {
            return false;
        }
    };
};

const confirm = (title, content, options = {}) => BdApi.UI.showConfirmationModal(title, content, options);

const find = (filter, { resolve = true, entries = false } = {}) => BdApi.Webpack.getModule(filter, {
    defaultExport: resolve,
    searchExports: entries,
});
const byKeys = (keys, options) => find(byKeys$1(...keys), options);
const byProtos = (protos, options) => find(byProtos$1(...protos), options);
const bySource = (contents, options) => find(bySource$1(...contents), options);
const resolveKey = (target, filter) => [
    target,
    (target ? Object.entries(target).find(([, value]) => filter(value))?.[0] : null),
];
let controller = new AbortController();
const waitFor = (filter, { resolve = true, entries = false } = {}) => BdApi.Webpack.waitForModule(filter, {
    signal: controller.signal,
    defaultExport: resolve,
    searchExports: entries,
});
const waitForChecked = async (filter, options = {}, callback) => {
    const signal = controller.signal;
    const result = await waitFor(filter, options);
    if (!signal.aborted) {
        return callback(result);
    }
};
const abort = () => {
    controller.abort();
    controller = new AbortController();
};

const COLOR = "#3a71c1";
const print = (output, ...data) => output(`%c[${getMeta().name}] %c${getMeta().version ? `(v${getMeta().version})` : ""}`, `color: ${COLOR}; font-weight: 700;`, "color: #666; font-size: .8em;", ...data);
const log = (...data) => print(console.log, ...data);
const warn = (...data) => print(console.warn, ...data);

let manualPatches = [];
const addManual = (cancel, name) => {
    manualPatches.push(cancel);
};
const patch = (type, object, method, callback, options) => {
    const original = object?.[method];
    const name = options.name ?? String(method);
    if (!(original instanceof Function)) {
        if (options.force && !original) {
            warn(`Forcing patch on ${name}`);
            object[method] = function noop() { };
            addManual(() => {
                object[method] = original;
            });
        }
        else {
            throw TypeError(`patch target ${name} is ${original} not function`);
        }
    }
    const cancel = BdApi.Patcher[type](getMeta().name, object, method, options.once
        ? (context, args, result) => {
            const newResult = callback({ cancel, original, context, args, result });
            cancel();
            return newResult;
        }
        : (context, args, result) => callback({ cancel, original, context, args, result }));
    if (!options.silent) {
        log(`Patched ${name}`);
    }
    return cancel;
};
const after = (object, method, callback, options = {}) => patch("after", object, method, callback, options);
const unpatchAll = () => {
    if (manualPatches.length + BdApi.Patcher.getPatchesByCaller(getMeta().name).length > 0) {
        BdApi.Patcher.unpatchAll(getMeta().name);
        for (const cancel of manualPatches) {
            cancel();
        }
        manualPatches = [];
        log("Unpatched all");
    }
};

const inject = (styles) => {
    if (typeof styles === "string") {
        BdApi.DOM.addStyle(getMeta().name, styles);
    }
};
const clear = () => BdApi.DOM.removeStyle(getMeta().name);

const { React } = BdApi;
const classNames = /* @__PURE__ */ find((exports) => exports instanceof Object && exports.default === exports && Object.keys(exports).length === 1);

const Button = /* @__PURE__ */ byKeys(["Colors", "Link"], { entries: true });

const Clickable = /* @__PURE__ */ bySource(["ignoreKeyPress:", "onKeyPress:"], {
    entries: true,
});

const Embed = /* @__PURE__ */ byProtos(["renderSuppressButton"], { entries: true });

const Flex = /* @__PURE__ */ byKeys(["Child", "Justify", "Align"], { entries: true });

const FormItem = /* @__PURE__ */ bySource(["titleClassName:", "required:"], { entries: true });
const FormSwitch = /* @__PURE__ */ bySource(["checked:", "onChange:", "layout:"], {
    entries: true,
});
const FormDivider = /* @__PURE__ */ bySource(["marginTop:", (source) => /{className:.,gap:.}=/.test(source)], {
    entries: true,
});
const FormText = /* @__PURE__ */ bySource(["type:", "style:", "disabled:", "variant:", ".DEFAULT"], {
    entries: true,
});

const IconArrow = /* @__PURE__ */ bySource(['d:"M5.3 9.'], {
    entries: true,
});

const margins = /* @__PURE__ */ byKeys(["marginBottom40", "marginTop4"]);

const MediaItemFilter =  bySource$1("getObscureReason", "isSingleMosaicItem");
const MessageFooterFilter =  byProtos$1("renderRemoveAttachmentConfirmModal");

const TextInput = /* @__PURE__ */ bySource(["placeholder", "maxLength", "clearable"], { entries: true });

const Text = /* @__PURE__ */ bySource(["lineClamp:", "variant:", "tabularNumbers:"], { entries: true });

const EMPTY = Symbol();
const useOnceRef = (init) => {
    const ref = React.useRef(EMPTY);
    if (ref.current === EMPTY) {
        ref.current = init();
    }
    return ref;
};
const FCHook = ({ children: { type, props }, callback }) => {
    const result = type(props);
    return callback(result, props) ?? result;
};
const hookFunctionComponent = (target, callback) => {
    const props = {
        children: { ...target },
        callback,
    };
    target.props = props;
    target.type = FCHook;
    return target;
};
const queryTreeAll = (node, predicate) => {
    const result = [];
    const worklist = [node].flat();
    while (worklist.length !== 0) {
        const node = worklist.shift();
        if (React.isValidElement(node)) {
            if (predicate(node)) {
                result.push(node);
            }
            const children = node?.props?.children;
            if (children) {
                worklist.push(...[children].flat());
            }
        }
    }
    return result;
};

const SettingsContainer = ({ name, children, onReset }) => (React.createElement("div", null,
    children,
    onReset ? (React.createElement(React.Fragment, null,
        React.createElement(FormDivider, { gap: 20 }),
        React.createElement(Flex, { justify: Flex.Justify.END },
            React.createElement(Button, { size: Button.Sizes.SMALL, onClick: () => confirm(name, "Reset all settings?", {
                    onConfirm: onReset,
                }) }, "Reset")))) : null));

class SettingsStore {
    defaults;
    current;
    onLoad;
    listeners = new Set();
    constructor(defaults, onLoad) {
        this.defaults = defaults;
        this.current = { ...defaults };
        this.onLoad = onLoad;
    }
    load() {
        this.current = { ...this.defaults, ...load("settings") };
        this.onLoad?.();
        this._dispatch(false);
    }
    _dispatch(save$1) {
        for (const listener of this.listeners) {
            listener(this.current);
        }
        if (save$1) {
            save("settings", this.current);
        }
    }
    getCurrent = () => this.current;
    update = (settings) => {
        const update = typeof settings === "function" ? settings(this.current) : settings;
        this.current = { ...this.current, ...update };
        this._dispatch(true);
    };
    reset() {
        this.current = { ...this.defaults };
        this._dispatch(true);
    }
    delete(...keys) {
        this.current = { ...this.current };
        for (const key of keys) {
            delete this.current[key];
        }
        this._dispatch(true);
    }
    useCurrent() {
        return React.useSyncExternalStore(this.addListenerEffect, this.getCurrent);
    }
    useSelector(selector, deps, compare = Object.is) {
        const state = useOnceRef(() => selector(this.current));
        const snapshot = React.useCallback(() => {
            const next = selector(this.current);
            if (!compare(state.current, next)) {
                state.current = next;
            }
            return state.current;
        }, deps ?? [selector]);
        return React.useSyncExternalStore(this.addListenerEffect, snapshot);
    }
    useState() {
        const current = this.useCurrent();
        return [current, this.update];
    }
    useStateWithDefaults() {
        const current = this.useCurrent();
        return [current, this.defaults, this.update];
    }
    useListener(listener, deps) {
        React.useEffect(() => this.addListenerEffect(listener), deps ?? [listener]);
    }
    addListener(listener) {
        this.listeners.add(listener);
        return listener;
    }
    addListenerEffect = (listener) => {
        this.addListener(listener);
        return () => this.removeListener(listener);
    };
    removeListener(listener) {
        this.listeners.delete(listener);
    }
    removeAllListeners() {
        this.listeners.clear();
    }
    addReactChangeListener = this.addListener;
    removeReactChangeListener = this.removeListener;
}
const createSettings = (defaults, onLoad) => new SettingsStore(defaults, onLoad);

const createPlugin = (plugin) => (meta) => {
    setMeta(meta);
    const { start, stop, styles, Settings, SettingsPanel } = plugin instanceof Function ? plugin(meta) : plugin;
    Settings?.load();
    return {
        start() {
            log("Enabled");
            inject(styles);
            start?.();
        },
        stop() {
            abort();
            unpatchAll();
            clear();
            stop?.();
            log("Disabled");
        },
        getSettingsPanel: SettingsPanel
            ? () => (React.createElement(SettingsContainer, { name: meta.name, onReset: Settings ? () => Settings.reset() : undefined },
                React.createElement(SettingsPanel, null)))
            : undefined,
    };
};


const Settings = createSettings({
    scopeMode: "all",
    selectedGuilds: [],
    enableDMs: true,
    collapseMedia: true,
    hideGifs: true,
    hideStickers: true,
    hideEmbedLinks: true,
});

function selectedGuildId() {
    try { return BdApi.Webpack.Stores?.SelectedGuildStore?.getGuildId?.() ?? null; }
    catch { return null; }
}

function scopeEnabled(settings = Settings.current) {
    const guildId = selectedGuildId();
    if (!guildId) return settings.enableDMs !== false;
    const selected = Array.isArray(settings.selectedGuilds) ? settings.selectedGuilds : [];
    if (settings.scopeMode === "only") return selected.includes(guildId);
    if (settings.scopeMode === "except") return !selected.includes(guildId);
    return true;
}

function getGuilds() {
    try {
        return Object.values(BdApi.Webpack.Stores?.GuildStore?.getGuilds?.() ?? {})
            .filter(Boolean)
            .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
    }
    catch { return []; }
}

function str(value) { return typeof value === "string" ? value : ""; }

function isGifAttachment(attachment) {
    if (!attachment) return false;
    const type = str(attachment.contentType || attachment.content_type).toLowerCase();
    const name = str(attachment.filename).toLowerCase();
    const values = [
        attachment.url, attachment.proxy_url, attachment.proxyURL,
        attachment.originalUrl, attachment.original_url
    ].map(str).join(" ").toLowerCase();
    return type === "image/gif"
        || name.endsWith(".gif")
        || /\.gif(?:[?#]|$)/i.test(values)
        || /[?&]animated=true/i.test(values)
        || /[?&]originalUrl=[^&]*\.gif/i.test(values);
}

function isGifEmbed(embed) {
    if (!embed) return false;
    const type = String(embed.type || "").toLowerCase();
    if (type === "gifv" || type === "gif") return true;
    const values = [
        embed.url, embed.video?.url, embed.video?.proxyURL, embed.video?.proxy_url,
        embed.image?.url, embed.image?.proxyURL, embed.image?.proxy_url, embed.thumbnail?.url
    ].map(str).join(" ").toLowerCase();
    if (/\.gif(?:[?#]|$)/i.test(values) || /[?&]animated=true/i.test(values) || /[?&]originalUrl=[^&]*\.gif/i.test(values)) return true;
    return /(?:tenor\.com\/(?:view|search)|giphy\.com\/(?:gifs|clips)\/|klipy\.com\/gifs?\/)/i.test(values);
}

function normalizeEmbedUrl(value) {
    if (typeof value !== "string" || !value) return "";
    try {
        const url = new URL(value);
        const host = url.hostname.toLowerCase().replace(/^www\./, "");
        if (host === "youtu.be") {
            const id = url.pathname.split("/").filter(Boolean)[0] || "";
            return id ? "https://youtube.com/watch?v=" + id : value;
        }
        if ((host === "youtube.com" || host === "m.youtube.com") && url.pathname.startsWith("/shorts/")) {
            const id = url.pathname.split("/").filter(Boolean)[1] || "";
            return id ? "https://youtube.com/watch?v=" + id : value;
        }
        if (host === "x.com") {
            url.hostname = "twitter.com";
            return url.toString().replace(/\/$/, "");
        }
        url.hash = "";
        return url.toString().replace(/\/$/, "");
    }
    catch { return value; }
}

function linkMatchesEmbed(href, embeds) {
    if (typeof href !== "string" || !Array.isArray(embeds) || embeds.length === 0) return false;
    const candidate = normalizeEmbedUrl(href);
    for (const embed of embeds) {
        if (typeof embed?.url !== "string") continue;
        const target = normalizeEmbedUrl(embed.url);
        if (candidate === target || target.startsWith(candidate) || candidate.startsWith(target)) return true;
    }
    return false;
}

const STICKER_ROW_CLASS = "vac34-mf-sticker-empty-row";
const stickerOnlyIds = new Set();
let stickerObserver = null;

function stickerIdsFromMessage(message) {
    const items = Array.isArray(message?.stickerItems) ? message.stickerItems : [];
    return new Set(items.map((item) => String(item?.id || "")).filter(Boolean));
}

function messageHasNonStickerPayload(message) {
    if (!message || typeof message !== "object") return false;
    if (String(message.content || "").trim()) return true;
    for (const key of ["attachments", "embeds", "components", "giftCodes", "soundboardSounds"]) {
        if (Array.isArray(message[key]) && message[key].length > 0) return true;
    }
    if (message.poll || message.messageReference) return true;
    return Array.isArray(message.messageSnapshots) && message.messageSnapshots.length > 0;
}

function messageWithoutStickers(message) {
    if (!message || typeof message !== "object") return message;
    const hasItems = Array.isArray(message.stickerItems) && message.stickerItems.length > 0;
    const hasLegacy = Array.isArray(message.stickers) && message.stickers.length > 0;
    if (!hasItems && !hasLegacy) return message;

    let clone;
    try {
        const proto = Object.getPrototypeOf(message) || Object.prototype;
        clone = Object.create(proto);
        const descriptors = Object.getOwnPropertyDescriptors(message);
        delete descriptors.stickerItems;
        delete descriptors.stickers;
        Object.defineProperties(clone, descriptors);
    }
    catch { clone = Object.assign({}, message); }

    try { Object.defineProperty(clone, "stickerItems", { value: [], enumerable: true, configurable: true, writable: true }); }
    catch { clone.stickerItems = []; }
    try { Object.defineProperty(clone, "stickers", { value: [], enumerable: true, configurable: true, writable: true }); }
    catch { clone.stickers = []; }
    return clone;
}

function stringMentionsSticker(value, ids) {
    if (value == null) return false;
    const text = String(value);
    if (!/\/stickers\/\d+/i.test(text)) return false;
    if (!ids || ids.size === 0) return true;
    for (const id of ids) if (text.includes("/stickers/" + id)) return true;
    return false;
}

function objectStickerId(value, ids) {
    if (!value || typeof value !== "object") return false;
    const id = value.id != null ? String(value.id) : "";
    return Boolean(id && (!ids || ids.size === 0 || ids.has(id)));
}

function reactNodeIsSticker(node, ids) {
    if (!node || typeof node !== "object") return false;
    const props = node.props || {};
    if (objectStickerId(props.sticker, ids) || objectStickerId(props.stickerItem, ids)) return true;
    if (props.stickerId != null && (!ids || ids.size === 0 || ids.has(String(props.stickerId)))) return true;
    if (Array.isArray(props.stickerItems) && props.stickerItems.some((item) => objectStickerId(item, ids))) return true;
    if (Array.isArray(props.stickers) && props.stickers.some((item) => objectStickerId(item, ids))) return true;
    for (const key of ["src", "href", "url", "poster"]) if (stringMentionsSticker(props[key], ids)) return true;
    if (props["data-sticker-id"] != null) {
        const id = String(props["data-sticker-id"]);
        return !ids || ids.size === 0 || ids.has(id);
    }
    return false;
}

function pruneStickerReactTree(node, ids) {
    if (node == null || typeof node === "boolean") return node;
    if (Array.isArray(node)) {
        let changed = false;
        const out = [];
        for (const child of node) {
            const next = pruneStickerReactTree(child, ids);
            if (next !== child) changed = true;
            if (next !== null && next !== undefined && next !== false) out.push(next);
        }
        return changed ? out : node;
    }
    if (!React?.isValidElement?.(node)) return node;
    if (reactNodeIsSticker(node, ids)) return null;
    const children = node.props?.children;
    if (children == null) return node;
    const nextChildren = pruneStickerReactTree(children, ids);
    if (nextChildren === children) return node;
    try { return React.cloneElement(node, undefined, nextChildren); }
    catch { return node; }
}

function findMessageAccessoriesModule() {
    try {
        return BdApi.Webpack.getModule(
            (mod) => mod?.prototype?.constructor && String(mod.prototype.constructor).includes("attachmentToDelete"),
            { searchExports: true },
        );
    }
    catch { return null; }
}

function rowMessageId(row) {
    if (!row?.getAttribute) return "";
    for (const value of [row.id, row.getAttribute("data-list-item-id")]) {
        const match = String(value || "").match(/(\d{15,})$/);
        if (match) return match[1];
    }
    return "";
}

function reconcileStickerRows(root = document) {
    if (!root?.querySelectorAll) return;
    const enabled = Settings.current.hideStickers !== false && scopeEnabled();
    const selector = 'li[id^="chat-messages-"], [data-list-item-id^="chat-messages"]';
    const rows = [];
    if (root.matches?.(selector)) rows.push(root);
    for (const row of root.querySelectorAll(selector)) rows.push(row);
    for (const row of rows) {
        const id = rowMessageId(row);
        row.classList.toggle(STICKER_ROW_CLASS, Boolean(enabled && id && stickerOnlyIds.has(id)));
    }
}

function startStickerObserver() {
    if (stickerObserver) return;
    const host = document.getElementById("app-mount") || document.body;
    if (!host) return;
    stickerObserver = new MutationObserver((records) => {
        for (const record of records) {
            for (const node of record.addedNodes || []) if (node?.nodeType === 1) reconcileStickerRows(node);
        }
    });
    stickerObserver.observe(host, { childList: true, subtree: true });
    reconcileStickerRows(document);
}

function stopStickerObserver() {
    stickerObserver?.disconnect?.();
    stickerObserver = null;
    stickerOnlyIds.clear();
    document.querySelectorAll("." + STICKER_ROW_CLASS).forEach((row) => row.classList.remove(STICKER_ROW_CLASS));
}

function syncGlobalFlags() {
    const root = document.documentElement;
    if (!root) return;
    root.toggleAttribute("data-vac34-mf-gifs", Settings.current.hideGifs !== false);
    root.toggleAttribute("data-vac34-mf-stickers", Settings.current.hideStickers !== false);
    reconcileStickerRows(document);
}

const MediaShell = ({ children, kind }) => {
    const settings = Settings.useCurrent();
    const [shown, setShown] = React.useState(false);
    if (!scopeEnabled(settings) || settings.collapseMedia === false) return children;

    return React.createElement(
        "div",
        {
            className: "vac34-mf-shell vac34-mf-" + kind + " " + (shown ? "vac34-mf-shown" : "vac34-mf-hidden"),
            "data-vac34-plugin-ui": "media-filter",
        },
        shown ? children : null,
        React.createElement(
            "button",
            {
                type: "button",
                className: "vac34-mf-toggle",
                title: shown ? "Hide media" : "Show media",
                "aria-expanded": shown ? "true" : "false",
                onClick: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setShown((value) => !value);
                },
            },
            shown ? "Hide" : "Show",
        ),
    );
};

function SettingsPanel() {
    const [settings, setSettings] = Settings.useState();
    const guilds = getGuilds();
    const selected = new Set(Array.isArray(settings.selectedGuilds) ? settings.selectedGuilds : []);
    const row = (child) => React.createElement("div", { style: { marginBottom: "12px" } }, child);
    const checkbox = (label, checked, onChange) => React.createElement(
        "label",
        { style: { display: "flex", gap: "8px", alignItems: "center", margin: "6px 0" } },
        React.createElement("input", { type: "checkbox", checked, onChange: (e) => onChange(e.target.checked) }),
        React.createElement("span", null, label),
    );

    return React.createElement(
        "div",
        null,
        row(React.createElement("div", null,
            React.createElement("div", { style: { fontWeight: 700, marginBottom: "6px" } }, "Scope"),
            React.createElement("select", {
                value: settings.scopeMode,
                onChange: (e) => setSettings({ scopeMode: e.target.value }),
                style: { width: "100%", padding: "6px" },
            },
                React.createElement("option", { value: "all" }, "All servers"),
                React.createElement("option", { value: "only" }, "Only selected servers"),
                React.createElement("option", { value: "except" }, "All except selected servers"),
            ),
        )),
        row(checkbox("Enable in DMs", settings.enableDMs !== false, (value) => setSettings({ enableDMs: value }))),
        row(checkbox("Collapse images, videos and embeds with Show/Hide", settings.collapseMedia !== false, (value) => setSettings({ collapseMedia: value }))),
        row(checkbox("Remove GIFs", settings.hideGifs !== false, (value) => setSettings({ hideGifs: value }))),
        row(checkbox("Remove stickers", settings.hideStickers !== false, (value) => setSettings({ hideStickers: value }))),
        row(checkbox("Hide source URL when Discord already rendered an embed", settings.hideEmbedLinks !== false, (value) => setSettings({ hideEmbedLinks: value }))),
        React.createElement("div", { style: { fontWeight: 700, margin: "14px 0 6px" } }, "Servers"),
        guilds.length
            ? guilds.map((guild) => checkbox(guild.name || guild.id, selected.has(guild.id), (checked) => {
                const next = new Set(Array.isArray(Settings.current.selectedGuilds) ? Settings.current.selectedGuilds : []);
                if (checked) next.add(guild.id); else next.delete(guild.id);
                setSettings({ selectedGuilds: Array.from(next) });
            }))
            : React.createElement("div", { style: { color: "var(--text-muted)" } }, "No guild list available from Discord's GuildStore."),
        React.createElement("div", { style: { marginTop: "14px", color: "var(--text-muted)", fontSize: "12px" } },
            "Images, videos and embeds collapse to Show. GIFs and stickers are removed before layout. Reveal state is session-only."),
    );
}

const css = `
.vac34-mf-shell { min-width: 0; max-width: 100%; }
.vac34-mf-hidden {
    display: flex !important; align-items: center !important; width: max-content !important;
    min-width: 0 !important; min-height: 0 !important; height: auto !important;
    margin: 1px 0 !important; padding: 0 !important;
}
.vac34-mf-shown { position: relative; display: block; width: fit-content; max-width: 100%; }
.vac34-mf-toggle {
    font: inherit; font-size: 11px; line-height: 16px; min-height: 18px; padding: 0 6px; margin: 0;
    border: 1px solid var(--background-modifier-accent, #555); border-radius: 2px;
    color: var(--text-normal, #ddd); background: var(--background-secondary, #222); cursor: pointer;
}
.vac34-mf-toggle:hover { background: var(--background-modifier-hover, #333); }
.vac34-mf-toggle:focus-visible { outline: 2px solid var(--brand-500, #5865f2); outline-offset: 1px; }
.vac34-mf-shown > .vac34-mf-toggle { position: absolute; z-index: 4; top: 4px; right: 4px; opacity: .78; }
.vac34-mf-shown > .vac34-mf-toggle:hover { opacity: 1; }
.vac34-mf-hide-embed-link { display: none !important; }
.${STICKER_ROW_CLASS} { display: none !important; }
html[data-vac34-mf-gifs] button[aria-label="gif" i],
html[data-vac34-mf-gifs] button[aria-label*="gif picker" i],
html[data-vac34-mf-gifs] button[aria-label*="гиф" i],
html[data-vac34-mf-gifs] [role="tab"][aria-controls*="gif" i],
html[data-vac34-mf-gifs] [id$="-gif-picker-tab"],
html[data-vac34-mf-gifs] [aria-controls$="gif-picker"] { display: none !important; }
html[data-vac34-mf-stickers] button[aria-label*="sticker" i],
html[data-vac34-mf-stickers] button[aria-label*="стикер" i],
html[data-vac34-mf-stickers] [role="tab"][aria-controls*="sticker" i],
html[data-vac34-mf-stickers] [aria-controls$="sticker-picker"],
html[data-vac34-mf-stickers] [id$="-sticker-picker"] { display: none !important; }
`;

const index = createPlugin({
    start() {
        syncGlobalFlags();
        Settings.addListener(syncGlobalFlags);
        startStickerObserver();

        const MessageAccessories = findMessageAccessoriesModule();
        if (MessageAccessories?.prototype?.render) {
            BdApi.Patcher.instead(getMeta().name, MessageAccessories.prototype, "render", (instance, args, original) => {
                if (!scopeEnabled() || Settings.current.hideStickers === false) return original.apply(instance, args);
                const originalProps = instance?.props;
                const message = originalProps?.message;
                const ids = stickerIdsFromMessage(message);
                if (ids.size === 0) return original.apply(instance, args);

                const id = message?.id != null ? String(message.id) : "";
                if (id) {
                    if (messageHasNonStickerPayload(message)) stickerOnlyIds.delete(id);
                    else stickerOnlyIds.add(id);
                }

                try {
                    instance.props = Object.assign({}, originalProps, { message: messageWithoutStickers(message) });
                    const result = original.apply(instance, args);
                    queueMicrotask(() => reconcileStickerRows(document));
                    return result;
                }
                catch (error) {
                    warn("Sticker pre-render suppression degraded: " + (error?.message || error));
                    let result;
                    try { result = original.apply(instance, args); } catch { return null; }
                    return pruneStickerReactTree(result, ids);
                }
                finally {
                    if (instance) instance.props = originalProps;
                }
            });
        }
        else {
            warn("Message accessories renderer not found; sticker suppression is degraded");
        }

        if (Embed?.prototype?.render) {
            after(Embed.prototype, "render", ({ result, context }) => {
                const embed = context?.props?.embed;
                if (!result || !scopeEnabled()) return result;
                if (Settings.current.hideGifs !== false && isGifEmbed(embed)) return null;
                if (Settings.current.collapseMedia === false) return result;
                return React.createElement(MediaShell, { kind: "embed" }, result);
            }, { name: "Embed render" });
        }
        else {
            warn("Embed renderer not found");
        }

        waitForChecked(byEntry(MediaItemFilter), {}, (mediaModule) => {
            const MediaItem = resolveKey(mediaModule, MediaItemFilter);
            if (!MediaItem?.[0] || !MediaItem?.[1]) return;
            after(...MediaItem, ({ args: [props], result }) => {
                const attachment = props?.item?.originalItem;
                if (!result || !scopeEnabled()) return result;
                if (Settings.current.hideGifs !== false && isGifAttachment(attachment)) return null;
                if (Settings.current.collapseMedia === false) return result;
                return React.createElement(MediaShell, { kind: props?.isSingleMosaicItem ? "media-single" : "media" }, result);
            }, { name: "MediaItem render" });
        });

        waitForChecked(MessageFooterFilter, { entries: true }, (MessageFooter) => {
            if (!MessageFooter?.prototype?.renderAttachments) return;
            after(MessageFooter.prototype, "renderAttachments", ({ result }) => {
                for (const element of queryTreeAll(result, (node) => node?.props?.attachments)) {
                    hookFunctionComponent(element, (childResult, props) => {
                        const attachments = props?.attachments ?? [];
                        if (!childResult || attachments.length === 0 || !scopeEnabled()) return childResult;
                        if (Settings.current.hideGifs !== false && attachments.every((entry) => isGifAttachment(entry?.attachment))) return null;
                        if (Settings.current.collapseMedia === false) return childResult;
                        return React.createElement(MediaShell, { kind: "attachment" }, childResult);
                    });
                }
            }, { name: "MessageFooter renderAttachments" });
        });

        const MessageContentModule = BdApi.Webpack.getModule(
            (m) => m?.type != null && Object.keys(m).some((key) => m[key]?.toString?.().includes("contentRef")),
        );
        if (MessageContentModule?.type) {
            after(MessageContentModule, "type", ({ args: [props], result }) => {
                if (!scopeEnabled() || Settings.current.hideEmbedLinks === false) return result;
                const embeds = props?.message?.embeds;
                if (!Array.isArray(embeds) || embeds.length === 0 || !result?.props?.children) return result;
                const arrays = [result.props.children].flat().filter(Array.isArray);
                for (const list of arrays) {
                    for (const node of list) {
                        const href = node?.props?.href;
                        if (node?.props && linkMatchesEmbed(href, embeds)) {
                            node.props.className = (String(node.props.className || "") + " vac34-mf-hide-embed-link").trim();
                        }
                    }
                }
                return result;
            }, { name: "MessageContent embed links" });
        }
    },
    stop() {
        Settings.removeListener(syncGlobalFlags);
        stopStickerObserver();
        document.documentElement?.removeAttribute("data-vac34-mf-gifs");
        document.documentElement?.removeAttribute("data-vac34-mf-stickers");
    },
    styles: css,
    Settings,
    SettingsPanel,
});

module.exports = index;

/*@end @*/
