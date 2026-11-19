const state = {
  api: localStorage.getItem("crm-api-url") || window.CRM_API_BASE || "",
  sessionToken: sessionStorage.getItem("life-session-token") || "",
  user: null,
  authConfig: null,
  section: location.hash.startsWith("#/crm/") ? "crm" : (localStorage.getItem("life-active-section") || "dashboard"),
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
  if (state.sessionToken) headers["X-Session-Token"] = state.sessionToken;
  const res = await fetch(apiUrl(path), { ...options, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}
function authMessage(message = "", tone = "") {
  const element = $("#auth-message");
  if (!element) return;
  element.textContent = message;
  element.dataset.tone = tone;
}
function renderAccount() {
  const button = $("#account-btn");
  if (!button) return;
  const user = state.user;
  button.hidden = false;
  button.textContent = user
    ? `${user.name || user.email} · Вийти`
    : "Увійти";
  button.title = user ? `Вийти з ${user.email}` : "Увійти";
}
function passwordField({ name, id, autocomplete, label, minLength = "", placeholder = "", value = "" }) {
  return `<label>${label}<span class="password-field"><input id="${id}" name="${name}" type="password"${minLength ? ` minlength="${minLength}"` : ""} autocomplete="${autocomplete}"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ""}${value ? ` value="${escapeHtml(value)}"` : ""} required><button class="password-toggle" type="button" data-password-toggle="${id}" aria-controls="${id}" aria-pressed="false" title="Показати">Показати</button></span></label>`;
}
function authTemplate(mode = "login") {
  const recoveryEnabled = Boolean(
    state.authConfig?.password_recovery_configured,
  );
  const resetToken = new URLSearchParams(window.location.search).get("reset");
  if (resetToken) {
    return `<form class="auth-form" id="auth-reset-form">
      <p class="eyebrow">БЕЗПЕКА</p><h1>Новий пароль</h1>
      <p>Створи новий пароль для свого акаунта.</p>
      ${passwordField({ name: "password", id: "reset-password", label: "Новий пароль", minLength: 12, autocomplete: "new-password" })}
      ${passwordField({ name: "password_confirm", id: "reset-password-confirm", label: "Повтори пароль", minLength: 12, autocomplete: "new-password" })}
      <button class="primary" type="submit">Зберегти новий пароль</button>
      <p class="auth-browser-hint">Після зміни браузер може запропонувати зберегти новий пароль.</p>
      <button class="auth-link" type="button" data-auth-mode="login">Повернутись до входу</button>
    </form>`;
  }
  if (mode === "forgot") {
    return `<form class="auth-form" id="auth-forgot-form">
      <p class="eyebrow">ВІДНОВЛЕННЯ ДОСТУПУ</p><h1>Посилання для входу</h1>
      <p>${recoveryEnabled ? "Надішлемо посилання для зміни пароля." : "Відновлення через email ще не підключено. Скористайся обліковим записом власника."}</p>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      <button class="primary" type="submit" ${recoveryEnabled ? "" : "disabled"}>Надіслати посилання</button>
      <button class="auth-link" type="button" data-auth-mode="login">Назад до входу</button>
    </form>`;
  }
  if (state.authConfig?.bootstrap_required || mode === "register") {
    return `<form class="auth-form" id="auth-register-form" autocomplete="on">
      <p class="eyebrow">ПЕРШИЙ ЗАПУСК</p><h1>Створи акаунт власника</h1>
      <p>Існуючі ліди будуть безпечно прив’язані до цього акаунта. Для входу потрібні лише email і пароль.</p>
      <label>Ім’я<input name="name" autocomplete="name" maxlength="120" required></label>
      <label>Email<input name="email" type="email" autocomplete="email" required></label>
      ${passwordField({ name: "password", id: "register-password", label: "Пароль", minLength: 12, autocomplete: "new-password" })}
      <button class="primary" type="submit">Створити захищений акаунт</button>
      <small>Пароль — від 12 символів. Браузер запропонує зберегти його після створення акаунта.</small>
    </form>`;
  }
  return `<form class="auth-form" id="auth-login-form" autocomplete="on">
    <p class="eyebrow">SKYBREEZE · ОСОБИСТА CRM</p><h1>Радий бачити</h1>
    <p>Увійди, щоб побачити лише свої дані та продовжити роботу.</p>
    <label>Email<input name="email" type="email" autocomplete="email" required></label>
    ${passwordField({ name: "password", id: "login-password", label: "Пароль", autocomplete: "current-password" })}
    <button class="primary" type="submit">Увійти</button>
    <p class="auth-browser-hint">Після успішного входу Chrome запропонує зберегти пароль — натисни «Зберегти».</p>
    <button class="auth-link" type="button" data-auth-mode="forgot">Не пам’ятаю пароль</button>
  </form>`;
}
function showAuthGate({ mode = "login", message = "", tone = "" } = {}) {
  const gate = $("#auth-gate");
  if (!gate) return;
  document.body.classList.add("auth-open");
  gate.hidden = false;
  gate.innerHTML = `<div class="auth-card"><div class="auth-mark">SB</div>${authTemplate(mode)}<p id="auth-message" class="auth-message" data-tone="${escapeHtml(tone)}"></p></div>`;
  authMessage(message, tone);
  gate.querySelector("input")?.focus();
}
function hideAuthGate() {
  document.body.classList.remove("auth-open");
  $("#auth-gate").hidden = true;
}
async function acceptSession(payload) {
  state.sessionToken = payload.session_token;
  state.user = payload.user || state.user;
  sessionStorage.setItem("life-session-token", state.sessionToken);
  renderAccount();
  hideAuthGate();
  await refresh();
  window.SkyBreezeLife?.activate(state.section);
}
async function bootstrapApp() {
  try {
    const [session, config] = await Promise.all([
      request("/api/auth/session"),
      request("/api/auth/bootstrap"),
    ]);
    state.authConfig = config;
    if (!session.authenticated) return showAuthGate();
    state.user = session.user;
    renderAccount();
    hideAuthGate();
    await refresh();
    window.SkyBreezeLife?.activate(state.section);
  } catch (error) {
    showAuthGate({
      message: `${error.message}. Перевір адресу API або онови сервер CRM.`,
      tone: "error",
    });
  }
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
function normalizeExternalUrl(value = "") {
  const raw = String(value || "").trim().replace(/^[([{'"`]+|[)\]}',.;!?]+$/g, "");
  if (!raw) return "";
  try {
    const candidate = /^[a-z][a-z\d+.-]*:/i.test(raw) ? raw : `https://${raw.replace(/^\/\/+/, "")}`;
    const url = new URL(candidate);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}
function isExternalUrl(value = "") { return Boolean(normalizeExternalUrl(value)); }
function extractUrls(...values) {
  const found = [];
  for (const value of values.flat()) {
    const matches = String(value || "").match(/(?:https?:\/\/)?(?:www\.)?(?:[a-z\d-]+\.)+(?:ua|com|net|org|me|io|app|site|biz|info)(?:[/?#][^\s<>"']*)?/gi) || [];
    for (const match of matches) {
      const clean = normalizeExternalUrl(match);
      if (clean && !found.includes(clean)) found.push(clean);
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
        `<a class="source-chip ${cls}" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${label}</a>`,
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
  return `<span class="contact-stack"><span>${escapeHtml(display)}</span>${telegramUrl ? `<a href="${escapeHtml(telegramUrl)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Написати в Telegram</a>` : ""}</span>`;
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
  const attachment = normalizeExternalUrl(lead.attachment);
  if (!attachment) return '<span class="muted">Немає</span>';
  return `<a class="material-link" href="${escapeHtml(attachment)}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">Фото / концепт</a>`;
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
function emptyOptionLabel(field) {
  return {
    outreach_status: "Не отписал",
    owner: "Не назначено",
    result: "Новый",
    qualification: "Без квалификации",
  }[field] || "Не выбрано";
}
function optionMarkup(options, selected, field) {
  return options
    .map(
      (value) =>
        `<option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>${escapeHtml(value || emptyOptionLabel(field))}</option>`,
    )
    .join("");
}
function quickSelect(lead, field, label) {
  const value = String(lead[field] || "");
  return `<label class="quick-field" title="${escapeHtml(label)}"><span>${escapeHtml(label)}</span><select class="quick-select" data-quick-field="${field}" data-lead-id="${lead.id}" data-tone="${workflowTone(field, value)}" aria-label="${escapeHtml(label)}">${optionMarkup(workflowOptions[field], value, field)}</select></label>`;
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
    if (/увійти|токен доступу/i.test(error.message)) {
      return showAuthGate({ message: error.message, tone: "error" });
    }
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
    return `<label class="field"><span>${label}</span><select data-field="${key}" data-tone="${workflowTone(optionField, value)}">${optionMarkup(workflowOptions[optionField], value, optionField)}</select></label>`;
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
  state.drawerReturnFocus = document.activeElement;
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
  const contactActions = `${normalizedPhone ? `<a class="contact-action" href="tel:${escapeHtml(normalizedPhone)}">Подзвонити</a>` : ""}${telegramUrl ? `<a class="contact-action" href="${escapeHtml(telegramUrl)}" target="_blank" rel="noreferrer">Написати в Telegram</a>` : ""}`;
  const attachmentUrl = normalizeExternalUrl(lead.attachment);
  const attachment = attachmentUrl
    ? `<section class="asset-card"><div><p class="eyebrow">МАТЕРІАЛИ</p><h3>Що прикріплено до ліда</h3><a href="${escapeHtml(attachmentUrl)}" target="_blank" rel="noreferrer">Відкрити фото, скрин або концепт</a></div><img src="${escapeHtml(attachmentUrl)}" alt="Матеріал для ${escapeHtml(lead.name)}" onerror="this.remove()"></section>`
    : `<section class="asset-card empty-asset"><div><p class="eyebrow">МАТЕРІАЛИ</p><h3>Фото або концепт ще не прикріплено</h3><p>Коли матеріал з’явиться у таблиці, він буде показаний тут.</p></div></section>`;
  $("#drawer-content").innerHTML =
    `<section class="lead-identity"><p class="eyebrow">ПРОФІЛ БІЗНЕСУ · ${escapeHtml(lead.source_tab)}</p><h2>${escapeHtml(lead.name)}</h2><p>${escapeHtml(lead.direction || "Ніша не вказана")}</p><div class="lead-primary-data"><div><small>OLX / САЙТ / СОЦМЕРЕЖА</small><div class="source-chips">${sourceLinksMarkup(lead)}</div></div><div><small>КОНТАКТ</small><strong>${escapeHtml(contact)}</strong><div class="contact-actions">${contactActions || '<span class="muted">Немає прямого контакту</span>'}</div></div></div></section>
  <section class="workflow-strip"><div><small>Написали?</small>${tag(lead.outreach_status || "Не писали", statusClass(lead.outreach_status))}</div><div><small>Хто веде</small><b>${escapeHtml(lead.owner || "Не призначено")}</b></div><div><small>Результат</small>${tag(lead.status || lead.result || "Новий", statusClass(lead.status || lead.result))}</div><div><small>Наступна дія</small><b>${escapeHtml(lead.next_step || "—")}</b></div></section>
  ${attachment}
  <section class="card-section"><div class="section-head"><div><p class="eyebrow">КОНТЕКСТ</p><h3>Бізнес і джерело</h3></div><p>Те, що треба знати про самого ліда перед контактом.</p></div><div class="form-grid">${profileFields.map((field) => inputFor(field, lead)).join("")}</div></section>
  <section class="card-section workflow-section"><div class="section-head"><div><p class="eyebrow">КОМУНІКАЦІЯ</p><h3>Ведення ліда</h3></div><p>Операційні статуси й підготовка контакту.</p></div><div class="form-grid">${workflowFields.map((field) => inputFor(field, lead)).join("")}</div></section>
  <section class="notes"><div class="section-head"><div><p class="eyebrow">ІСТОРІЯ</p><h3>Нотатки по ліду</h3></div></div><form id="note-form"><textarea id="new-note" rows="3" placeholder="Що сталося, про що домовились, коли повернутись?"></textarea><button class="ghost">Додати нотатку</button></form><div class="note-list">${lead.notes.map((note) => `<article class="note"><p>${escapeHtml(note.body)}</p><small>${escapeHtml(note.author)} · ${new Date(note.created_at).toLocaleString("uk-UA")}</small></article>`).join("") || '<p class="muted">Ще немає нотаток</p>'}</div></section>`;
  $("#drawer").classList.remove("hidden");
  $("#drawer-backdrop").classList.remove("hidden");
  document.body.classList.add("drawer-open");
  $("#drawer-close").focus({ preventScroll: true });
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
function closeLead() {
  if ($("#drawer").classList.contains("hidden")) return;
  $("#drawer").classList.add("hidden");
  $("#drawer-backdrop").classList.add("hidden");
  document.body.classList.remove("drawer-open");
  state.selected = null;
  if (state.drawerReturnFocus?.focus) {
    state.drawerReturnFocus.focus({ preventScroll: true });
  }
  state.drawerReturnFocus = null;
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

document.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!/^auth-(login|register|forgot|reset)-form$/.test(form.id)) return;
  event.preventDefault();
  const submit = form.querySelector('button[type="submit"]');
  submit.disabled = true;
  const data = new FormData(form);
  try {
    if (form.id === "auth-login-form") {
      const payload = await request("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      return acceptSession(payload);
    }
    if (form.id === "auth-register-form") {
      const payload = await request("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
        }),
      });
      state.authConfig = { ...state.authConfig, bootstrap_required: false };
      return acceptSession(payload);
    }
    if (form.id === "auth-forgot-form") {
      await request("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email: data.get("email") }),
      });
      authMessage("Якщо адреса зареєстрована, посилання вже надіслано.", "success");
      return;
    }
    if (form.id === "auth-reset-form") {
      const password = String(data.get("password") || "");
      if (password !== String(data.get("password_confirm") || ""))
        throw new Error("Паролі не співпадають");
      const token = new URLSearchParams(window.location.search).get("reset");
      await request("/api/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      window.history.replaceState({}, "", window.location.pathname);
      return showAuthGate({
        message: "Пароль змінено. Тепер увійди з новим паролем.",
        tone: "success",
      });
    }
  } catch (error) {
    authMessage(error.message || "Не вдалося виконати дію", "error");
  } finally {
    if (document.contains(submit)) submit.disabled = false;
  }
});
document.addEventListener("click", async (event) => {
  const passwordToggle = event.target.closest("[data-password-toggle]");
  if (passwordToggle) {
    const input = document.getElementById(passwordToggle.dataset.passwordToggle);
    if (!input) return;
    const isVisible = input.type === "text";
    input.type = isVisible ? "password" : "text";
    passwordToggle.textContent = isVisible ? "Показати" : "Сховати";
    passwordToggle.title = isVisible ? "Показати" : "Сховати";
    passwordToggle.setAttribute("aria-pressed", String(!isVisible));
    return;
  }
  const mode = event.target.closest("[data-auth-mode]")?.dataset.authMode;
  if (mode) return showAuthGate({ mode });
  if (event.target.closest("#account-btn")) {
    if (!state.user) return showAuthGate();
    try {
      await request("/api/auth/logout", { method: "POST" });
    } catch {
      // The local session must still be cleared if a stale server is offline.
    }
    state.sessionToken = "";
    state.user = null;
    sessionStorage.removeItem("life-session-token");
    renderAccount();
    return showAuthGate({ message: "Ти вийшов з акаунта.", tone: "success" });
  }
});

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
    state.section = "crm";
    localStorage.setItem("life-active-section", state.section);
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
  // The lead profile is a true modal surface: Escape must close it regardless
  // of which field currently has focus (including a textarea or select).
  if (event.key === "Escape" && !$("#drawer").classList.contains("hidden")) {
    event.preventDefault();
    event.stopPropagation();
    closeLead();
    return;
  }
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
$("#drawer-close").onclick = closeLead;
$("#drawer-backdrop").onclick = closeLead;
$("#save-lead").onclick = () =>
  saveLead().catch((error) => alert(error.message));
$("#new-lead").onclick = () =>
  createLead().catch((error) => alert(error.message));
$("#settings-btn").onclick = () => {
  $("#api-url").value = state.api;
  $("#settings-dialog").showModal();
};
$("#save-settings").onclick = () => {
  state.api = $("#api-url").value.trim();
  localStorage.setItem("crm-api-url", state.api);
  bootstrapApp();
};
window.SkyBreezeApp = { state, request, refreshCrm: refresh, escapeHtml };
window.dispatchEvent(new Event("skybreeze-app-ready"));
bootstrapApp();
