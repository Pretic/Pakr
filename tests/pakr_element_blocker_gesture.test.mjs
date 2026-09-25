import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import vm from "node:vm";

const SCRIPT_PATH = "app/src/main/assets/pakr_element_blocker.js";

class FakeElement {
  constructor(tagName, document) {
    this.tagName = tagName.toUpperCase();
    this.nodeType = 1;
    this.ownerDocument = document;
    this.children = [];
    this.parentElement = null;
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.eventListeners = new Map();
    this.classList = [];
    this.className = "";
    this.id = "";
    this.textContent = "";
    this.innerText = "";
    this.disabled = false;
    this.rect = { left: 0, top: 0, width: 160, height: 220, right: 160, bottom: 220 };
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  remove() {
    if (!this.parentElement) return;
    this.parentElement.children = this.parentElement.children.filter((child) => child !== this);
    this.parentElement = null;
  }

  addEventListener(type, listener) {
    if (!this.eventListeners.has(type)) this.eventListeners.set(type, []);
    this.eventListeners.get(type).push(listener);
  }

  closest(selector) {
    let node = this;
    while (node) {
      for (const part of selector.split(",").map((item) => item.trim())) {
        if (part === "[data-pakr-ui='1']" && node.dataset?.pakrUi === "1") return node;
        if (part === "[data-pakr-image-tap='navigate']" && node.dataset?.pakrImageTap === "navigate") return node;
        if (part === "a[href]" && node.tagName === "A" && node.hasAttribute("href")) return node;
        if (part === "button" && node.tagName === "BUTTON") return node;
        if (part === "[role='button']" && node.getAttribute("role") === "button") return node;
      }
      node = node.parentElement;
    }
    return null;
  }

  getBoundingClientRect() {
    return this.rect;
  }

  getAttribute(name) {
    return this.attributes[name] || "";
  }

  hasAttribute(name) {
    return Object.hasOwn(this.attributes, name);
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "id") this.id = String(value);
    if (name === "href") this.href = String(value);
    if (name === "src") this.src = String(value);
    if (name === "role") this.role = String(value);
    if (name === "data-pakr-image-tap") this.dataset.pakrImageTap = String(value);
  }

  scrollIntoView() {}

  get previousElementSibling() {
    if (!this.parentElement) return null;
    const index = this.parentElement.children.indexOf(this);
    return index > 0 ? this.parentElement.children[index - 1] : null;
  }
}

class FakeDocument {
  constructor() {
    this.listeners = new Map();
    this.documentElement = new FakeElement("html", this);
    this.body = new FakeElement("body", this);
    this.documentElement.appendChild(this.body);
    this.target = new FakeElement("div", this);
    this.target.innerText = "Readable text";
    this.body.appendChild(this.target);
    this.pointStack = null;
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(listener);
  }

  removeEventListener(type, listener) {
    if (!this.listeners.has(type)) return;
    this.listeners.set(type, this.listeners.get(type).filter((item) => item !== listener));
  }

  dispatch(type, event) {
    for (const listener of this.listeners.get(type) || []) {
      listener(event);
      if (event.__immediateStopped) break;
    }
  }

  getElementById(id) {
    return this.walk().find((element) => element.id === id) || null;
  }

  querySelector() {
    return null;
  }

  querySelectorAll(selector) {
    if (selector !== "[data-pakr-ui='1']") return [];
    return this.walk().filter((element) => element.dataset && element.dataset.pakrUi === "1");
  }

  elementFromPoint() {
    return this.pointStack ? this.pointStack[0] : this.target;
  }

  elementsFromPoint() {
    return this.pointStack || [this.target, this.body, this.documentElement];
  }

  walk(root = this.documentElement) {
    return [root, ...root.children.flatMap((child) => this.walk(child))];
  }
}

