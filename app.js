const state = {
  api: localStorage.getItem("crm-api-url") || window.CRM_API_BASE || "",
  token: sessionStorage.getItem("crm-write-token") || "",
  tab: "all",
  view: "table",
  page: 1,
  selected: null,
  options: { statuses: [], sources: [] },
  dashboard: null,
};
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = "") =>
  String(value).replace(
    /[&<>'"]/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#039;",
        '"': "&quot;",
      })[c],
  );
const short = (value = "", size = 100) =>
  value.length > size ? `${value.slice(0, size).trim()}…` : value;
const workflowOptions = {
  outreach_status: [
    "",
    "Отписал",
    "Не отписал",
    "супер сайт, на кой хуй отписываать",
  ],
  owner: ["", "Саня", "Стёпа"],
  result: [
    "",
    "Ожидаем ответ",
    "Ответил",
    "Диалог",
    "Созвон",
    "Кастдев назначен",
    "Кастдев проведён",
    "Предложение отправлено",
    "Продающий созвон",
    "Клиент",
    "Отказ",
    "Не актуально",
    "Нет ответа",
    "Чат очищен",
    "Уточнить статус",
  ],
  qualification: ["", "🔥 Горячий", "Тёплый", "Холодный"],
};
const apiUrl = (path) => `${state.api.replace(/\/$/, "")}${path}`;
async function request(path, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  if (state.token) headers["X-CRM-Token"] = state.token;
  const res = await fetch(apiUrl(path), { ...options, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}
function statusClass(value = "") {
  const v = value.toLowerCase();
  if (/диалог|интерес|горяч|дзвін/.test(v)) return "status hot";
  if (/ожида|очіку|нов/.test(v)) return "status warm";
  if (/не акту|очищ|закры|не наша/.test(v)) return "status cold";
  return "status";
}
function tag(value, cls = "") {
  return value
    ? `<span class="tag ${cls}">${escapeHtml(value)}</span>`
    : '<span class="muted">—</span>';
}
function tabs() {
  return {
    all: "",
    pipeline: "Лиды TG",
    olx: "OLX — открыть номер",
    archive: "Все лиды (архив)",
  };
}
function renderOptions() {
  const fill = (selector, values, title) =>
    ($(selector).innerHTML =
      `<option value="">${title}</option>${values.map((x) => `<option>${escapeHtml(x)}</option>`).join("")}`);
  fill("#status-filter", state.options.statuses, "Усі статуси");
  fill("#source-filter", state.options.sources, "Усі джерела");
}
function renderDashboard() {
  const data = state.dashboard || {};
  const statuses = Object.fromEntries(
    (data.byStatus || []).map((x) => [x.label, x.value]),
  );
  const waiting = Object.entries(statuses)
    .filter(([key]) => /ожида|очіку|нов/i.test(key))
    .reduce((sum, [, v]) => sum + v, 0);
  const hot = (data.byPriority || [])
    .filter((x) => /горяч/i.test(x.label))
    .reduce((sum, x) => sum + x.value, 0);
  $("#metric-total").textContent = data.total ?? "—";
  $("#nav-total").textContent = data.total ?? "—";
  $("#metric-waiting").textContent = waiting || "—";
  $("#metric-hot").textContent = hot || "—";
  $("#metric-actions").textContent = (data.followUps || []).length || "—";
}
function isTelegramUsername(value = "") {
  return /^@[a-zA-Z0-9_]{5,}$/.test(String(value).trim());
}
function normalizeUkrainianPhone(value = "") {
  const candidates =
    String(value).match(/(?:\+?38[\s().-]*)?0(?:[\s().-]*\d){9}/g) || [];
  for (const candidate of candidates) {
    const digits = candidate.replace(/\D/g, "");
    if (digits.length === 12 && digits.startsWith("380")) return `+${digits}`;
    if (digits.length === 10 && digits.startsWith("0")) return `+38${digits}`;
  }
  return "";
}
function isExternalUrl(value = "") {
  try {
    return ["http:", "https:"].includes(new URL(String(value).trim()).protocol);
  } catch {
    return false;
  }
}
function extractUrls(...values) {
  const found = [];
  for (const value of values.flat()) {
    const matches = String(value || "").match(/https?:\/\/[^\s<>"']+/gi) || [];
    for (const match of matches) {
      const clean = match.replace(/[),.;!?]+$/g, "");
      if (isExternalUrl(clean) && !found.includes(clean)) found.push(clean);
    }
  }
  return found;
}
function sourceType(url = "") {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").toLowerCase();
    if (host.endsWith("olx.ua")) return { label: "OLX", rank: 0, cls: "olx" };
    if (host.includes("instagram.com"))
      return { label: "Instagram", rank: 2, cls: "social" };
    if (host.includes("facebook.com") || host === "fb.com")
      return { label: "Facebook", rank: 2, cls: "social" };
    if (host.includes("t.me")) return { label: "Telegram", rank: 3, cls: "social" };
    return { label: "Сайт", rank: 1, cls: "site" };
  } catch {
    return { label: "Джерело", rank: 4, cls: "source" };
  }
}
function collectLeadLinks(lead) {
  return extractUrls(
    lead.link,
    lead.business_info,
    lead.personalization,
    lead.comment,
    lead.pain,
    lead.offer,
    lead.extra_message,
    lead.sent_message,
  )
    .map((url) => ({ url, ...sourceType(url) }))
    .sort((a, b) => a.rank - b.rank);
}
function sourceLinksMarkup(lead, limit = Infinity) {
  const links = collectLeadLinks(lead).slice(0, limit);
  if (!links.length) return '<span class="muted">Посилання ще не знайдено</span>';
  return links
    .map(
      ({ url, label, cls }) =>
        `<a class="source-chip ${cls}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${label} ↗</a>`,
    )
    .join("");
}
function contactMarkup(lead) {
  const username = isTelegramUsername(lead.telegram)
    ? lead.telegram.slice(1)
    : "";
  const phone = String(lead.phone || "").trim();
  const phoneCandidate = phone || String(lead.telegram || "").trim();
  const normalizedPhone = normalizeUkrainianPhone(phoneCandidate);
  const display = username ? `@${username}` : phone || lead.telegram || "—";
  const telegramUrl = username
    ? `https://t.me/${encodeURIComponent(username)}`
    : normalizedPhone
      ? `https://t.me/${normalizedPhone}`
      : "";
  return `<span class="contact-stack"><span>${escapeHtml(display)}</span>${telegramUrl ? `<a href="${escapeHtml(telegramUrl)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Написати в TG ↗</a>` : ""}</span>`;
}
function isContacted(lead) {
  const status = String(lead.outreach_status || "").trim().toLowerCase();
  if (
    /не\s*(отпис|пис|напис|відпис)|нет|ні|^no$|^0$|^—$|^-$|на кой.*отпис/.test(
      status,
    )
  )
    return false;
  if (/отпис|напис|відпис|відправ|^да$|^так$|^yes$|^1$/.test(status))
    return true;
  return Boolean(
    String(lead.first_contact_at || "").trim() ||
      String(lead.last_contact_at || "").trim(),
  );
}
function ownerGroup(lead) {
  const owner = String(lead.owner || "").trim().toLowerCase();
  if (/сан|саш|алекс/.test(owner)) return "sanya";
  if (/ст[её]п/.test(owner)) return "stepa";
  return "other";
}
function messagePreview(lead) {
  return lead.sent_message || lead.message_variant || lead.extra_message || "—";
}
function materialMarkup(lead) {
  if (!isExternalUrl(lead.attachment)) return '<span class="muted">Немає</span>';
  return `<a class="material-link" href="${escapeHtml(lead.attachment)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Фото / концепт ↗</a>`;
}
function workflowTone(field, value = "") {
  const normalized = String(value).trim().toLowerCase();
  if (field === "outreach_status") {
    if (/^отписал$/.test(normalized)) return "sent";
    if (/не отписал/.test(normalized)) return "pending";
    return normalized ? "muted" : "empty";
  }
  if (field === "owner") {
    if (/сан/.test(normalized)) return "sanya";
    if (/ст[её]п/.test(normalized)) return "stepa";
    return "empty";
  }
  if (field === "qualification") {
    if (/горяч/.test(normalized)) return "hot";
    if (/т[её]пл/.test(normalized)) return "warm";
    if (/холод/.test(normalized)) return "cold";
    return "empty";
  }
  if (/клиент/.test(normalized)) return "success";
  if (/ответил|диалог/.test(normalized)) return "active";
  if (/созвон|кастдев|предложение/.test(normalized)) return "progress";
  if (/ожидаем|уточнить/.test(normalized)) return "pending";
  if (/отказ/.test(normalized)) return "danger";
  if (/не актуально|нет ответа|очищен/.test(normalized)) return "muted";
  return normalized ? "active" : "empty";
}
function optionMarkup(options, selected) {
  return options
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value || "Не выбрано")}</option>`,
    )
    .join("");
}
function quickSelect(lead, field, label) {
  const value = String(lead[field] || "");
  return `<label class="quick-field" title="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><select class="quick-select" data-quick-field="${field}" data-lead-id="${lead.id}" data-tone="${workflowTone(field, value)}" aria-label="${escapeHtml(label)}">${optionMarkup(workflowOptions[field], value)}</select></label>`;
}
function leadRow(lead) {
  return `<div class="lead-row" data-lead="${lead.id}" role="button" tabindex="0">
    <span class="lead-main"><b>${escapeHtml(lead.name)}</b><small>${escapeHtml(lead.business_info || lead.direction || "Без опису")}</small>${quickSelect(lead, "qualification", "Квалификация")}</span>
    <span class="lead-source-cell">${sourceLinksMarkup(lead, 2)}</span>
    <span>${contactMarkup(lead)}</span>
    <span>${quickSelect(lead, "outreach_status", "Отписал?")}</span>
    <span>${quickSelect(lead, "owner", "Кто ведёт")}</span>
    <span>${quickSelect(lead, "result", "Результат")}</span>
    <span>${materialMarkup(lead)}</span><span class="chevron">›</span>
  </div>`;
}
function tableHeader() {
  return '<div class="lead-head"><span>Бизнес / квалификация</span><span>OLX / Сайт</span><span>Контакт</span><span>Отписал?</span><span>Кто ведёт</span><span>Результат</span><span>Материалы</span><span></span></div>';
}
function leadGroup(title, subtitle, leads, type) {
  if (!leads.length) return "";
  return `<section class="lead-group ${type}"><header><div><b>${title}</b><small>${subtitle}</small></div><strong>${leads.length}</strong></header>${tableHeader()}${leads.map(leadRow).join("")}</section>`;
}
function renderTable(leads) {
  const fresh = leads.filter((lead) => !isContacted(lead));
  const contacted = leads.filter((lead) => isContacted(lead));
  const sanya = contacted.filter((lead) => ownerGroup(lead) === "sanya");
  const stepa = contacted.filter((lead) => ownerGroup(lead) === "stepa");
  const other = contacted.filter((lead) => ownerGroup(lead) === "other");
  $("#queue-summary").textContent = leads.length
    ? `${fresh.length} нових · ${contacted.length} у роботі`
    : "";
  $("#lead-list").innerHTML = leads.length
    ? `${leadGroup("Ще не написали", "Нові — саме з них починається робота", fresh, "fresh")}${leadGroup("Вже написав Саня", "Повідомлення, матеріали та наступні дії Олександра", sanya, "contacted owner-sanya")}${leadGroup("Вже написав Стёпа", "Повідомлення, матеріали та наступні дії Стёпи", stepa, "contacted owner-stepa")}${leadGroup("Вже написали · без відповідального", "Потрібно призначити відповідального", other, "contacted owner-other")}`
    : '<div class="empty">Нічого не знайдено. Зміни фільтри або додай лід.</div>';
  $("#lead-list").classList.remove("hidden");
  $("#kanban").classList.add("hidden");
}
function renderKanban(leads) {
  const groups = [
    ["Не написали", (l) => !l.outreach_status],
    ["Написали", (l) => /так|відправ|напис|1|yes/i.test(l.outreach_status)],
    [
      "Відповіли",
      (l) =>
        /відпов|діалог|интерес|дзвін/i.test(
          `${l.outreach_status} ${l.status} ${l.result}`,
        ),
    ],
    [
      "Інше",
      (l) =>
        l.outreach_status &&
        !/так|відправ|напис|1|yes|відпов|діалог|интерес|дзвін/i.test(
          `${l.outreach_status} ${l.status} ${l.result}`,
        ),
    ],
  ];
  $("#kanban").innerHTML = groups
    .map(
      ([title, predicate]) =>
        `<section class="kanban-col"><header><span>${title}</span><b>${leads.filter(predicate).length}</b></header>${
          leads
            .filter(predicate)
            .map(
              (l) =>
                `<button class="kanban-card" data-lead="${l.id}"><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.telegram || l.phone || "Контакту немає")}</small>${tag(l.owner || "Не призначено")}<p>${escapeHtml(short(l.next_step || l.business_info || "Без наступної дії", 80))}</p></button>`,
            )
            .join("") || '<p class="muted">Порожньо</p>'
        }</section>`,
    )
    .join("");
  $("#lead-list").classList.add("hidden");
  $("#kanban").classList.remove("hidden");
}
async function loadLeads() {
  const q = new URLSearchParams({ page: state.page, pageSize: 250 });
  const map = tabs();
  if (map[state.tab]) q.set("tab", map[state.tab]);
  if (state.tab === "all") q.set("excludeTab", "Все лиды (архив)");
  if ($("#search").value.trim()) q.set("q", $("#search").value.trim());
  if ($("#status-filter").value) q.set("status", $("#status-filter").value);
  if ($("#source-filter").value) q.set("source", $("#source-filter").value);
  const result = await request(`/api/leads?${q}`);
  $("#result-count").textContent = `${result.total} лідів`;
  state.view === "table"
    ? renderTable(result.leads)
    : renderKanban(result.leads);
}
async function refresh() {
  try {
    state.dashboard = await request("/api/dashboard");
    state.options = await request("/api/options");
    renderDashboard();
    renderOptions();
    await loadLeads();
    $("#sync-label").textContent =
      `Оновлено ${new Date().toLocaleTimeString("uk-UA", { hour: "2-digit", minute: "2-digit" })}`;
  } catch (error) {
    $("#lead-list").innerHTML =
      `<div class="empty"><b>CRM поки не підключена</b><br>${escapeHtml(error.message)}<br><button class="primary inline" onclick="document.querySelector('#settings-dialog').showModal()">Підключити API</button></div>`;
  }
}
const profileFields = [
  ["name", "Назва бізнесу"],
  ["telegram", "Telegram"],
  ["phone", "Телефон"],
  ["link", "Сайт / OLX"],
  ["direction", "Ніша / напрям"],
  ["qualification", "Кваліфікація"],
  ["source", "Де знайшли"],
  ["attachment", "Фото / скрин"],
  ["business_info", "Про бізнес"],
  ["personalization", "Зацепка / персоналізація"],
];
const workflowFields = [
  ["outreach_status", "Написали / відповідь"],
  ["owner", "Хто пише"],
  ["status", "Статус CRM"],
  ["result", "Результат"],
  ["priority", "Пріоритет"],
  ["next_step", "Наступна дія"],
  ["due_date", "Коли"],
  ["first_contact_at", "Дата першого контакту"],
  ["last_contact_at", "Останній контакт"],
  ["message_variant", "Варіант повідомлення"],
  ["sent_message", "Що відправили"],
  ["pain", "Біль і цифри"],
  ["offer", "Рішення / пропозиція"],
  ["extra_message", "Додатковий текст"],
  ["comment", "Коментар"],
];
function inputFor([key, label], lead) {
  const value = lead[key] || "";
  const optionField = key === "status" ? "result" : key;
  if (workflowOptions[optionField]) {
    return `<label class="field"><span>${label}</span><select data-field="${key}" data-tone="${workflowTone(optionField, value)}">${optionMarkup(workflowOptions[optionField], value)}</select></label>`;
  }
  const multiline = [
    "business_info",
    "personalization",
    "comment",
    "sent_message",
    "offer",
    "pain",
    "extra_message",
  ].includes(key);
  const type = key === "due_date" ? "date" : "text";
  return `<label class="field ${multiline ? "wide" : ""}"><span>${label}</span>${multiline ? `<textarea data-field="${key}" rows="${key === "sent_message" ? 6 : 3}">${escapeHtml(value)}</textarea>` : `<input data-field="${key}" type="${type}" value="${escapeHtml(value)}">`}</label>`;
}
async function openLead(leadId) {
  const lead = await request(`/api/leads/${leadId}`);
  state.selected = lead;
  const contact = lead.telegram || lead.phone || "Контакт не вказано";
  const normalizedPhone = normalizeUkrainianPhone(
    lead.phone || lead.telegram || "",
  );
  const username = isTelegramUsername(lead.telegram)
    ? lead.telegram.slice(1)
    : "";
  const telegramUrl = username
    ? `https://t.me/${encodeURIComponent(username)}`
    : normalizedPhone
      ? `https://t.me/${normalizedPhone}`
      : "";
  const contactActions = `${normalizedPhone ? `<a class="contact-action" href="tel:${escapeHtml(normalizedPhone)}">Подзвонити</a>` : ""}${telegramUrl ? `<a class="contact-action" href="${escapeHtml(telegramUrl)}" target="_blank" rel="noreferrer">Написати в TG ↗</a>` : ""}`;
  const attachment = isExternalUrl(lead.attachment)
    ? `<section class="asset-card"><div><p class="eyebrow">МАТЕРІАЛИ</p><h3>Що прикріплено до ліда</h3><a href="${escapeHtml(lead.attachment)}" target="_blank" rel="noreferrer">Відкрити фото / скрин або концепт ↗</a></div><img src="${escapeHtml(lead.attachment)}" alt="Матеріал для ${escapeHtml(lead.name)}" onerror="this.remove()"></section>`
    : `<section class="asset-card empty-asset"><div><p class="eyebrow">МАТЕРІАЛИ</p><h3>Фото або концепт ще не прикріплено</h3><p>Коли матеріал з’явиться у таблиці, він буде показаний тут.</p></div></section>`;
  $("#drawer-content").innerHTML =
    `<section class="lead-identity"><p class="eyebrow">ПРОФІЛ БІЗНЕСУ · ${escapeHtml(lead.source_tab)}</p><h2>${escapeHtml(lead.name)}</h2><p>${escapeHtml(lead.direction || "Ніша не вказана")}</p><div class="lead-primary-data"><div><small>OLX / САЙТ / СОЦМЕРЕЖА</small><div class="source-chips">${sourceLinksMarkup(lead)}</div></div><div><small>КОНТАКТ</small><strong>${escapeHtml(contact)}</strong><div class="contact-actions">${contactActions || '<span class="muted">Немає прямого контакту</span>'}</div></div></div></section>
  <section class="workflow-strip"><div><small>Написали?</small>${tag(lead.outreach_status || "Не писали", statusClass(lead.outreach_status))}</div><div><small>Хто веде</small><b>${escapeHtml(lead.owner || "Не призначено")}</b></div><div><small>Результат</small>${tag(lead.status || lead.result || "Новий", statusClass(lead.status || lead.result))}</div><div><small>Наступна дія</small><b>${escapeHtml(lead.next_step || "—")}</b></div></section>
  ${attachment}
  <section class="card-section"><div class="section-head"><div><p class="eyebrow">КОНТЕКСТ</p><h3>Бізнес і джерело</h3></div><p>Те, що треба знати про самого ліда перед контактом.</p></div><div class="form-grid">${profileFields.map((field) => inputFor(field, lead)).join("")}</div></section>
  <section class="card-section workflow-section"><div class="section-head"><div><p class="eyebrow">КОМУНІКАЦІЯ</p><h3>Ведення ліда</h3></div><p>Операційні статуси й підготовка контакту.</p></div><div class="form-grid">${workflowFields.map((field) => inputFor(field, lead)).join("")}</div></section>
  <section class="notes"><div class="section-head"><div><p class="eyebrow">ІСТОРІЯ</p><h3>Нотатки по ліду</h3></div></div><form id="note-form"><textarea id="new-note" rows="3" placeholder="Що сталося, про що домовились, коли повернутись?"></textarea><button class="ghost">Додати нотатку</button></form><div class="note-list">${lead.notes.map((note) => `<article class="note"><p>${escapeHtml(note.body)}</p><small>${escapeHtml(note.author)} · ${new Date(note.created_at).toLocaleString("uk-UA")}</small></article>`).join("") || '<p class="muted">Ще немає нотаток</p>'}</div></section>`;
  $("#drawer").classList.remove("hidden");
  $("#note-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const body = $("#new-note").value.trim();
    if (!body) return;
    await request(`/api/leads/${state.selected.id}/notes`, {
      method: "POST",
      body: JSON.stringify({ body }),
    });
    await openLead(state.selected.id);
    await refresh();
  });
}
async function saveLead() {
  if (!state.selected) return;
  const update = {};
  $("#drawer-content")
    .querySelectorAll("[data-field]")
    .forEach((input) => (update[input.dataset.field] = input.value));
  await request(`/api/leads/${state.selected.id}`, {
    method: "PATCH",
    body: JSON.stringify(update),
  });
  await openLead(state.selected.id);
  await refresh();
}
async function createLead() {
  const created = await request("/api/leads", {
    method: "POST",
    body: JSON.stringify({ name: "Новий лід", status: "Новий" }),
  });
  await refresh();
  await openLead(created.id);
}

