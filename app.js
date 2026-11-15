const state = {
  api: localStorage.getItem('crm-api-url') || window.CRM_API_BASE || '',
  token: sessionStorage.getItem('crm-write-token') || '',
  tab: 'all', view: 'table', page: 1, selected: null, options: { statuses: [], sources: [] }, dashboard: null,
};
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value = '') => String(value).replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#039;', '"':'&quot;' }[c]));
const short = (value = '', size = 100) => value.length > size ? `${value.slice(0, size).trim()}…` : value;
const apiUrl = (path) => `${state.api.replace(/\/$/, '')}${path}`;
async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (state.token) headers['X-CRM-Token'] = state.token;
  const res = await fetch(apiUrl(path), { ...options, headers });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.error || `HTTP ${res.status}`);
  return payload;
}
function statusClass(value = '') { const v = value.toLowerCase(); if (/диалог|интерес|горяч|дзвін/.test(v)) return 'status hot'; if (/ожида|очіку|нов/.test(v)) return 'status warm'; if (/не акту|очищ|закры|не наша/.test(v)) return 'status cold'; return 'status'; }
function tag(value, cls = '') { return value ? `<span class="tag ${cls}">${escapeHtml(value)}</span>` : '<span class="muted">—</span>'; }
function tabs() { return { all: '', pipeline: 'Лиды TG', olx: 'OLX — открыть номер', archive: 'Все лиды (архив)' }; }
function renderOptions() {
  const fill = (selector, values, title) => $(selector).innerHTML = `<option value="">${title}</option>${values.map(x => `<option>${escapeHtml(x)}</option>`).join('')}`;
  fill('#status-filter', state.options.statuses, 'Усі статуси'); fill('#source-filter', state.options.sources, 'Усі джерела');
}
function renderDashboard() {
  const data = state.dashboard || {}; const statuses = Object.fromEntries((data.byStatus || []).map(x => [x.label, x.value]));
  const waiting = Object.entries(statuses).filter(([key]) => /ожида|очіку|нов/i.test(key)).reduce((sum, [, v]) => sum + v, 0);
  const hot = (data.byPriority || []).filter(x => /горяч/i.test(x.label)).reduce((sum, x) => sum + x.value, 0);
  $('#metric-total').textContent = data.total ?? '—'; $('#nav-total').textContent = data.total ?? '—';
  $('#metric-waiting').textContent = waiting || '—'; $('#metric-hot').textContent = hot || '—'; $('#metric-actions').textContent = (data.followUps || []).length || '—';
}
function isTelegramUsername(value = '') { return /^@[a-zA-Z0-9_]{5,}$/.test(String(value).trim()); }
function contactMarkup(lead) { return isTelegramUsername(lead.telegram) ? `<a href="https://t.me/${escapeHtml(lead.telegram.slice(1))}" target="_blank" rel="noreferrer" onclick="event.stopPropagation()">${escapeHtml(lead.telegram)}</a>` : escapeHtml(lead.phone || lead.telegram || '—'); }
function leadRow(lead) {
  return `<button class="lead-row" data-lead="${lead.id}">
    <span class="lead-main"><b>${escapeHtml(lead.name)}</b><small>${escapeHtml(lead.business_info || lead.direction || lead.link || 'Без опису')}</small></span>
    <span>${contactMarkup(lead)}</span>
    <span>${tag(lead.qualification, /горяч/i.test(lead.qualification) ? 'hot' : '')}</span>
    <span>${tag(lead.status, statusClass(lead.status))}</span>
    <span>${escapeHtml(lead.next_step || '—')}</span><span class="chevron">›</span>
  </button>`;
}
function renderTable(leads) {
  $('#lead-list').innerHTML = `<div class="lead-head"><span>Лід</span><span>Контакт</span><span>Якість</span><span>Статус</span><span>Наступна дія</span><span></span></div>${leads.map(leadRow).join('') || '<div class="empty">Нічого не знайдено. Зміни фільтри або додай лід.</div>'}`;
  $('#lead-list').classList.remove('hidden'); $('#kanban').classList.add('hidden');
}
function renderKanban(leads) {
  const groups = [['Нові', l => /нов/i.test(l.status)], ['В очікуванні', l => /ожида|очіку/i.test(l.status)], ['Діалог', l => /діалог|интерес|дзвін/i.test(l.status)], ['Інше', l => !/нов|ожида|очіку|діалог|интерес|дзвін/i.test(l.status)]];
  $('#kanban').innerHTML = groups.map(([title, predicate]) => `<section class="kanban-col"><header><span>${title}</span><b>${leads.filter(predicate).length}</b></header>${leads.filter(predicate).map(l => `<button class="kanban-card" data-lead="${l.id}"><b>${escapeHtml(l.name)}</b><small>${escapeHtml(l.telegram || l.phone || 'Контакту немає')}</small>${tag(l.qualification, /горяч/i.test(l.qualification) ? 'hot' : '')}<p>${escapeHtml(short(l.next_step || l.business_info || 'Без наступної дії', 80))}</p></button>`).join('') || '<p class="muted">Порожньо</p>'}</section>`).join('');
  $('#lead-list').classList.add('hidden'); $('#kanban').classList.remove('hidden');
}
async function loadLeads() {
  const q = new URLSearchParams({ page: state.page, pageSize: 80 }); const map = tabs();
  if (map[state.tab]) q.set('tab', map[state.tab]); if ($('#search').value.trim()) q.set('q', $('#search').value.trim()); if ($('#status-filter').value) q.set('status', $('#status-filter').value); if ($('#source-filter').value) q.set('source', $('#source-filter').value);
  const result = await request(`/api/leads?${q}`); $('#result-count').textContent = `${result.total} лідів`;
  state.view === 'table' ? renderTable(result.leads) : renderKanban(result.leads);
}
async function refresh() { try { state.dashboard = await request('/api/dashboard'); state.options = await request('/api/options'); renderDashboard(); renderOptions(); await loadLeads(); $('#sync-label').textContent = `Оновлено ${new Date().toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' })}`; } catch (error) { $('#lead-list').innerHTML = `<div class="empty"><b>CRM поки не підключена</b><br>${escapeHtml(error.message)}<br><button class="primary inline" onclick="document.querySelector('#settings-dialog').showModal()">Підключити API</button></div>`; } }
const fields = [
  ['name','Назва'], ['telegram','Telegram'], ['phone','Телефон'], ['status','Статус'], ['qualification','Кваліфікація'], ['source','Джерело'], ['direction','Напрям'], ['priority','Пріоритет'], ['next_step','Наступна дія'], ['due_date','Коли'], ['link','Сайт / OLX'], ['business_info','Про бізнес'], ['personalization','Зацепка / персоналізація'], ['comment','Коментар'], ['sent_message','Що відправив'], ['offer','Рішення / пропозиція'], ['pain','Біль і цифри'], ['extra_message','Додатковий текст']
];
function inputFor([key, label], lead) { const value = lead[key] || ''; const multiline = ['business_info','personalization','comment','sent_message','offer','pain','extra_message'].includes(key); const type = key === 'due_date' ? 'date' : 'text'; return `<label class="field ${multiline ? 'wide' : ''}"><span>${label}</span>${multiline ? `<textarea data-field="${key}" rows="${key === 'sent_message' ? 6 : 3}">${escapeHtml(value)}</textarea>` : `<input data-field="${key}" type="${type}" value="${escapeHtml(value)}">`}</label>`; }
async function openLead(leadId) {
  const lead = await request(`/api/leads/${leadId}`); state.selected = lead;
  $('#drawer-content').innerHTML = `<section class="lead-identity"><p class="eyebrow">${escapeHtml(lead.source_tab)}</p><h2>${escapeHtml(lead.name)}</h2><p>${escapeHtml(lead.telegram || lead.phone || 'Контакт не вказано')}</p></section><section class="form-grid">${fields.map(field => inputFor(field, lead)).join('')}</section><section class="notes"><div class="section-head"><h3>Історія і нотатки</h3></div><form id="note-form"><textarea id="new-note" rows="3" placeholder="Що сталося, про що домовились, коли повернутись?"></textarea><button class="ghost">Додати нотатку</button></form><div class="note-list">${lead.notes.map(note => `<article class="note"><p>${escapeHtml(note.body)}</p><small>${escapeHtml(note.author)} · ${new Date(note.created_at).toLocaleString('uk-UA')}</small></article>`).join('') || '<p class="muted">Ще немає нотаток</p>'}</div></section>`;
  $('#drawer').classList.remove('hidden');
  $('#note-form').addEventListener('submit', async event => { event.preventDefault(); const body = $('#new-note').value.trim(); if (!body) return; await request(`/api/leads/${state.selected.id}/notes`, { method: 'POST', body: JSON.stringify({ body }) }); await openLead(state.selected.id); await refresh(); });
}
async function saveLead() {
  if (!state.selected) return; const update = {}; $('#drawer-content').querySelectorAll('[data-field]').forEach(input => update[input.dataset.field] = input.value); await request(`/api/leads/${state.selected.id}`, { method: 'PATCH', body: JSON.stringify(update) }); await openLead(state.selected.id); await refresh();
}
async function createLead() { const created = await request('/api/leads', { method: 'POST', body: JSON.stringify({ name: 'Новий лід', status: 'Новий' }) }); await refresh(); await openLead(created.id); }