function createFixture(runScript = true, options = {}) {
  const document = new FakeDocument();
  const timerQueue = new Map();
  const windowListeners = new Map();
  let nextTimerId = 1;
  let savedFavorites = "[]";
  const previewedImages = [];
  const migrationCalls = [];

  const context = {
    document,
    location: {
      hostname: options.hostname || "example.com",
      href: options.href || "https://example.com/page",
      assign(url) { this.href = url; }
    },
    URL,
    innerWidth: 800,
    innerHeight: 600,
    CSS: { escape: (value) => String(value).replace(/[^a-zA-Z0-9_-]/g, "_") },
    getComputedStyle: () => ({ backgroundImage: "none" }),
    setTimeout: (callback, delay = 0) => {
      const id = nextTimerId++;
      timerQueue.set(id, { callback, delay });
      return id;
    },
    clearTimeout: (id) => {
      timerQueue.delete(id);
    },
    addEventListener: (type, listener) => {
      if (!windowListeners.has(type)) windowListeners.set(type, []);
      windowListeners.get(type).push(listener);
    },
    removeEventListener: (type, listener) => {
      if (!windowListeners.has(type)) return;
      windowListeners.set(type, windowListeners.get(type).filter((item) => item !== listener));
    },
    PakrElementBlocker: {
      getRules: () => "[]",
      saveRules: () => {},
      getFavorites: () => savedFavorites,
      saveFavorites: (_token, json) => {
        savedFavorites = json;
        return true;
      },
      getHomeUrl: () => options.homeUrl || "https://example.com/",
      getDefaultHomeUrl: () => "https://example.com/",
      saveHomeUrl: () => true,
      resetHomeUrl: () => true,
      migrateRulesToUrl: (_token, sourceHost, targetUrl) => {
        migrationCalls.push({ sourceHost, targetUrl });
        return options.migratedRules || 0;
      },
      exportJson: () => true,
      getImageTapPreviewEnabled: () => !!options.imageTapPreviewEnabled,
      saveImageTapPreviewEnabled: () => true,
      getFontScale: () => "normal",
      applyFontScale: () => {},
      toast: () => {},
      previewImage: (url) => previewedImages.push(url)
    }
  };
  context.window = context;
  if (runScript) vm.runInNewContext(readFileSync(SCRIPT_PATH, "utf8"), context, { filename: SCRIPT_PATH });

  return {
    context,
    document,
    runTimersThrough(maxDelay) {
      let progressed = true;
      while (progressed) {
        progressed = false;
        for (const [id, timer] of [...timerQueue.entries()].sort((a, b) => a[1].delay - b[1].delay)) {
          if (timer.delay <= maxDelay) {
            timerQueue.delete(id);
            timer.callback();
            progressed = true;
          }
        }
      }
    },
    menuCount() {
      return document.walk().filter((element) => element.className === "pakr-blocker-menu").length;
    },
    menuButtonCount() {
      const menu = document.walk().find((element) => element.className === "pakr-blocker-menu");
      return menu ? menu.children.filter((element) => element.tagName === "BUTTON").length : 0;
    },
    menuButtonLabels() {
      const menu = document.walk().find((element) => element.className === "pakr-blocker-menu");
      return menu ? menu.children.filter((element) => element.tagName === "BUTTON").map((element) => element.textContent) : [];
    },
    clickMenuButton(label) {
      const menu = document.walk().find((element) => element.className === "pakr-blocker-menu");
      const button = menu && menu.children.find((element) => element.tagName === "BUTTON" && element.textContent === label);
      assert.ok(button, `menu button ${label} should exist`);
      for (const listener of button.eventListeners.get("click") || []) {
        listener({ preventDefault() {}, stopPropagation() {} });
      }
    },
    clickMenuButtonThroughDocument(label) {
      const menu = document.walk().find((element) => element.className === "pakr-blocker-menu");
      const button = menu && menu.children.find((element) => element.tagName === "BUTTON" && element.textContent === label);
      assert.ok(button, `menu button ${label} should exist`);
      const event = {
        target: button,
        button: 0,
        detail: 1,
        ctrlKey: false,
        metaKey: false,
        shiftKey: false,
        altKey: false,
        preventDefault() { this.defaultPrevented = true; },
        stopPropagation() { this.propagationStopped = true; },
        stopImmediatePropagation() {
          this.propagationStopped = true;
          this.__immediateStopped = true;
        }
      };
      document.dispatch("click", event);
      if (!event.propagationStopped) {
        for (const listener of button.eventListeners.get("click") || []) listener(event);
      }
      return event;
    },
    savedFavorites() {
      return JSON.parse(savedFavorites);
    },
    previewedImages,
    migrationCalls
  };
}

