(function () {
  if (window.__pakrElementBlockerReady) return;
  window.__pakrElementBlockerReady = true;

  var bridge = window.PakrElementBlocker;
  if (!bridge) return;

  var host = location.hostname || "local";
  var rules = [];
  var lastTarget = null;
  var touchTimer = null;
  var touchStartX = 0;
  var touchStartY = 0;
  var touchStartTarget = null;
  var pointerTimer = null;
  var pointerStartX = 0;
  var pointerStartY = 0;
  var pointerStartTarget = null;
  var pointerId = null;
  var suppressNextCloseClick = false;
  var highlightTimer = null;
  var picker = null;
  var styleId = "pakr-hide-style";
  var fontStyleId = "pakr-font-style";
  var uiStyleId = "pakr-blocker-ui-style";
  var uiPrefix = "pakr-blocker-";
  var fontScale = "normal";
  var longPressDelay = 650;
  var longPressMoveTolerance = 12;
  var blockedRootIds = {
    app: true,
    root: true,
    "__next": true,
    "__nuxt": true,
    main: true
  };

  function cssEscape(value) {
    if (window.CSS && CSS.escape) return CSS.escape(value);
    return String(value).replace(/[^a-zA-Z0-9_-]/g, function (ch) {
      return "\\" + ch.charCodeAt(0).toString(16) + " ";
    });
  }

  function attrEscape(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  function loadRules() {
    try {
      var raw = bridge.getRules(host) || "[]";
      var parsed = JSON.parse(raw);
      rules = Array.isArray(parsed) ? parsed.filter(function (item) {
        return item && item.selector;
      }) : [];
    } catch (_) {
      rules = [];
    }
  }

  function saveRules() {
    bridge.saveRules(host, JSON.stringify(rules.slice(0, 200)));
  }

  function normalizeFontScale(value) {
    return value === "small" || value === "large" ? value : "normal";
  }

  function loadFontScale() {
    try {
      fontScale = normalizeFontScale(bridge.getFontScale(host) || "normal");
    } catch (_) {
      try {
        fontScale = normalizeFontScale(localStorage.getItem("pakr_font_scale_" + host) || "normal");
      } catch (_) {
        fontScale = "normal";
      }
    }
  }

  function saveFontScale() {
    try {
      bridge.saveFontScale(host, fontScale);
    } catch (_) {
      try { localStorage.setItem("pakr_font_scale_" + host, fontScale); } catch (_) {}
    }
  }

  function applyNativeFontScale() {
    try {
      if (bridge.applyFontScale) {
        bridge.applyFontScale(host, fontScale);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function applyFontScale() {
    var handledByNative = applyNativeFontScale();
    var style = document.getElementById(fontStyleId);
    if (handledByNative) {
      if (style) style.remove();
      return;
    }
    if (fontScale === "normal") {
      if (style) style.remove();
      return;
    }
    if (!style) {
      style = document.createElement("style");
      style.id = fontStyleId;
      document.documentElement.appendChild(style);
    }
    var ratio = fontScale === "large" ? "112%" : "94%";
    style.textContent =
      "html{font-size:" + ratio + "!important;-webkit-text-size-adjust:" + ratio + "!important;text-size-adjust:" + ratio + "!important;}" +
      "body{font-size:" + ratio + "!important;line-height:1.68!important;}" +
      "p,article,main,section,li,blockquote{line-height:1.68!important;}" +
      "img,video{max-width:100%!important;height:auto!important;}";
  }

  function setFontScale(scale) {
    fontScale = normalizeFontScale(scale);
    saveFontScale();
    applyFontScale();
    removeUi();
    showToast(fontScale === "large" ? "字号已放大" : fontScale === "small" ? "字号已缩小" : "字号已恢复默认");
  }

  function safeSelector(selector) {
    try {
      document.querySelector(selector);
      return selector;
    } catch (_) {
      return "";
    }
  }

  function applyRules() {
    var style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      document.documentElement.appendChild(style);
    }
    style.textContent = rules.map(function (rule) {
      var selector = safeSelector(rule.selector);
      return selector ? selector + "{display:none!important;visibility:hidden!important;}" : "";
    }).filter(Boolean).join("\n");
  }

  function isUiElement(el) {
    return !!(el && el.closest && el.closest("[data-pakr-ui='1']"));
  }

  function removeUi() {
    document.querySelectorAll("[data-pakr-ui='1']").forEach(function (el) {
      el.remove();
    });
  }

  function showToast(message) {
    try { bridge.toast(message); } catch (_) {}
  }

  function cleanClasses(el) {
    return Array.prototype.slice.call(el.classList || []).filter(function (name) {
      return /^[a-zA-Z0-9_-]{2,}$/.test(name) && name.indexOf(uiPrefix) !== 0;
    }).slice(0, 3);
  }

  function nthOfType(el) {
    var index = 1;
    var node = el;
    while ((node = node.previousElementSibling)) {
      if (node.tagName === el.tagName) index += 1;
    }
    return index;
  }

  function normalizeElement(el) {
    if (!el || isUiElement(el)) return null;
    if (el.nodeType !== 1) el = el.parentElement;
    if (!el || !el.tagName || isUiElement(el)) return null;
    return el;
  }

  function isNeverBlockable(el) {
    var tag = el && el.tagName ? el.tagName.toLowerCase() : "";
    return !tag || tag === "html" || tag === "body" || tag === "head" ||
      tag === "script" || tag === "style" || tag === "link" || tag === "meta";
  }

  function selectorFor(el) {
    el = normalizeElement(el);
    if (!el || isNeverBlockable(el)) return "";
    var tag = el.tagName.toLowerCase();

    if (el.id && /^[a-zA-Z][\w:-]*$/.test(el.id)) {
      return "#" + cssEscape(el.id);
    }

    if (tag === "img" && el.getAttribute("src")) {
      var src = el.getAttribute("src").split("?")[0];
      if (src.length > 12 && src.length < 180) {
        return 'img[src="' + attrEscape(src) + '"]';
      }
    }

    var classes = cleanClasses(el);
    if (classes.length) {
      var byClass = tag + "." + classes.map(cssEscape).join(".");
      try {
        if (document.querySelectorAll(byClass).length <= 5) return byClass;
      } catch (_) {}
    }

    var parts = [];
    var cur = el;
    while (cur && cur.nodeType === 1 && cur.tagName) {
      var curTag = cur.tagName.toLowerCase();
      if (curTag === "html" || curTag === "body") break;
      var curClasses = cleanClasses(cur);
      var part = curTag;
      if (cur.id && /^[a-zA-Z][\w:-]*$/.test(cur.id)) {
        part = "#" + cssEscape(cur.id);
        parts.unshift(part);
        break;
      }
      if (curClasses.length) part += "." + curClasses.map(cssEscape).join(".");
      part += ":nth-of-type(" + nthOfType(cur) + ")";
      parts.unshift(part);
      if (parts.length >= 4) break;
      cur = cur.parentElement;
    }
    return parts.join(" > ");
  }

  function labelFor(el) {
    if (!el || !el.tagName) return "未知元素";
    var text = (el.innerText || el.alt || el.title || "").replace(/\s+/g, " ").trim();
    if (text.length > 40) text = text.slice(0, 40) + "...";
    return el.tagName.toLowerCase() + (text ? " · " + text : "");
  }

  function cleanCopyText(value) {
    var text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > 1000 ? text.slice(0, 1000) : text;
  }

  function selectedCopyText() {
    try {
      return cleanCopyText(window.getSelection && window.getSelection().toString());
    } catch (_) {
      return "";
    }
  }

  function copyableTextFor(el) {
    var selected = selectedCopyText();
    if (selected) return selected;
    el = normalizeElement(el);
    if (!el) return "";
    var tag = el.tagName.toLowerCase();
    if (tag === "input" || tag === "textarea") {
      return cleanCopyText(el.value || el.getAttribute("value") || "");
    }
    return cleanCopyText(el.innerText || el.textContent || el.alt || el.title || "");
  }

  function copyableLinkFor(el) {
    el = normalizeElement(el);
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if ((tag === "a" || tag === "area") && el.href) return el.href;
      el = el.parentElement;
    }
    return "";
  }

  function absoluteUrlFor(value) {
    value = String(value || "").trim();
    if (!value || value === "#") return "";
    try {
      return new URL(value, location.href).href;
    } catch (_) {
      return "";
    }
  }

  function backgroundImageUrlFor(el) {
    try {
      var bg = getComputedStyle(el).backgroundImage || "";
      var match = bg.match(/^url\((["']?)(.+?)\1\)$/);
      return match ? absoluteUrlFor(match[2]) : "";
    } catch (_) {
      return "";
    }
  }

  function imagePreviewFor(el) {
    el = normalizeElement(el);
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      var tag = el.tagName ? el.tagName.toLowerCase() : "";
      if (tag === "img" || tag === "image") {
        return absoluteUrlFor(el.currentSrc || el.src || el.getAttribute("src") || el.getAttribute("href") || el.getAttribute("xlink:href"));
      }
      var backgroundUrl = backgroundImageUrlFor(el);
      if (backgroundUrl) return backgroundUrl;
      el = el.parentElement;
    }
    return "";
  }

  function elementAreaRatio(el) {
    var rect = el.getBoundingClientRect();
    var width = Math.max(0, Math.min(rect.right, innerWidth) - Math.max(rect.left, 0));
    var height = Math.max(0, Math.min(rect.bottom, innerHeight) - Math.max(rect.top, 0));
    var viewport = Math.max(1, innerWidth * innerHeight);
    return width * height / viewport;
  }

  function riskReason(el, selector) {
    if (!el || isNeverBlockable(el)) return "不能屏蔽页面根节点";
    var id = (el.id || "").toLowerCase();
    if (id && blockedRootIds[id]) return "疑似页面根容器，已阻止";
    var ratio = elementAreaRatio(el);
    if (ratio > 0.72) return "该元素占屏幕面积过大，可能导致页面空白";
    if (selector) {
      try {
        var count = document.querySelectorAll(selector).length;
        if (count > 30) return "该规则会命中 " + count + " 个元素，范围过大";
      } catch (_) {}
    }
    return "";
  }

  function describeElement(el) {
    var selector = selectorFor(el);
    var rect = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
    var lines = [
      "元素：" + labelFor(el),
      el && el.id ? "ID：" + el.id : "",
      el && el.className && typeof el.className === "string" ? "Class：" + el.className : "",
      selector ? "Selector：" + selector : "Selector：无法生成",
      rect ? "面积：" + Math.round(elementAreaRatio(el) * 100) + "% 屏幕" : ""
    ].filter(Boolean);
    var risk = riskReason(el, selector);
    if (risk) lines.push("提示：" + risk);
    return lines.join("\n");
  }

  function showPanel(title, body, actions) {
    removeUi();
    var mask = document.createElement("div");
    mask.dataset.pakrUi = "1";
    mask.className = uiPrefix + "mask";
    mask.addEventListener("click", removeUi);

    var panel = document.createElement("div");
    panel.dataset.pakrUi = "1";
    panel.className = uiPrefix + "panel";
    panel.addEventListener("click", function (event) { event.stopPropagation(); });

    var head = document.createElement("div");
    head.className = uiPrefix + "head";
    head.textContent = title;

    var close = document.createElement("button");
    close.className = uiPrefix + "close";
    close.textContent = "x";
    close.addEventListener("click", removeUi);
    head.appendChild(close);

    var content = document.createElement("pre");
    content.className = uiPrefix + "body";
    content.textContent = body || "";

    panel.appendChild(head);
    panel.appendChild(content);
    actions.forEach(function (action) {
      panel.appendChild(action);
    });
    mask.appendChild(panel);
    document.documentElement.appendChild(mask);
  }

  function inspectElement(el) {
    el = normalizeElement(el);
    if (!el) return;
    showPanel("查看元素", describeElement(el), []);
    clearTimeout(highlightTimer);
    var oldOutline = el.style.outline;
    var oldOutlineOffset = el.style.outlineOffset;
    el.style.outline = "2px solid #BF3EFF";
    el.style.outlineOffset = "2px";
    highlightTimer = setTimeout(function () {
      el.style.outline = oldOutline;
      el.style.outlineOffset = oldOutlineOffset;
    }, 2000);
  }

  function exportedRulePayload() {
    return JSON.stringify({
      version: 1,
      type: "pakr-element-rules",
      host: host,
      exportedAt: new Date().toISOString(),
      rules: rules
    }, null, 2);
  }

  function copyText(text, successMessage) {
    successMessage = successMessage || "已复制";
    var copyWithTextarea = function () {
      var textarea = document.createElement("textarea");
      textarea.dataset.pakrUi = "1";
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.left = "-9999px";
      document.documentElement.appendChild(textarea);
      textarea.focus();
      textarea.select();
      var ok = false;
      try { ok = document.execCommand("copy"); } catch (_) {}
      textarea.remove();
      return ok;
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text)
        .then(function () { showToast(successMessage); })
        .catch(function () {
          showToast(copyWithTextarea() ? successMessage : "请手动复制");
        });
      return;
    }
    showToast(copyWithTextarea() ? successMessage : "请手动复制");
  }

  function normalizeImportedRules(raw) {
    var parsed = JSON.parse(raw);
    var imported = Array.isArray(parsed) ? parsed : parsed && parsed.rules;
    if (!Array.isArray(imported)) throw new Error("规则格式不正确");
    var seen = {};
    return imported.map(function (rule) {
      if (typeof rule === "string") rule = { selector: rule };
      if (!rule || typeof rule.selector !== "string") return null;
      var selector = rule.selector.trim();
      if (!selector || !safeSelector(selector) || seen[selector]) return null;
      seen[selector] = true;
      return {
        selector: selector,
        label: String(rule.label || "导入元素").slice(0, 120),
        createdAt: Number(rule.createdAt) || Date.now()
      };
    }).filter(Boolean).slice(0, 200);
  }

  function showExportPanel() {
    var textarea = document.createElement("textarea");
    textarea.className = uiPrefix + "textarea";
    textarea.value = exportedRulePayload();
    textarea.readOnly = true;

    var copy = document.createElement("button");
    copy.className = uiPrefix + "primary";
    copy.textContent = "复制规则";
    copy.addEventListener("click", function () {
      textarea.focus();
      textarea.select();
      copyText(textarea.value, "已复制规则");
    });

    var actions = [textarea, copy];
    showPanel("导出规则", "复制下面内容，可在另一个 App 的同域名页面导入。", actions);
    textarea.focus();
    textarea.select();
  }

  function showImportPanel() {
    var textarea = document.createElement("textarea");
    textarea.className = uiPrefix + "textarea";
    textarea.placeholder = "粘贴导出的 PakrPre 元素屏蔽规则 JSON";

    var row = document.createElement("div");
    row.className = uiPrefix + "action-row";

    var merge = document.createElement("button");
    merge.className = uiPrefix + "primary";
    merge.textContent = "合并导入";
    merge.addEventListener("click", function () {
      importRulesFromText(textarea.value, false);
    });

    var replace = document.createElement("button");
    replace.className = uiPrefix + "danger";
    replace.textContent = "替换导入";
    replace.addEventListener("click", function () {
      importRulesFromText(textarea.value, true);
    });

    row.appendChild(merge);
    row.appendChild(replace);
    showPanel("导入规则", "导入会应用到当前域名：" + host, [textarea, row]);
  }

  function importRulesFromText(raw, replace) {
    try {
      var imported = normalizeImportedRules(raw);
      if (!imported.length) {
        showToast("没有可导入的有效规则");
        return;
      }
      if (replace) {
        rules = imported;
      } else {
        var exists = {};
        rules.forEach(function (rule) { exists[rule.selector] = true; });
        imported.forEach(function (rule) {
          if (!exists[rule.selector]) {
            exists[rule.selector] = true;
            rules.push(rule);
          }
        });
        rules = rules.slice(0, 200);
      }
      saveRules();
      applyRules();
      showToast("已导入 " + imported.length + " 条规则");
      showRulesPanel();
    } catch (error) {
      showToast(error && error.message ? error.message : "导入失败");
    }
  }

  function showRulesPanel() {
    var actions = [];
    var toolbar = document.createElement("div");
    toolbar.className = uiPrefix + "action-row";

    var exportBtn = document.createElement("button");
    exportBtn.className = uiPrefix + "primary";
    exportBtn.textContent = "导出";
    exportBtn.addEventListener("click", showExportPanel);
    exportBtn.disabled = !rules.length;

    var importBtn = document.createElement("button");
    importBtn.className = uiPrefix + "primary";
    importBtn.textContent = "导入";
    importBtn.addEventListener("click", showImportPanel);

    toolbar.appendChild(exportBtn);
    toolbar.appendChild(importBtn);
    actions.push(toolbar);

    if (!rules.length) {
      showPanel("已屏蔽元素", "当前域名下还没有屏蔽规则。", actions);
      return;
    }

    var list = document.createElement("div");
    list.className = uiPrefix + "rule-list";
    rules.forEach(function (rule, index) {
      var row = document.createElement("div");
      row.className = uiPrefix + "rule-row";
      var text = document.createElement("div");
      text.className = uiPrefix + "rule-text";
      text.textContent = (rule.label || "元素") + "\n" + rule.selector;
      var btn = document.createElement("button");
      btn.textContent = "恢复";
      btn.addEventListener("click", function () {
        rules.splice(index, 1);
        saveRules();
        applyRules();
        showRulesPanel();
      });
      row.appendChild(text);
      row.appendChild(btn);
      list.appendChild(row);
    });
    actions.push(list);

    var clear = document.createElement("button");
    clear.className = uiPrefix + "danger";
    clear.textContent = "清空当前域名规则";
    clear.addEventListener("click", function () {
      rules = [];
      saveRules();
      applyRules();
      showRulesPanel();
    });
    actions.push(clear);
    showPanel("已屏蔽元素", "域名：" + host, actions);
  }

  function addRule(el) {
    var selector = selectorFor(el);
    if (!selector) {
      showToast("这个元素不适合屏蔽");
      return false;
    }
    var risk = riskReason(el, selector);
    if (risk) {
      showToast(risk);
      return false;
    }
    if (rules.some(function (item) { return item.selector === selector; })) {
      showToast("该元素已经在屏蔽列表中");
      return false;
    }
    rules.push({
      selector: selector,
      label: labelFor(el),
      createdAt: Date.now()
    });
    saveRules();
    applyRules();
    showToast("已屏蔽元素");
    return true;
  }

  function updatePickerHighlight() {
    if (!picker || !picker.selected || !picker.box) return;
    var rect = picker.selected.getBoundingClientRect();
    picker.box.style.left = Math.max(0, rect.left) + "px";
    picker.box.style.top = Math.max(0, rect.top) + "px";
    picker.box.style.width = Math.max(0, Math.min(rect.width, innerWidth)) + "px";
    picker.box.style.height = Math.max(0, Math.min(rect.height, innerHeight)) + "px";
    if (picker.info) picker.info.textContent = describeElement(picker.selected);
  }

  function selectPickerElement(el, fromParent) {
    el = normalizeElement(el);
    if (!picker || !el || isNeverBlockable(el)) return;
    if (fromParent && picker.selected) picker.childStack.push(picker.selected);
    picker.selected = el;
    updatePickerHighlight();
  }

  function stopPicker() {
    if (!picker) return;
    document.removeEventListener("click", picker.onClick, true);
    document.removeEventListener("touchstart", picker.onTouchStart, true);
    window.removeEventListener("scroll", picker.onMove, true);
    window.removeEventListener("resize", picker.onMove, true);
    if (picker.previewStyle) picker.previewStyle.remove();
    picker = null;
    removeUi();
  }

  function previewPickerElement() {
    if (!picker || !picker.selected) return;
    var selector = selectorFor(picker.selected);
    var risk = riskReason(picker.selected, selector);
    if (!selector || risk) {
      showToast(risk || "这个元素不适合屏蔽");
      return;
    }
    if (picker.previewStyle) picker.previewStyle.remove();
    picker.previewStyle = document.createElement("style");
    picker.previewStyle.dataset.pakrUi = "1";
    picker.previewStyle.textContent = selector + "{opacity:.15!important;outline:2px dashed #BF3EFF!important;}";
    document.documentElement.appendChild(picker.previewStyle);
    showToast("预览中，确认后才会保存");
    setTimeout(function () {
      if (picker && picker.previewStyle) {
        picker.previewStyle.remove();
        picker.previewStyle = null;
      }
    }, 1600);
  }

  function confirmPickerElement() {
    if (!picker || !picker.selected) return;
    if (addRule(picker.selected)) stopPicker();
  }

  function createPickerButton(text, onClick, danger) {
    var btn = document.createElement("button");
    btn.textContent = text;
    if (danger) btn.className = uiPrefix + "danger-action";
    btn.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();
      onClick();
    });
    return btn;
  }

  function startPicker(target) {
    target = normalizeElement(target);
    if (!target || isNeverBlockable(target)) {
      showToast("请在页面内容上选择元素");
      return;
    }
    removeUi();
    picker = {
      selected: target,
      childStack: [],
      previewStyle: null,
      onMove: function () { setTimeout(updatePickerHighlight, 0); },
      onClick: function (event) {
        if (isUiElement(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        selectPickerElement(event.target, false);
      },
      onTouchStart: function (event) {
        if (isUiElement(event.target)) return;
        event.preventDefault();
        event.stopPropagation();
        selectPickerElement(event.target, false);
      }
    };

    var box = document.createElement("div");
    box.dataset.pakrUi = "1";
    box.className = uiPrefix + "pick-box";
    picker.box = box;

    var toolbar = document.createElement("div");
    toolbar.dataset.pakrUi = "1";
    toolbar.className = uiPrefix + "toolbar";

    var title = document.createElement("div");
    title.className = uiPrefix + "toolbar-title";
    title.textContent = "选择要屏蔽的元素";

    var info = document.createElement("pre");
    info.className = uiPrefix + "pick-info";
    picker.info = info;

    var buttons = document.createElement("div");
    buttons.className = uiPrefix + "toolbar-actions";
    buttons.appendChild(createPickerButton("上级", function () {
      if (!picker || !picker.selected || !picker.selected.parentElement) return;
      selectPickerElement(picker.selected.parentElement, true);
    }));
    buttons.appendChild(createPickerButton("下级", function () {
      if (!picker || !picker.childStack.length) return;
      picker.selected = picker.childStack.pop();
      updatePickerHighlight();
    }));
    buttons.appendChild(createPickerButton("预览", previewPickerElement));
    buttons.appendChild(createPickerButton("确认", confirmPickerElement));
    buttons.appendChild(createPickerButton("取消", stopPicker, true));

    toolbar.appendChild(title);
    toolbar.appendChild(info);
    toolbar.appendChild(buttons);

    document.documentElement.appendChild(box);
    document.documentElement.appendChild(toolbar);
    document.addEventListener("click", picker.onClick, true);
    document.addEventListener("touchstart", picker.onTouchStart, true);
    window.addEventListener("scroll", picker.onMove, true);
    window.addEventListener("resize", picker.onMove, true);
    updatePickerHighlight();
  }

  function showFontPanel() {
    var actions = [];
    var row = document.createElement("div");
    row.className = uiPrefix + "font-row";
    [
      ["A-", "small"],
      ["A", "normal"],
      ["A+", "large"]
    ].forEach(function (item) {
      var button = document.createElement("button");
      button.textContent = item[0];
      if (fontScale === item[1]) button.className = uiPrefix + "primary";
      button.addEventListener("click", function () {
        setFontScale(item[1]);
      });
      row.appendChild(button);
    });
    actions.push(row);
    showPanel("调整字号", "当前域名：" + host + "\nA- 缩小 · A 恢复默认 · A+ 放大", actions);
  }

  function showMenu(x, y, target, suppressNextClick) {
    removeUi();
    suppressNextCloseClick = !!suppressNextClick;
    lastTarget = target && isUiElement(target) ? null : normalizeElement(target);
    var imageToPreview = imagePreviewFor(lastTarget);
    var textToCopy = copyableTextFor(lastTarget);
    var linkToCopy = copyableLinkFor(lastTarget);

    var menu = document.createElement("div");
    menu.dataset.pakrUi = "1";
    menu.className = uiPrefix + "menu";

    var items = [];
    if (imageToPreview) {
      items.push({
        label: "图片预览",
        action: function () {
          try { bridge.previewImage(imageToPreview); } catch (_) { showToast("无法预览图片"); }
          removeUi();
        }
      });
    }
    if (textToCopy) {
      items.push({
        label: "复制文本",
        action: function () { copyText(textToCopy, "已复制文本"); removeUi(); }
      });
    }
    if (linkToCopy) {
      items.push({
        label: "复制链接",
        action: function () { copyText(linkToCopy, "已复制链接"); removeUi(); }
      });
    }
    items = items.concat([
      { label: "屏蔽元素", requiresTarget: true, action: function () { if (lastTarget) startPicker(lastTarget); } },
      { label: "查看元素", requiresTarget: true, action: function () { if (lastTarget) inspectElement(lastTarget); } },
      { label: "调整字号", action: function () { showFontPanel(); } },
      { label: "已屏蔽列表", action: function () { showRulesPanel(); } }
    ]);

    items.forEach(function (item) {
      var button = document.createElement("button");
      button.textContent = item.label;
      button.disabled = item.requiresTarget && !lastTarget;
      button.addEventListener("click", function (event) {
        event.stopPropagation();
        item.action();
      });
      menu.appendChild(button);
    });

    document.documentElement.appendChild(menu);
    var rect = menu.getBoundingClientRect();
    menu.style.left = Math.max(10, Math.min(x, innerWidth - rect.width - 10)) + "px";
    menu.style.top = Math.max(10, Math.min(y, innerHeight - rect.height - 10)) + "px";
    setTimeout(function () {
      var closeOnDocumentClick = function (event) {
        if (suppressNextCloseClick) {
          suppressNextCloseClick = false;
          try { event.preventDefault(); } catch (_) {}
          try { event.stopPropagation(); } catch (_) {}
          setTimeout(function () {
            document.addEventListener("click", closeOnDocumentClick, { once: true, capture: true });
          }, 0);
          return;
        }
        removeUi();
      };
      document.addEventListener("click", closeOnDocumentClick, { once: true, capture: true });
    }, 0);
  }

  function targetFromPoint(x, y, fallback) {
    var stack = [];
    try {
      if (document.elementsFromPoint) stack = Array.prototype.slice.call(document.elementsFromPoint(x, y) || []);
    } catch (_) {}
    if (!stack.length) {
      try {
        var top = document.elementFromPoint(x, y);
        if (top) stack.push(top);
      } catch (_) {}
    }
    if (fallback) stack.push(fallback);

    var firstUsable = null;
    for (var i = 0; i < stack.length; i += 1) {
      var candidate = normalizeElement(stack[i]);
      if (!candidate || isUiElement(candidate) || isNeverBlockable(candidate)) continue;
      if (!firstUsable) firstUsable = candidate;
      if (elementAreaRatio(candidate) <= 0.72) return candidate;
    }
    return firstUsable || fallback || null;
  }

  function openMenuAt(x, y, target, suppressNextClick) {
    if (picker) return false;
    x = Number(x);
    y = Number(y);
    if (!isFinite(x)) x = innerWidth / 2;
    if (!isFinite(y)) y = innerHeight / 2;
    target = target || targetFromPoint(x, y, null);
    if (isUiElement(target)) return false;
    showMenu(x, y, target, suppressNextClick);
    return true;
  }

  function clearTouchLongPress() {
    clearTimeout(touchTimer);
    touchTimer = null;
    touchStartTarget = null;
  }

  function clearPointerLongPress() {
    clearTimeout(pointerTimer);
    pointerTimer = null;
    pointerStartTarget = null;
    pointerId = null;
  }

  function movedBeyondLongPressTolerance(x, y, startX, startY) {
    var dx = x - startX;
    var dy = y - startY;
    return dx * dx + dy * dy > longPressMoveTolerance * longPressMoveTolerance;
  }

  window.PakrElementBlockerUI = window.PakrElementBlockerUI || {};
  window.PakrElementBlockerUI.openMenuAt = function (x, y, suppressNextClick) {
    return openMenuAt(x, y, targetFromPoint(Number(x), Number(y), null), suppressNextClick !== false);
  };
  window.PakrElementBlockerUI.close = removeUi;

  function installUiCss() {
    if (document.getElementById(uiStyleId)) return;
    var css = document.createElement("style");
    css.id = uiStyleId;
    css.textContent =
      "." + uiPrefix + "menu{position:fixed;z-index:2147483647;background:#fff;color:#111;border:1px solid rgba(0,0,0,.12);border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.18);padding:6px;min-width:132px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px}" +
      "." + uiPrefix + "menu button{display:block;width:100%;border:0;background:#fff;color:#111;text-align:left;padding:10px 12px;border-radius:7px;font:inherit}" +
      "." + uiPrefix + "menu button:disabled{color:#aaa}" +
      "." + uiPrefix + "menu button:not(:disabled):active,." + uiPrefix + "menu button:not(:disabled):hover{background:#f2f2f2}" +
      "." + uiPrefix + "mask{position:fixed;inset:0;z-index:2147483647;background:rgba(0,0,0,.28);display:flex;align-items:flex-end;justify-content:center;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}" +
      "." + uiPrefix + "panel{width:min(520px,100%);max-height:76vh;overflow:auto;background:#fff;color:#111;border-radius:18px 18px 0 0;box-shadow:0 -10px 35px rgba(0,0,0,.18);padding:16px}" +
      "." + uiPrefix + "head{display:flex;align-items:center;justify-content:space-between;font-size:16px;font-weight:700;margin-bottom:10px}" +
      "." + uiPrefix + "close{width:32px;height:32px;border-radius:50%;border:0;background:#f3f3f3;color:#333;font-size:18px;line-height:1}" +
      "." + uiPrefix + "body{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;border-radius:10px;padding:12px;margin:0 0 10px;color:#333;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}" +
      "." + uiPrefix + "textarea{box-sizing:border-box;width:100%;min-height:180px;border:1px solid #e5e5e5;border-radius:10px;background:#fafafa;color:#111;padding:10px;font:12px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;resize:vertical;margin:0 0 10px}" +
      "." + uiPrefix + "action-row{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin:0 0 10px}" +
      "." + uiPrefix + "action-row button{height:38px;border:0;border-radius:9px;font-size:13px;font-weight:600}" +
      "." + uiPrefix + "font-row{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}" +
      "." + uiPrefix + "font-row button{height:44px;border:0;border-radius:10px;background:#f2f2f2;color:#111;font-size:18px;font-weight:800}" +
      "." + uiPrefix + "primary{background:#111!important;color:#fff!important}" +
      "." + uiPrefix + "primary:disabled{background:#d1d1d1!important;color:#fff!important}" +
      "." + uiPrefix + "rule-list{display:flex;flex-direction:column;gap:8px;margin-top:10px}" +
      "." + uiPrefix + "rule-row{display:flex;gap:10px;align-items:center;border:1px solid #eee;border-radius:10px;padding:10px;background:#fafafa}" +
      "." + uiPrefix + "rule-text{flex:1;white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.45;color:#333}" +
      "." + uiPrefix + "rule-row button,." + uiPrefix + "danger{border:0;border-radius:8px;background:#111;color:#fff;padding:8px 10px;font-size:13px}" +
      "." + uiPrefix + "danger{width:100%;margin-top:10px;background:#dc2626}" +
      "." + uiPrefix + "pick-box{position:fixed;z-index:2147483646;pointer-events:none;border:2px solid #BF3EFF;background:rgba(191,62,255,.10);box-shadow:0 0 0 9999px rgba(0,0,0,.08);border-radius:4px}" +
      "." + uiPrefix + "toolbar{position:fixed;left:10px;right:10px;bottom:10px;z-index:2147483647;background:#fff;color:#111;border:1px solid rgba(0,0,0,.12);border-radius:14px;box-shadow:0 12px 35px rgba(0,0,0,.20);padding:12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}" +
      "." + uiPrefix + "toolbar-title{font-size:14px;font-weight:700;margin-bottom:8px}" +
      "." + uiPrefix + "pick-info{max-height:92px;overflow:auto;white-space:pre-wrap;word-break:break-word;background:#f7f7f7;border-radius:9px;padding:8px;margin:0 0 10px;color:#333;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}" +
      "." + uiPrefix + "toolbar-actions{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}" +
      "." + uiPrefix + "toolbar-actions button{height:38px;border:0;border-radius:9px;background:#111;color:#fff;font-size:13px;font-weight:600}" +
      "." + uiPrefix + "toolbar-actions button." + uiPrefix + "danger-action{background:#f1f1f1;color:#333}";
    document.documentElement.appendChild(css);
  }

  document.addEventListener("contextmenu", function (event) {
    if (picker || isUiElement(event.target)) return;
    event.preventDefault();
    showMenu(event.clientX, event.clientY, event.target, false);
  }, true);

  document.addEventListener("touchstart", function (event) {
    if (picker || isUiElement(event.target) || !event.touches || !event.touches.length) return;
    var touch = event.touches[0];
    var x = touch.clientX;
    var y = touch.clientY;
    var target = event.target;
    clearTouchLongPress();
    touchStartX = x;
    touchStartY = y;
    touchStartTarget = target;
    touchTimer = setTimeout(function () {
      openMenuAt(x, y, touchStartTarget, true);
      touchTimer = null;
    }, longPressDelay);
  }, true);

  document.addEventListener("touchmove", function (event) {
    if (!touchTimer || !event.touches || !event.touches.length) return;
    var touch = event.touches[0];
    if (movedBeyondLongPressTolerance(touch.clientX, touch.clientY, touchStartX, touchStartY)) {
      clearTouchLongPress();
    }
  }, true);
  ["touchend", "touchcancel"].forEach(function (name) {
    document.addEventListener(name, clearTouchLongPress, true);
  });

  if ("PointerEvent" in window && !("ontouchstart" in window)) {
    document.addEventListener("pointerdown", function (event) {
      if (picker || isUiElement(event.target) || event.button > 0) return;
      clearPointerLongPress();
      pointerStartX = event.clientX;
      pointerStartY = event.clientY;
      pointerStartTarget = event.target;
      pointerId = event.pointerId;
      pointerTimer = setTimeout(function () {
        openMenuAt(pointerStartX, pointerStartY, pointerStartTarget, true);
        pointerTimer = null;
      }, longPressDelay);
    }, true);
    document.addEventListener("pointermove", function (event) {
      if (!pointerTimer || event.pointerId !== pointerId) return;
      if (movedBeyondLongPressTolerance(event.clientX, event.clientY, pointerStartX, pointerStartY)) {
        clearPointerLongPress();
      }
    }, true);
    ["pointerup", "pointercancel"].forEach(function (name) {
      document.addEventListener(name, clearPointerLongPress, true);
    });
  }

  installUiCss();
  loadRules();
  applyRules();
  loadFontScale();
  applyFontScale();
})();