document.addEventListener('click', async event => {
  const row = event.target.closest('[data-lead]'); if (row) return openLead(row.dataset.lead);
  const tab = event.target.closest('[data-tab]'); if (tab) { state.tab = tab.dataset.tab; state.page = 1; document.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === tab)); $('#page-title').textContent = tab.textContent.replace(/⌘|↗|◫|▣|\d/g, '').trim(); return loadLeads(); }
  const view = event.target.closest('[data-view]'); if (view) { state.view = view.dataset.view; document.querySelectorAll('[data-view]').forEach(x => x.classList.toggle('active', x === view)); return loadLeads(); }
});
let debounce; $('#search').addEventListener('input', () => { clearTimeout(debounce); debounce = setTimeout(loadLeads, 250); }); $('#status-filter').addEventListener('change', loadLeads); $('#source-filter').addEventListener('change', loadLeads);
$('#clear-filters').onclick = () => { $('#search').value = ''; $('#status-filter').value = ''; $('#source-filter').value = ''; loadLeads(); };
$('#drawer-close').onclick = () => $('#drawer').classList.add('hidden'); $('#save-lead').onclick = () => saveLead().catch(error => alert(error.message)); $('#new-lead').onclick = () => createLead().catch(error => alert(error.message));
$('#settings-btn').onclick = () => { $('#api-url').value = state.api; $('#api-token').value = state.token; $('#settings-dialog').showModal(); };
$('#save-settings').onclick = () => { state.api = $('#api-url').value.trim(); state.token = $('#api-token').value.trim(); localStorage.setItem('crm-api-url', state.api); sessionStorage.setItem('crm-write-token', state.token); refresh(); };
refresh();