document.addEventListener("click", async (event) => {
  if (event.target.closest("[data-quick-field]")) return;
  const row = event.target.closest("[data-lead]");
  if (row) return openLead(row.dataset.lead);
  const tab = event.target.closest("[data-tab]");
  if (tab) {
    state.tab = tab.dataset.tab;
    state.page = 1;
    document
      .querySelectorAll("[data-tab]")
      .forEach((x) => x.classList.toggle("active", x === tab));
    $("#page-title").textContent = tab.textContent
      .replace(/⌘|↗|◫|▣|\d/g, "")
      .trim();
    return loadLeads();
  }
  const view = event.target.closest("[data-view]");
  if (view) {
    state.view = view.dataset.view;
    document
      .querySelectorAll("[data-view]")
      .forEach((x) => x.classList.toggle("active", x === view));
    return loadLeads();
  }
});
document.addEventListener("change", async (event) => {
  const select = event.target.closest("[data-quick-field]");
  if (!select) return;
  const field = select.dataset.quickField;
  const leadId = select.dataset.leadId;
  const value = select.value;
  const update = { [field]: value };
  if (field === "result") update.status = value || "Новый";
  select.disabled = true;
  select.dataset.tone = workflowTone(field, value);
  try {
    await request(`/api/leads/${leadId}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    });
    await refresh();
  } catch (error) {
    alert(error.message);
    await loadLeads();
  }
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" && event.key !== " ") return;
  if (event.target.closest("a, button, input, select, textarea")) return;
  const row = event.target.closest("[data-lead]");
  if (!row) return;
  event.preventDefault();
  openLead(row.dataset.lead);
});
let debounce;
$("#search").addEventListener("input", () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadLeads, 250);
});
$("#status-filter").addEventListener("change", loadLeads);
$("#source-filter").addEventListener("change", loadLeads);
$("#clear-filters").onclick = () => {
  $("#search").value = "";
  $("#status-filter").value = "";
  $("#source-filter").value = "";
  loadLeads();
};
$("#drawer-close").onclick = () => $("#drawer").classList.add("hidden");
$("#save-lead").onclick = () =>
  saveLead().catch((error) => alert(error.message));
$("#new-lead").onclick = () =>
  createLead().catch((error) => alert(error.message));
$("#settings-btn").onclick = () => {
  $("#api-url").value = state.api;
  $("#api-token").value = state.token;
  $("#settings-dialog").showModal();
};
$("#save-settings").onclick = () => {
  state.api = $("#api-url").value.trim();
  state.token = $("#api-token").value.trim();
  localStorage.setItem("crm-api-url", state.api);
  sessionStorage.setItem("crm-write-token", state.token);
  refresh();
};
refresh();