function touchEvent(target, x, y) {
  return {
    target,
    touches: [{ clientX: x, clientY: y }],
    changedTouches: [{ clientX: x, clientY: y }],
    preventDefault: () => {},
    stopPropagation: () => {}
  };
}

test("touch long press tolerates slight finger drift before opening the menu", () => {
  const fixture = createFixture();
  fixture.document.dispatch("touchstart", touchEvent(fixture.document.target, 100, 140));
  fixture.document.dispatch("touchmove", touchEvent(fixture.document.target, 106, 144));

  fixture.runTimersThrough(650);

  assert.equal(fixture.menuCount(), 1);
});

test("touch long press menu stays open after the synthesized click on release", () => {
  const fixture = createFixture();
  fixture.document.dispatch("touchstart", touchEvent(fixture.document.target, 100, 140));

  fixture.runTimersThrough(650);
  fixture.document.dispatch("touchend", touchEvent(fixture.document.target, 100, 140));
  fixture.document.dispatch("click", touchEvent(fixture.document.target, 100, 140));

  assert.equal(fixture.menuCount(), 1);
});

test("native entry resolves through broad containers to a specific content target", () => {
  const fixture = createFixture();
  const broad = new FakeElement("div", fixture.document);
  broad.className = "broad-container";
  broad.rect = { left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 };
  fixture.document.body.appendChild(broad);
  fixture.document.pointStack = [broad, fixture.document.target, fixture.document.body, fixture.document.documentElement];

  assert.equal(fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180), true);

  assert.equal(fixture.menuButtonCount(), 5);
});

test("native entry can open the menu at WebView coordinates", () => {
  const fixture = createFixture();

  assert.equal(typeof fixture.context.window.PakrElementBlockerUI.openMenuAt, "function");
  assert.equal(fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180), true);

  assert.equal(fixture.menuCount(), 1);
});

test("context menu exposes favorites and a consolidated settings screen", () => {
  const fixture = createFixture();
  fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180);

  assert.ok(fixture.menuButtonLabels().includes("收藏网页"));
  assert.ok(fixture.menuButtonLabels().includes("设置"));
  assert.ok(!fixture.menuButtonLabels().includes("已屏蔽列表"));

  fixture.clickMenuButton("设置");
  const titles = fixture.document.walk()
    .filter((element) => element.className === "pakr-blocker-settings-title")
    .map((element) => element.textContent);
  assert.deepEqual(titles, ["首页网址", "网页收藏", "已屏蔽列表", "网页字号", "图片点击预览"]);
});

test("favorite action persists the current page through the native bridge", () => {
  const fixture = createFixture();
  fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180);
  fixture.clickMenuButton("收藏网页");

  assert.equal(fixture.savedFavorites().length, 1);
  assert.equal(fixture.savedFavorites()[0].url, "https://example.com/page");
});

test("a menu opened over linked text lets its first command run", () => {
  const fixture = createFixture();
  const link = new FakeElement("a", fixture.document);
  link.setAttribute("href", "https://target.example/article");
  const text = new FakeElement("span", fixture.document);
  text.innerText = "linked text";
  link.appendChild(text);
  fixture.document.body.appendChild(link);

  const contextMenuEvent = {
    target: text,
    clientX: 120,
    clientY: 180,
    preventDefault() {},
    stopPropagation() {},
    stopImmediatePropagation() { this.__immediateStopped = true; }
  };
  fixture.document.dispatch("contextmenu", contextMenuEvent);
  fixture.runTimersThrough(0);
  const clickEvent = fixture.clickMenuButtonThroughDocument("设置");

  assert.equal(clickEvent.__immediateStopped, undefined);
  const titles = fixture.document.walk()
    .filter((element) => element.className === "pakr-blocker-settings-title")
    .map((element) => element.textContent);
  assert.ok(titles.includes("首页网址"));
});

