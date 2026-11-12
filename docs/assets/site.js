/* what3words OpenAPI & AI resources: shared behaviour for / and /openapi/.
   The endpoint pages are rendered from /openapi/openapi.json at runtime. */
(() => {
  "use strict";

  const SPEC_URL = "/openapi/openapi.json";
  const REFERENCE = "/openapi/";
  const PAGE = document.body.dataset.page || "home";
  const METHODS = ["get", "post", "put", "patch", "delete"];

  // Sidebar grouping. Paths not listed here appear under "Endpoints".
  const GROUPS = {
    "/convert-to-3wa": "Convert",
    "/convert-to-coordinates": "Convert",
    "/autosuggest": "AutoSuggest",
    "/autosuggest-with-coordinates": "AutoSuggest",
    "/grid-section": "Grid and languages",
    "/available-languages": "Grid and languages",
  };
  const FILES = [
    { label: "OpenAPI (YAML)", href: "/openapi/openapi.yaml", download: "what3words_openapi.yaml" },
    { label: "OpenAPI (JSON)", href: "/openapi/openapi.json", download: "what3words_openapi.json" },
    { label: "Postman collection", href: "/what3words.postman_collection.json", download: "what3words.postman_collection.json" },
    { label: "llms.txt", href: "/llms.txt" },
    { label: "llms-full.txt", href: "/llms-full.txt" },
  ];
  const OVERVIEW = [
    { id: "intro", label: "Introduction", href: "/" },
    { id: "authentication", label: "Authentication", href: "/#authentication" },
    { id: "errors", label: "Errors", href: "/#errors" },
    { id: "endpoints", label: "All endpoints", href: REFERENCE },
  ];
  const ELSEWHERE = [
    { label: "Guides and tutorials", href: "https://developer.what3words.com/" },
    { label: "Get an API key", href: "https://accounts.what3words.com/create-api-key" },
  ];
  const LANGS = [
    { id: "curl", label: "cURL" },
    { id: "js", label: "JavaScript" },
    { id: "python", label: "Python" },
  ];

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const store = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  };
  const svg = (d) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${d}</svg>`;
  const ICON = {
    copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
    check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    ext: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>'),
    down: svg('<path d="M12 4v11M7 10l5 5 5-5M5 20h14"/>'),
    file: svg('<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>'),
    lock: svg('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
    arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>'),
    edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/>'),
  };

  const main = $("#content");
  const aside = $("#examples");
  const sidebar = $("#sidebar");
  const search = $("#search");
  const contentsBtn = $(".contents-btn");
  const menuBtn = $(".corp-menu");
  const drawer = $("#corp-drawer");

  let spec = null;
  let endpoints = [];
  let byId = {};
  let base = "";
  let auth = { header: "X-Api-Key", query: "key" };
  let lang = store.get("w3w-docs-lang", "curl");
  let view = null;
  let values = {};

  /* ---------- Shell ---------- */
  $$("[data-year]").forEach((el) => { el.textContent = String(new Date().getFullYear()); });
  const kbd = $("#search-kbd");
  if (kbd) kbd.textContent = /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
  if (search && window.matchMedia("(max-width: 720px)").matches) search.placeholder = "Search";

  function setNav(open) {
    document.body.classList.toggle("nav-open", open);
    contentsBtn?.setAttribute("aria-expanded", String(open));
  }

  function setMenu(open) {
    if (!drawer || !menuBtn) return;
    drawer.hidden = !open;
    menuBtn.setAttribute("aria-expanded", String(open));
    menuBtn.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.style.overflow = open ? "hidden" : "";
    if (open) $(".corp-drawer-close", drawer)?.focus();
    else menuBtn.focus();
  }

  drawer?.addEventListener("keydown", (ev) => {
    if (ev.key !== "Tab") return;
    const items = $$("a[href], button:not([tabindex='-1'])", drawer);
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
    else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
  });

  async function copy(text, button) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = Object.assign(document.createElement("textarea"), { value: text });
      document.body.append(area);
      area.select();
      document.execCommand("copy");
      area.remove();
    }
    const original = button.innerHTML;
    button.innerHTML = ICON.check;
    button.classList.add("done");
    setTimeout(() => { button.innerHTML = original; button.classList.remove("done"); }, 1400);
  }

  /* ---------- Spec model ---------- */
  function deref(obj) {
    let out = obj;
    for (let i = 0; i < 20 && out && typeof out === "object" && out.$ref; i += 1) {
      const parts = out.$ref.replace(/^#\//, "").split("/").map((p) => p.replace(/~1/g, "/").replace(/~0/g, "~"));
      out = parts.reduce((node, key) => (node ? node[key] : undefined), spec);
    }
    return out || {};
  }
  const refName = (obj) => (obj && obj.$ref ? obj.$ref.split("/").pop() : null);

  function typeLabel(schema) {
    const name = refName(schema);
    if (name) return name;
    const s = schema || {};
    if (s.oneOf || s.anyOf) return (s.oneOf || s.anyOf).map(typeLabel).join(" or ");
    if (s.type === "array") return `array of ${refName(s.items) || (s.items && s.items.type) || "any"}`;
    if (Array.isArray(s.type)) return s.type.join(" or ");
    return s.type || "any";
  }

  const safeHref = (href) => /^(https?:|mailto:|\/|#)/i.test(href);
  function mdInline(text) {
    return esc(text)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (m, label, href) => (safeHref(href) ? `<a href="${href}">${label}</a>` : label));
  }

  function mdBlock(text) {
    const out = [];
    let para = [];
    let list = [];
    const flushPara = () => { if (para.length) out.push(`<p>${mdInline(para.join(" "))}</p>`); para = []; };
    const flushList = () => { if (list.length) out.push(`<ul>${list.map((l) => `<li>${mdInline(l)}</li>`).join("")}</ul>`); list = []; };
    for (const raw of String(text || "").split("\n")) {
      const line = raw.trim();
      const item = /^[-*]\s+(.*)$/.exec(line);
      if (!line) { flushPara(); flushList(); }
      else if (item) { flushPara(); list.push(item[1]); }
      else { flushList(); para.push(line); }
    }
    flushPara();
    flushList();
    return out.join("");
  }

  function sampleFromSchema(schema, depth = 0) {
    const s = deref(schema);
    if (depth > 6) return null;
    if (s.example !== undefined) return s.example;
    if (Array.isArray(s.examples) && s.examples.length) return s.examples[0];
    if (s.const !== undefined) return s.const;
    if (s.default !== undefined) return s.default;
    if (Array.isArray(s.enum) && s.enum.length) return s.enum[0];
    if (s.oneOf || s.anyOf) return sampleFromSchema((s.oneOf || s.anyOf)[0], depth + 1);
    if (s.allOf) return Object.assign({}, ...s.allOf.map((part) => sampleFromSchema(part, depth + 1)).filter((v) => v && typeof v === "object"));
    const type = Array.isArray(s.type) ? s.type.find((t) => t !== "null") : s.type;
    if (type === "object" || s.properties) {
      return Object.fromEntries(Object.entries(s.properties || {}).map(([k, v]) => [k, sampleFromSchema(v, depth + 1)]));
    }
    if (type === "array") return [sampleFromSchema(s.items, depth + 1)];
    if (type === "integer" || type === "number") return 0;
    if (type === "boolean") return true;
    if (type === "string") return "string";
    return null;
  }

  function fieldsOf(schema, depth = 0) {
    let s = deref(schema);
    if (s.oneOf || s.anyOf) s = deref((s.oneOf || s.anyOf)[0]);
    if (s.type === "array") s = deref(s.items);
    const required = new Set(s.required || []);
    return Object.entries(s.properties || {}).map(([name, raw]) => {
      const target = deref(raw);
      const nested = target.properties || (target.type === "array" && deref(target.items).properties);
      return {
        name,
        type: typeLabel(raw),
        required: required.has(name),
        description: mdInline(raw.description || target.description || ""),
        children: depth < 1 && nested ? fieldsOf(raw, depth + 1) : null,
      };
    });
  }

  const contentLabel = (type) => (/geo\+json/.test(type) ? "GeoJSON" : /json/.test(type) ? "JSON" : type);
  const firstSentence = (text) => {
    const t = String(text || "").trim();
    const m = /^[\s\S]*?\.(?=\s|$)/.exec(t);
    return m ? m[0] : t;
  };

  function buildModel() {
    base = (spec.servers && spec.servers[0] && spec.servers[0].url) || "";
    const schemes = Object.values((spec.components && spec.components.securitySchemes) || {}).filter((s) => s.type === "apiKey");
    const headerScheme = schemes.find((s) => s.in === "header");
    const queryScheme = schemes.find((s) => s.in === "query");
    auth = { header: headerScheme ? headerScheme.name : null, query: queryScheme ? queryScheme.name : "key" };
    const authParams = new Set(schemes.filter((s) => s.in === "query").map((s) => s.name));

    endpoints = [];
    for (const [path, item] of Object.entries(spec.paths || {})) {
      for (const method of METHODS) {
        const op = item[method];
        if (!op) continue;
        const params = [...(item.parameters || []), ...(op.parameters || [])].map(deref)
          .filter((p) => !(p.in === "query" && authParams.has(p.name)))
          .map((p) => {
            const schema = deref(p.schema);
            const named = p.examples && Object.values(p.examples)[0];
            const example = p.example ?? (Array.isArray(schema.examples) ? schema.examples[0] : undefined) ?? schema.example ?? (named && deref(named).value);
            return {
              name: p.name,
              in: p.in,
              type: typeLabel(p.schema),
              required: Boolean(p.required),
              default: schema.default,
              enum: schema.enum,
              maximum: schema.maximum,
              example,
              description: mdBlock(p.description),
            };
          });
        const responses = Object.entries(op.responses || {}).map(([status, raw]) => {
          const r = deref(raw);
          const contents = Object.entries(r.content || {});
          const examples = [];
          for (const [type, c] of contents) {
            const prefix = contents.length > 1 ? `${contentLabel(type)} · ` : "";
            if (c.examples) {
              for (const [name, ex] of Object.entries(c.examples)) {
                const e = deref(ex);
                examples.push({ key: `${status}|${type}|${name}`, name, label: prefix + (e.summary || name).replace(/`/g, ""), value: e.value });
              }
            } else if (c.example !== undefined) {
              examples.push({ key: `${status}|${type}|example`, name: "Example", label: `${prefix}Example`, value: c.example });
            } else if (c.schema) {
              examples.push({ key: `${status}|${type}|schema`, name: "Schema", label: `${prefix}Example from schema`, value: sampleFromSchema(c.schema) });
            }
          }
          return { status, description: r.description || "", examples };
        });
        const ok = deref((op.responses || {})["200"]);
        const okContent = ok.content && (ok.content["application/json"] || Object.values(ok.content)[0]);
        const sample = {};
        params.filter((p) => p.required && p.example != null).forEach((p) => { sample[p.name] = String(p.example); });
        const description = op.description || "";
        endpoints.push({
          id: path.replace(/^\//, "").replace(/[^A-Za-z0-9-]+/g, "-") + (method === "get" ? "" : `-${method}`),
          method,
          path,
          summary: op.summary || `${method.toUpperCase()} ${path}`,
          group: GROUPS[path] || "Endpoints",
          lede: mdInline(firstSentence(description || op.summary)),
          description: mdBlock(description),
          permission: /special permission/i.test(description)
            || responses.some((r) => r.examples.some((x) => x.name === "InvalidKeyNoPermissions")),
          params,
          responses,
          fields: okContent && okContent.schema ? fieldsOf(okContent.schema) : [],
          sample,
        });
      }
    }
    byId = Object.fromEntries(endpoints.map((e) => [e.id, e]));
  }

  function errorCodes() {
    const schemas = (spec.components && spec.components.schemas) || {};
    const code = schemas.Error && schemas.Error.properties && deref(schemas.Error.properties.code);
    if (!code) return [];
    if (Array.isArray(code.enum)) return code.enum;
    return [...String(code.description || "").matchAll(/`([A-Za-z]+)`/g)].map((m) => m[1]);
  }

  /* ---------- Navigation ---------- */
  function currentNavId() {
    if (PAGE === "reference") return view || "endpoints";
    const hash = decodeURIComponent(location.hash.slice(1));
    return ["authentication", "errors"].includes(hash) ? hash : "intro";
  }

  function renderNav() {
    const terms = (search ? search.value : "").trim().toLowerCase().split(/\s+/).filter(Boolean);
    const matches = (text) => terms.every((t) => text.toLowerCase().includes(t));
    const current = currentNavId();
    const groups = [
      { label: "Files", items: FILES.map((f) => ({ ...f, trail: f.download ? "down" : "file" })) },
      { label: "Overview", items: OVERVIEW.map((o) => ({ ...o, current: o.id === current })) },
    ];
    for (const e of endpoints) {
      let group = groups.find((g) => g.label === e.group);
      if (!group) groups.push((group = { label: e.group, items: [] }));
      group.items.push({
        label: e.summary,
        href: `${REFERENCE}#${e.id}`,
        verb: e.method.toUpperCase(),
        lock: e.permission,
        current: PAGE === "reference" && e.id === current,
        haystack: [e.summary, e.path, ...e.params.map((p) => p.name)].join(" "),
      });
    }
    groups.push({ label: "More from what3words", items: ELSEWHERE.map((x) => ({ ...x, trail: "ext" })) });

    let html = "";
    for (const g of groups) {
      const items = g.items.filter((i) => matches(i.haystack || i.label));
      if (!items.length) continue;
      html += `<div class="nav-group"><div class="nav-label">${esc(g.label)}</div>${items.map((i) => `<a class="nav-item" href="${esc(i.href)}"${i.download ? ` download="${esc(i.download)}"` : ""}${i.current ? ' aria-current="page"' : ""}>${esc(i.label)}${i.lock ? `<span class="lock" title="Requires extra permission">${ICON.lock}</span>` : ""}${i.verb ? `<span class="verb">${esc(i.verb)}</span>` : ""}${i.trail ? `<span class="trail">${ICON[i.trail]}</span>` : ""}</a>`).join("")}</div>`;
    }
    sidebar.innerHTML = html || `<p class="nav-empty">No matches for “${esc(search.value.trim())}”.</p>`;
  }

  /* ---------- Code samples ---------- */
  function sampleCode(e, vals, language) {
    const url = base + e.path;
    const entries = Object.entries(vals).filter(([, v]) => v !== "" && v != null);
    if (!auth.header) entries.push([auth.query, "YOUR_API_KEY"]);
    const upper = e.method.toUpperCase();
    if (language === "curl") {
      const lines = [`curl ${e.method === "get" ? "-G" : `-X ${upper}`} ${url}`];
      entries.forEach(([k, v]) => lines.push(`  --data-urlencode "${k}=${v}"`));
      if (auth.header) lines.push(`  -H "${auth.header}: YOUR_API_KEY"`);
      return lines.join(" \\\n");
    }
    if (language === "js") {
      const key = (k) => (/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k));
      const options = [e.method === "get" ? "" : `  method: "${upper}",`, auth.header ? `  headers: { "${auth.header}": "YOUR_API_KEY" },` : ""].filter(Boolean).join("\n");
      const call = (target) => `const response = await fetch(${target}${options ? `, {\n${options}\n}` : ""});\nconst data = await response.json();`;
      if (!entries.length) return call(`"${url}"`);
      return `const params = new URLSearchParams({\n${entries.map(([k, v]) => `  ${key(k)}: ${JSON.stringify(v)},`).join("\n")}\n});\n\n${call(`\`${url}?\${params}\``)}`;
    }
    const params = entries.length ? `    params={\n${entries.map(([k, v]) => `        ${JSON.stringify(k)}: ${JSON.stringify(v)},`).join("\n")}\n    },\n` : "";
    const headers = auth.header ? `    headers={"${auth.header}": "YOUR_API_KEY"},\n` : "";
    return `import requests\n\nresponse = requests.${e.method}(\n    "${url}",\n${params}${headers})\ndata = response.json()`;
  }

  function highlight(src, re, classify) {
    let out = "";
    let last = 0;
    let m;
    re.lastIndex = 0;
    while ((m = re.exec(src))) {
      out += esc(src.slice(last, m.index)) + classify(m);
      last = m.index + m[0].length;
    }
    return out + esc(src.slice(last));
  }
  const span = (cls, text) => `<span class="${cls}">${esc(text)}</span>`;
  const highlightCode = (src) => highlight(
    src,
    /("(?:[^"\\\n]|\\.)*"|`(?:[^`\\]|\\.)*`)|\b(const|await|new|import)\b|(\s-{1,2}[A-Za-z][\w-]*)|\b(curl|requests|fetch|URLSearchParams)\b/g,
    (m) => span(m[1] ? "t-str" : m[2] ? "t-kw" : m[3] ? "t-flag" : "t-fn", m[0]),
  );
  const highlightJSON = (value) => highlight(
    JSON.stringify(value, null, 2) ?? "null",
    /("(?:[^"\\]|\\.)*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)|([{}[\],])/g,
    (m) => (m[1] ? (m[2] ? span("t-key", m[1]) + span("t-punc", m[2]) : span("t-str", m[1]))
      : m[3] ? span("t-bool", m[0]) : m[4] ? span("t-num", m[0]) : span("t-punc", m[0])),
  );

  function requestCard(e, editable) {
    const control = (p) => {
      const value = values[p.name] ?? "";
      if (p.enum || p.type === "boolean") {
        const options = p.enum || ["true", "false"];
        return `<select data-param="${esc(p.name)}"><option value="">${p.default != null ? `default (${esc(p.default)})` : "not set"}</option>${options.map((o) => `<option${String(o) === value ? " selected" : ""}>${esc(o)}</option>`).join("")}</select>`;
      }
      return `<input data-param="${esc(p.name)}" value="${esc(value)}" placeholder="${esc(p.example ?? p.default ?? "")}" spellcheck="false" autocomplete="off">`;
    };
    const edit = editable && e.params.length;
    return `<section class="codecard" aria-label="Request example">
      <div class="codecard-head"><span class="cc-title">Request</span>
        <div class="tabs" role="tablist" aria-label="Language">${LANGS.map((l) => `<button class="tab" type="button" role="tab" data-lang="${l.id}" aria-selected="${l.id === lang}">${l.label}</button>`).join("")}</div>
        <button class="cc-btn" type="button" data-copy-from="req-code" aria-label="Copy request">${ICON.copy}</button>
      </div>
      <pre class="code" id="req-code"></pre>
      ${edit ? `<div class="codecard-foot"><button class="edit-toggle" type="button" aria-expanded="false" aria-controls="edit-panel">${ICON.edit}Edit parameters</button><span>The sample updates as you type</span></div>
      <div class="edit-panel" id="edit-panel" hidden>${e.params.map((p) => `<label><span class="${p.required ? "req" : ""}">${esc(p.name)}</span>${control(p)}</label>`).join("")}</div>` : ""}
    </section>`;
  }

  function responseCard(e) {
    const options = e.responses.flatMap((r) => r.examples.map((x) => `<option value="${esc(x.key)}">${esc(r.status)} · ${esc(x.label)}</option>`));
    if (!options.length) return "";
    return `<section class="codecard" id="resp-card" aria-label="Response example">
      <div class="codecard-head"><span class="cc-title">Response</span><span class="sd" id="resp-status"></span>
        <select class="select-dark" id="resp-select" aria-label="Response example">${options.join("")}</select>
        <button class="cc-btn" type="button" data-copy-from="resp-code" aria-label="Copy response">${ICON.copy}</button>
      </div>
      <pre class="code resp-pre" id="resp-code"></pre>
    </section>`;
  }

  // The quick start shows this endpoint; endpoint pages show their own.
  const quickEndpoint = () => byId["convert-to-3wa"] || endpoints[0];
  const activeEndpoint = () => byId[view] || quickEndpoint();

  function updateRequest() {
    const code = $("#req-code");
    if (!code) return;
    code.innerHTML = highlightCode(sampleCode(activeEndpoint(), values, lang));
    $$(".tab[data-lang]").forEach((t) => t.setAttribute("aria-selected", String(t.dataset.lang === lang)));
  }

  function updateResponse() {
    const select = $("#resp-select");
    if (!select) return;
    const e = activeEndpoint();
    const status = select.value.split("|")[0];
    const example = e.responses.flatMap((r) => r.examples).find((x) => x.key === select.value);
    $("#resp-code").innerHTML = highlightJSON(example ? example.value : null);
    const pill = $("#resp-status");
    pill.textContent = status;
    pill.className = `sd ${status.startsWith("2") ? "sd-ok" : "sd-err"}`;
    $$("button.code-chip[data-example]").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.example === select.value)));
  }

  /* ---------- Views ---------- */
  const lockIcon = `<span class="lock" title="Requires extra permission">${ICON.lock}</span>`;
  const cardsHTML = () => endpoints.map((e) => `<a class="ep-card" href="${REFERENCE}#${e.id}">
      <div class="top"><span class="method">${esc(e.method)}</span><span class="p">${esc(e.path)}</span>${e.permission ? lockIcon : ""}</div>
      <h3>${esc(e.summary)}</h3><p>${e.lede}</p></a>`).join("");
  const baseHTML = () => `<div class="base"><span class="base-label">Base URL</span><code class="bare">${esc(base)}</code><button class="icon-btn" type="button" data-copy="${esc(base)}" aria-label="Copy base URL">${ICON.copy}</button></div>`;

  function paramHTML(p) {
    const meta = [];
    if (p.default != null) meta.push(`Default <code>${esc(p.default)}</code>`);
    if (p.maximum != null) meta.push(`Maximum <code>${esc(p.maximum)}</code>`);
    if (p.enum) meta.push(`One of ${p.enum.map((v) => `<code>${esc(v)}</code>`).join(" ")}`);
    else if (p.example != null) meta.push(`Example <code>${esc(p.example)}</code>`);
    return `<div class="param" id="param-${esc(p.name)}">
      <div class="param-head"><code class="pname">${esc(p.name)}</code><span class="ptype">${esc(p.in === "query" ? p.type : `${p.type}, in ${p.in}`)}</span>${p.required ? '<span class="preq">Required</span>' : ""}</div>
      <div class="pdesc">${p.description}</div>
      ${meta.length ? `<div class="pmeta">${meta.map((m) => `<span>${m}</span>`).join("")}</div>` : ""}
    </div>`;
  }

  function fieldHTML(f) {
    return `<div class="param">
      <div class="param-head"><code class="pname">${esc(f.name)}</code><span class="ptype">${esc(f.type)}</span></div>
      ${f.description ? `<div class="pdesc">${f.description}</div>` : ""}
      ${f.children ? `<div class="children">${f.children.map(fieldHTML).join("")}</div>` : ""}
    </div>`;
  }

  function quickStart() {
    const first = quickEndpoint();
    if (!first || !aside) {
      $(".layout")?.classList.add("no-examples");
      return;
    }
    values = { ...first.sample };
    aside.innerHTML = `<p class="aside-label">Quick start</p>${requestCard(first, false)}${responseCard(first)}
      <p class="aside-note">Copy the request, add your API key and run it.</p>`;
    updateRequest();
    updateResponse();
  }

  function renderEndpoint(e) {
    const index = endpoints.indexOf(e);
    const prev = endpoints[index - 1];
    const next = endpoints[index + 1];
    const hasFormat = e.params.some((p) => p.name === "format");
    const errors = e.responses.filter((r) => !r.status.startsWith("2"));
    main.innerHTML = `<div class="content-inner">
      <h1>${esc(e.summary)}</h1>
      <div class="endpoint"><span class="method">${esc(e.method)}</span><div class="url"><span class="host">${esc(base)}</span><span class="path">${esc(e.path)}</span></div>
        <button class="icon-btn" type="button" data-copy="${esc(base + e.path)}" aria-label="Copy URL">${ICON.copy}</button></div>
      ${e.permission ? `<div class="callout">${ICON.lock}<div>This endpoint needs extra permission on your API key. Contact <a href="mailto:support@what3words.com">support@what3words.com</a> to request access.</div></div>` : ""}
      <div class="prose">${e.description}</div>

      <h2>Parameters</h2>
      <p class="sub">Plus your API key${auth.header ? `, as the <code>${esc(auth.header)}</code> header or <code>${esc(auth.query)}</code> parameter` : ""}. <a href="/#authentication">About authentication</a></p>
      <div class="params">${e.params.length ? e.params.map(paramHTML).join("") : '<p class="note">No parameters other than your API key.</p>'}</div>

      ${e.fields.length ? `<h2>Response</h2>
      <p class="sub">Returned with <code>200</code>${hasFormat ? ", as JSON by default or GeoJSON with <code>format=geojson</code>" : ""}.</p>
      <div class="params">${e.fields.map(fieldHTML).join("")}</div>` : ""}

      ${errors.length ? `<h2>Errors</h2>
      <p class="sub">Select a code to see its example response.</p>
      <div class="responses">${errors.map((r) => `<div class="resp"><span class="status">${esc(r.status)}</span><div>
        <div class="resp-title">${esc(r.description)}</div>
        <div class="codes">${r.examples.map((x) => `<button class="code-chip" type="button" data-example="${esc(x.key)}" aria-pressed="false">${esc(x.name)}</button>`).join("")}</div>
      </div></div>`).join("")}</div>` : ""}

      <nav class="pager" aria-label="Endpoints">
        ${prev ? `<a class="prev" href="#${prev.id}"><small>Previous</small><strong>${esc(prev.summary)}</strong></a>` : `<a class="prev" href="${REFERENCE}"><small>Back to</small><strong>All endpoints</strong></a>`}
        ${next ? `<a class="next" href="#${next.id}"><small>Next</small><strong>${esc(next.summary)}</strong></a>` : ""}
      </nav>
    </div>`;
    view = e.id;
    values = { ...e.sample };
    aside.innerHTML = `${requestCard(e, true)}${responseCard(e)}`;
    updateRequest();
    updateResponse();
    document.title = `${e.summary} | OpenAPI & AI resources | what3words`;
  }

  function renderIndex() {
    view = null;
    main.innerHTML = `<div class="content-inner">
      <h1>Endpoints</h1>
      <p class="lede">Every operation in the what3words OpenAPI definition, with parameters, response fields and examples.</p>
      ${baseHTML()}
      <div class="ep-grid">${cardsHTML()}</div>
    </div>`;
    quickStart();
    document.title = "Endpoints | OpenAPI & AI resources | what3words";
  }

  function route(fromNavigation) {
    const id = decodeURIComponent(location.hash.slice(1));
    const e = byId[id];
    if (e && view !== e.id) renderEndpoint(e);
    else if (!e && (view !== null || !main.querySelector(".ep-grid"))) renderIndex();
    if (fromNavigation) {
      window.scrollTo(0, 0);
      main.focus({ preventScroll: true });
    }
    setNav(false);
    renderNav();
  }

  function renderHome() {
    const cards = $("#endpoint-cards");
    if (cards) cards.innerHTML = cardsHTML();
    const codes = $("#error-codes");
    if (codes) codes.innerHTML = errorCodes().map((c) => `<span class="code-chip">${esc(c)}</span>`).join("");
    quickStart();
    renderNav();
  }

  // Shows info.x-last-updated (YYYY-MM-DD) when the spec provides it. HTTP
  // Last-Modified is not used: GitHub Pages stamps every file with the deploy time.
  function showMeta() {
    const meta = $("#spec-meta");
    if (!meta) return;
    const parts = [`OpenAPI ${esc(spec.openapi)}`];
    const updated = spec.info && spec.info["x-last-updated"];
    const date = updated ? new Date(`${updated}T00:00:00Z`) : null;
    if (date && !Number.isNaN(date.getTime())) {
      parts.push(`Last updated ${date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}`);
    }
    meta.innerHTML = parts.map((p) => `<span>${p}</span>`).join("");
  }

  function showLoadError() {
    const links = `<a href="/openapi/openapi.yaml">YAML</a> or <a href="/openapi/openapi.json">JSON</a>`;
    if (PAGE === "reference") {
      main.innerHTML = `<div class="content-inner"><h1>Endpoints</h1><p class="load-error">The OpenAPI definition could not be loaded. Download it as ${links}.</p></div>`;
    }
    if (aside) aside.innerHTML = "";
    $(".layout")?.classList.add("no-examples");
  }

  /* ---------- Events ---------- */
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("button, a");
    if (!t) return;
    if (t.dataset.lang) {
      lang = t.dataset.lang;
      store.set("w3w-docs-lang", lang);
      updateRequest();
    } else if (t.dataset.copy) {
      copy(t.dataset.copy, t);
    } else if (t.dataset.copyFrom) {
      copy($(`#${t.dataset.copyFrom}`).textContent, t);
    } else if (t.dataset.example) {
      const select = $("#resp-select");
      select.value = t.dataset.example;
      updateResponse();
      const card = $("#resp-card");
      card.classList.add("flash");
      setTimeout(() => card.classList.remove("flash"), 900);
      if (window.matchMedia("(max-width: 1080px)").matches) card.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (t.classList.contains("edit-toggle")) {
      const panel = $("#edit-panel");
      panel.hidden = !panel.hidden;
      t.setAttribute("aria-expanded", String(!panel.hidden));
      if (!panel.hidden) $("input, select", panel)?.focus();
    } else if (t === contentsBtn) {
      setNav(!document.body.classList.contains("nav-open"));
    } else if (t === menuBtn) {
      setMenu(drawer.hidden);
    } else if (t.hasAttribute("data-close-menu")) {
      setMenu(false);
    } else if (t.closest(".sidebar") && !t.hasAttribute("download")) {
      setNav(false);
    }
  });
  $(".scrim")?.addEventListener("click", () => setNav(false));

  document.addEventListener("input", (ev) => {
    const name = ev.target.dataset && ev.target.dataset.param;
    if (name === undefined) return;
    if (ev.target.value) values[name] = ev.target.value;
    else delete values[name];
    updateRequest();
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.id === "resp-select") updateResponse();
  });

  search?.addEventListener("input", () => {
    renderNav();
    if (search.value && window.matchMedia("(max-width: 1080px)").matches) setNav(true);
  });
  search?.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter") return;
    ev.preventDefault();
    const first = $$(".sidebar a.nav-item").find((a) => !a.hasAttribute("download"));
    if (first) { search.blur(); location.href = first.href; }
  });
  document.addEventListener("keydown", (ev) => {
    const typing = /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName);
    if (search && ((ev.key.toLowerCase() === "k" && (ev.metaKey || ev.ctrlKey)) || (ev.key === "/" && !typing))) {
      ev.preventDefault();
      search.focus();
      search.select();
    } else if (ev.key === "Escape") {
      if (drawer && !drawer.hidden) setMenu(false);
      setNav(false);
      if (document.activeElement === search && search.value) { search.value = ""; renderNav(); }
    }
  });
  window.addEventListener("hashchange", () => {
    if (PAGE === "reference" && spec) route(true);
    else { setNav(false); renderNav(); }
  });

  /* ---------- Start ---------- */
  renderNav();
  fetch(SPEC_URL)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    })
    .then((json) => {
      spec = json;
      buildModel();
      showMeta();
      if (PAGE === "reference") route(false);
      else renderHome();
    })
    .catch(showLoadError);
})();