test("opt-in image preview intercepts keyboard-style clicks on linked button images", () => {
  const fixture = createFixture(true, { imageTapPreviewEnabled: true });
  const link = new FakeElement("a", fixture.document);
  link.setAttribute("href", "https://target.example/article");
  link.setAttribute("role", "button");
  const image = new FakeElement("img", fixture.document);
  image.setAttribute("src", "https://cdn.example/cover.jpg");
  image.currentSrc = "https://cdn.example/cover.jpg";
  link.appendChild(image);
  fixture.document.body.appendChild(link);

  const clickEvent = {
    target: image,
    button: 0,
    detail: 0,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
    altKey: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    stopImmediatePropagation() { this.__immediateStopped = true; }
  };
  fixture.document.dispatch("click", clickEvent);

  assert.deepEqual(fixture.previewedImages, ["https://cdn.example/cover.jpg"]);
  assert.equal(clickEvent.defaultPrevented, true);
  assert.equal(clickEvent.__immediateStopped, true);
});

test("saving a replacement home URL migrates rules from the previously saved home domain", () => {
  const fixture = createFixture(true, {
    hostname: "article.example",
    href: "https://article.example/story",
    homeUrl: "https://old-home.example/start",
    migratedRules: 2
  });
  fixture.context.window.PakrElementBlockerUI.openMenuAt(120, 180);
  fixture.clickMenuButton("设置");

  const homeItem = fixture.document.walk().find((element) =>
    element.className === "pakr-blocker-settings-item" &&
    element.children.some((child) => child.textContent === "首页网址")
  );
  assert.ok(homeItem);
  for (const listener of homeItem.eventListeners.get("click") || []) listener({});

  const input = fixture.document.walk().find((element) =>
    element.tagName === "INPUT" && element.className === "pakr-blocker-settings-input"
  );
  assert.ok(input);
  input.value = "https://new-home.example/welcome";
  const save = fixture.document.walk().find((element) =>
    element.tagName === "BUTTON" && element.textContent === "保存"
  );
  assert.ok(save);
  for (const listener of save.eventListeners.get("click") || []) listener({});

  assert.deepEqual(fixture.migrationCalls, [{
    sourceHost: "old-home.example",
    targetUrl: "https://new-home.example/welcome"
  }]);
});

test("late native bridge can initialize after an earlier bridge-free attempt", () => {
  const fixture = createFixture(false);
  const bridge = fixture.context.PakrElementBlocker;
  delete fixture.context.PakrElementBlocker;
  const script = readFileSync(SCRIPT_PATH, "utf8");
  vm.runInNewContext(script, fixture.context);
  assert.equal(fixture.context.__pakrElementBlockerReady, undefined);
  fixture.context.PakrElementBlocker = bridge;
  vm.runInNewContext(script, fixture.context);
  assert.equal(fixture.context.__pakrElementBlockerReady, true);
});

test("repeat injection refreshes native rules instead of returning stale state", () => {
  const fixture = createFixture();
  fixture.context.PakrElementBlocker.getRules = () => JSON.stringify([{ selector: ".new-ad" }]);
  vm.runInNewContext(readFileSync(SCRIPT_PATH, "utf8"), fixture.context);
  assert.match(fixture.document.getElementById("pakr-hide-style").textContent, /\.new-ad/);
  assert.equal(fixture.document.listeners.get("contextmenu").length, 1);
});

test("repeat injection repairs a removed hiding style", () => {
  const fixture = createFixture();
  fixture.document.getElementById("pakr-hide-style").remove();
  vm.runInNewContext(readFileSync(SCRIPT_PATH, "utf8"), fixture.context);
  assert.ok(fixture.document.getElementById("pakr-hide-style"));
});

test("corrupt native payload does not erase already loaded rules", () => {
  const fixture = createFixture();
  fixture.context.PakrElementBlocker.getRules = () => JSON.stringify([{ selector: ".saved-ad" }]);
  fixture.context.PakrElementBlockerUI.refresh();
  fixture.context.PakrElementBlocker.getRules = () => '[{"selector":"broken';
  fixture.context.PakrElementBlockerUI.refresh();
  assert.match(fixture.document.getElementById("pakr-hide-style").textContent, /\.saved-ad/);
});
