(() => {
  const $ = (selector) => document.querySelector(selector);
  const app = () => window.SkyBreezeApp;
  const api = (...args) => app().request(...args);
  const escape = (value = "") => app().escapeHtml(value);
  const dateKey = (value = new Date()) => new Date(value).toISOString().slice(0, 10);
  const today = () => dateKey();
  const money = (value, currency = "UAH") =>
    new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 0 }).format(Number(value || 0)) +
    (currency ? ` ${currency}` : "");
  const number = (value, fallback = "—") =>
    value == null || Number.isNaN(Number(value)) ? fallback : new Intl.NumberFormat("uk-UA", { maximumFractionDigits: 1 }).format(Number(value));
  const formatDate = (value) => {
    if (!value) return "Без дати";
    const date = new Date(`${value}`.slice(0, 10));
    return Number.isNaN(date.valueOf()) ? String(value) : date.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
  };
  const statusLabel = {
    inbox: "Вхідні",
    month: "Місяць",
    week: "Тиждень",
    today: "Сьогодні",
    done: "Готово",
    archived: "Архів",
    planned: "Заплановано",
    completed: "Виконано",
    skipped: "Пропущено",
  };
  const state = { view: null, workoutId: null, loaded: 0 };

  function page(eyebrow, title, subtitle, body, actions = "") {
    const quickNutrition = eyebrow.startsWith("ХАРЧУВАННЯ") ? '<button class="ghost" type="button" data-quick-tea>+ Чай · 2 ч. л. цукру</button>' : "";
    return `<header class="life-topbar"><div><p class="eyebrow">${eyebrow}</p><h1>${title}</h1><p>${subtitle}</p></div><div class="life-top-actions">${quickNutrition}${actions}</div></header>${body}`;
  }
  function card(title, value, note = "", tone = "") {
    return `<article class="life-card ${tone}"><span>${escape(title)}</span><strong>${value}</strong><small>${escape(note)}</small></article>`;
  }
  function empty(title, text) {
    return `<div class="life-empty"><b>${escape(title)}</b><p>${escape(text)}</p></div>`;
  }
  function taskCard(task, compact = false) {
    const detail = [task.project_title, task.goal_title, task.due_date ? `до ${formatDate(task.due_date)}` : ""].filter(Boolean).join(" · ");
    return `<article class="task-card priority-${escape(task.priority)}">
      <div class="task-card-copy"><span class="task-status">${escape(statusLabel[task.status] || task.status)}</span><b>${escape(task.title)}</b>${detail ? `<small>${escape(detail)}</small>` : ""}${!compact && task.notes ? `<p>${escape(task.notes)}</p>` : ""}</div>
      <div class="task-card-actions"><button class="life-icon-action" type="button" data-task-edit="${task.id}" title="Редагувати задачу" aria-label="Редагувати задачу">✎</button>${task.status !== "done" && task.status !== "archived" ? `<button class="life-icon-action" type="button" data-task-transition="${task.id}" data-task-status="done" title="Позначити виконаною" aria-label="Позначити виконаною">✓</button><button class="life-icon-action" type="button" data-task-transition="${task.id}" data-task-status="${task.status === "today" ? "week" : "today"}" title="${task.status === "today" ? "Перенести на тиждень" : "Додати в сьогодні"}" aria-label="${task.status === "today" ? "Перенести на тиждень" : "Додати в сьогодні"}">↗</button>` : ""}<button class="life-icon-action danger" type="button" data-task-delete="${task.id}" title="Видалити задачу" aria-label="Видалити задачу">×</button></div>
    </article>`;
  }
  function taskList(title, tasks, detail) {
    return `<section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">${escape(detail)}</p><h2>${escape(title)}</h2></div><span class="count-badge">${tasks.length}</span></div>${tasks.length ? `<div class="task-stack">${tasks.map((task) => taskCard(task)).join("")}</div>` : empty("Поки порожньо", "Додай одну конкретну дію — вона з’явиться тут.")}</section>`;
  }
  function selectOptions(items, selected, emptyLabel = "Не обрано") {
    return `<option value="">${escape(emptyLabel)}</option>${items.map((item) => `<option value="${escape(item.id)}"${item.id === selected ? " selected" : ""}>${escape(item.title)}</option>`).join("")}`;
  }
  function taskEditorMarkup(task, projects, goals, isNew = false) {
    const status = task.status || "today";
    const priority = task.priority || "normal";
    return `<dialog class="task-editor-dialog" id="task-editor-dialog" aria-labelledby="task-editor-title"><form class="task-editor" data-life-form="task-editor" data-task-id="${escape(task.id || "")}" data-original-status="${escape(status)}"><header><div><p class="eyebrow">${isNew ? "ШВИДКА ЗАДАЧА" : "РЕДАГУВАННЯ ЗАДАЧІ"}</p><h2 id="task-editor-title">${isNew ? "Додати дію" : "Змінити задачу"}</h2></div><button class="icon-button" type="button" data-task-editor-close aria-label="Закрити">×</button></header><label>Що зробити<input name="title" maxlength="220" required autofocus value="${escape(task.title || "")}" placeholder="Один зрозумілий наступний крок"></label><div class="form-row"><label>Коли<select name="status">${["today", "week", "month", "inbox", "done", "archived"].map((value) => `<option value="${value}"${value === status ? " selected" : ""}>${statusLabel[value]}</option>`).join("")}</select></label><label>Пріоритет<select name="priority">${["high", "normal", "low"].map((value) => `<option value="${value}"${value === priority ? " selected" : ""}>${({ high: "Високий", normal: "Звичайний", low: "Низький" })[value]}</option>`).join("")}</select></label></div><div class="form-row"><label>Дедлайн<input name="due_date" type="date" value="${escape(task.due_date || "")}"></label><label>Оцінка, хв<input name="estimate_minutes" type="number" min="1" max="1440" inputmode="numeric" value="${task.estimate_minutes ?? ""}"></label></div><div class="form-row"><label>Проєкт<select name="project_id">${selectOptions(projects, task.project_id || "", "Без проєкту")}</select></label><label>Ціль<select name="goal_id">${selectOptions(goals, task.goal_id || "", "Без цілі")}</select></label></div><label>Нотатка<textarea name="notes" rows="3" placeholder="Контекст, посилання або критерій готовності">${escape(task.notes || "")}</textarea></label><footer>${!isNew && status !== "archived" ? `<button class="danger-quiet" type="button" data-task-transition="${escape(task.id)}" data-task-status="archived">В архів</button>` : ""}<span></span><button class="ghost" type="button" data-task-editor-close>Скасувати</button><button class="primary" type="submit">${isNew ? "Додати" : "Зберегти"}</button></footer></form></dialog>`;
  }
  async function openTaskEditor(taskId = "") {
    setMessage("");
    document.querySelector("#task-editor-dialog")?.remove();
    const [taskData, projectsData, goalsData] = await Promise.all([
      taskId ? api(`/api/life/tasks/${taskId}`) : Promise.resolve({ status: "today", priority: "normal", due_date: "", estimate_minutes: "", title: "", notes: "" }),
      api("/api/life/projects"),
      api("/api/life/goals"),
    ]);
    document.body.insertAdjacentHTML("beforeend", taskEditorMarkup(taskData, projectsData.projects || [], goalsData.goals || [], !taskId));
    const dialog = document.querySelector("#task-editor-dialog");
    dialog.addEventListener("close", () => dialog.remove(), { once: true });
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  }
  function setMessage(message = "", tone = "") {
    const node = $("#life-form-message");
    if (!node) return;
    node.textContent = message;
    node.dataset.tone = tone;
  }
  function isCurrent(view, ticket) {
    return state.view === view && state.loaded === ticket;
  }

  async function renderDashboard(ticket) {
    const data = await api("/api/life/dashboard");
    if (!isCurrent("dashboard", ticket)) return;
    const nutrition = data.nutrition || {};
    const outreach = data.outreach || {};
    const taskMarkup = (data.priority_tasks || []).map((task) => taskCard(task, true)).join("") || empty("Фокус ще не обраний", "Створи одну задачу на сьогодні у Планері.");
    $("#life-view").innerHTML = page(
      "LIFE OS · СЬОГОДНІ",
      "Спокійний план на день",
      `Огляд на ${formatDate(data.today)}. Тут лише зафіксовані дані — без медичних висновків та вигаданих прогнозів.`,
      `<div class="life-metrics">${card("Виконано цього тижня", `${data.week?.completed_tasks || 0}`, `${data.week?.completion_percent || 0}% від запланованого`, "mint")}${card("Харчування сьогодні", `${nutrition.meals || 0}`, `${number(nutrition.protein_g, "—")} г білка · ${number(nutrition.calories, "—")} ккал`, "blue")}${card("Вода", nutrition.water_ml == null ? "—" : `${number(nutrition.water_ml)} мл`, "Запису за сьогодні немає — це нормально", "orange")}${card("Outreach", `${outreach.sent || 0}/${outreach.leads || 0}`, `${outreach.replies || 0} відповідей · ${outreach.calls || 0} дзвінків`, "violet")}</div>
      <div class="life-dashboard-grid"><section class="life-panel life-focus-panel"><div class="life-section-heading"><div><p class="eyebrow">ГОЛОВНИЙ ФОКУС</p><h2>${data.main_task ? escape(data.main_task.title) : "Без обраної задачі"}</h2></div><button class="ghost" type="button" data-life-open="planner">Відкрити планер</button></div>${data.main_task ? `<p class="focus-note">${escape(data.main_task.notes || "Одна зрозуміла дія важливіша за довгий список.")}</p><div class="focus-meta"><span>${escape(statusLabel[data.main_task.status])}</span>${data.main_task.due_date ? `<span>до ${formatDate(data.main_task.due_date)}</span>` : ""}</div><button class="primary" type="button" data-task-transition="${data.main_task.id}" data-task-status="done">Позначити виконаною</button>` : `<p class="focus-note">Почни з короткої конкретної задачі — її можна запланувати безпосередньо у Планері.</p>`}</section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">НАСТУПНІ КРОКИ</p><h2>Три пріоритети</h2></div></div><div class="task-stack compact">${taskMarkup}</div></section></div>
      <div class="life-dashboard-grid lower"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ТРЕНУВАННЯ</p><h2>${data.today_workout ? escape(data.today_workout.title) : "На сьогодні не заплановано"}</h2></div><button class="ghost" type="button" data-life-open="training">Журнал</button></div><p class="life-quiet">${data.today_workout ? `${escape(statusLabel[data.today_workout.status])} · ${formatDate(data.today_workout.scheduled_date)}` : "План тренування з’явиться після того, як ти створиш шаблон або заплануєш сесію."}</p></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ВАГА</p><h2>${data.weights?.[0]?.weight_kg ? `${number(data.weights[0].weight_kg)} кг` : "Немає записів"}</h2></div><button class="ghost" type="button" data-life-open="nutrition">Харчування</button></div><p class="life-quiet">${data.weights?.length > 1 ? `${data.weights.length} останніх записів доступні в модулі харчування.` : "Фіксуй факт вимірювання без інтерпретації."}</p></section></div>
      <div class="life-dashboard-grid lower"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">НАПРЯМОК</p><h2>Цілі</h2></div><button class="ghost" type="button" data-life-open="planner">Планер</button></div>${data.active_goals?.length ? `<div class="fact-table">${data.active_goals.map((goal) => `<div><b>${escape(goal.title)}</b><span>${escape({ year: "Рік", quarter: "90 днів", month: "Місяць" }[goal.period] || goal.period)}</span><small>${goal.target_value != null ? `${number(goal.current_value)} / ${number(goal.target_value)} ${escape(goal.unit)}` : "Без числового показника"}</small></div>`).join("")}</div>` : '<p class="life-quiet">Почни з однієї цілі на рік та одного результату на 90 днів.</p>'}</section><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ФІНАНСИ ТИЖНЯ</p><h2>Бізнес і накопичення</h2></div><button class="ghost" type="button" data-life-open="finance">Фінанси</button></div>${Object.entries(data.finance?.business || {}).length ? Object.entries(data.finance.business).map(([currency, values]) => `<p class="life-quiet"><b>${escape(currency)}</b> · дохід ${money(values.income, currency)} · витрати ${money(values.expense, currency)} · прибуток ${money(values.profit, currency)}</p>`).join("") : '<p class="life-quiet">Фактичних бізнес-операцій за тиждень ще немає.</p>'}${data.savings_goals?.length ? `<div class="fact-table">${data.savings_goals.map((goal) => `<div><b>${escape(goal.title)}</b><span>${money(goal.current_amount, goal.currency)} з ${money(goal.target_amount, goal.currency)}</span></div>`).join("")}</div>` : ""}</section></div>`,
      `<button class="ghost" type="button" data-life-open="planner">+ Нова задача</button>`,
    );
  }

  async function renderToday(ticket) {
    const [dashboard, tasks, reviewData, sleepData, mentorData, habitData] = await Promise.all([
      api("/api/life/dashboard"), api(`/api/life/tasks?date=${today()}`), api(`/api/life/daily-review?date=${today()}`), api("/api/life/sleep"), api("/api/life/mentor-notes"), api(`/api/life/habits?from=${today()}&to=${today()}`),
    ]);
    if (!isCurrent("today", ticket)) return;
    const todayTasks = (tasks.tasks || []).filter((task) => task.status === "today");
    const review = reviewData.review || {};
    const sleep = (sleepData.entries || []).find((entry) => entry.recorded_on === today()) || {};
    const checked = new Set((habitData.checkins || []).map((entry) => entry.habit_id));
    const sundayHabits = (habitData.habits || []).filter((habit) => habit.cadence === "weekly" && habit.weekday === 0);
    $("#life-view").innerHTML = page(
      "СЬОГОДНІ · ДІЇ, НЕ СПИСОК ПЛАНІВ",
      "Мій день",
      "Один головний результат, до трьох додаткових задач і коротка чесна фіксація ввечері.",
      `<div class="life-dashboard-grid"><section class="life-panel life-focus-panel"><div class="life-section-heading"><div><p class="eyebrow">ГОЛОВНИЙ РЕЗУЛЬТАТ</p><h2>${dashboard.main_task ? escape(dashboard.main_task.title) : "Ще не обрано"}</h2></div><button class="ghost" type="button" data-life-open="planner">Обрати</button></div>${dashboard.main_task ? `<p class="focus-note">${escape(dashboard.main_task.notes || "Зроби наступний конкретний крок.")}</p><button class="primary" type="button" data-task-transition="${dashboard.main_task.id}" data-task-status="done">Готово</button>` : '<p class="focus-note">Створи одну задачу зі статусом «Сьогодні» у планері.</p>'}</section>${taskList("Додаткові дії", todayTasks.filter((task) => task.id !== dashboard.main_task?.id).slice(0, 3), "2–3 ЗАДАЧІ")}</div>
      <div class="today-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ЗОБОВ’ЯЗАННЯ</p><h2>Дедлайни і follow-up</h2></div></div>${dashboard.due_tasks?.length ? `<div class="task-stack">${dashboard.due_tasks.map((task) => taskCard(task, true)).join("")}</div>` : '<p class="life-quiet">Немає найближчих особистих дедлайнів.</p>'}${dashboard.upcoming_crm_tasks?.length ? `<div class="fact-table">${dashboard.upcoming_crm_tasks.map((item) => `<div><b>${escape(item.lead_name || "CRM-задача")}</b><span>${escape(item.task_type)} · ${formatDate(item.due_at)}</span><small>${escape(item.comment || "Без коментаря")}</small></div>`).join("")}</div>` : '<p class="life-quiet">Відкритих CRM follow-up на найближчий тиждень немає.</p>'}</section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">РЕЖИМ</p><h2>Сон і самопочуття</h2></div></div><form class="life-form compact-form" data-life-form="sleep"><input name="recorded_on" type="hidden" value="${today()}"><div class="form-row"><label>У ліжко<input name="bedtime" type="time" value="${escape(sleep.bedtime || "")}"></label><label>Заснув приблизно<input name="asleep_at" type="time" value="${escape(sleep.asleep_at || "")}"></label></div><div class="form-row"><label>Прокинувся<input name="woke_at" type="time" value="${escape(sleep.woke_at || "")}"></label><label>Якість 1–5<input name="quality" type="number" min="1" max="5" value="${sleep.quality ?? ""}"></label></div><label>Самопочуття / напруга<textarea name="wellbeing_note" rows="2">${escape(sleep.wellbeing_note || "")}</textarea></label><button class="ghost" type="submit">Зберегти</button></form></section></div>
      <div class="today-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ВЕЧІРНІЙ ЗВІТ</p><h2>Кілька хвилин на факт</h2></div></div><form class="life-form compact-form" data-life-form="daily-review"><input name="recorded_on" type="hidden" value="${today()}"><label>Головна задача<select name="main_task_id">${selectOptions(todayTasks, review.main_task_id || dashboard.main_task?.id || "", "Не обрано")}</select></label><label>Що сьогодні зробив?<textarea name="completed_summary" rows="2">${escape(review.completed_summary || "")}</textarea></label><label>Головний результат<textarea name="main_result" rows="2">${escape(review.main_result || "")}</textarea></label><label>Що просунуло цілі?<textarea name="progress_summary" rows="2">${escape(review.progress_summary || "")}</textarea></label><label>Що не вийшло і чому?<textarea name="blocker_summary" rows="2">${escape(review.blocker_summary || "")}</textarea></label><label>Важливо завтра<textarea name="tomorrow_focus" rows="2">${escape(review.tomorrow_focus || "")}</textarea></label><button class="primary" type="submit">Зберегти звіт</button></form></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ОТОЧЕННЯ ТА ЗВИЧКИ</p><h2>Тижневі опори</h2></div></div>${sundayHabits.length ? `<div class="task-stack">${sundayHabits.map((habit) => `<article class="task-card"><div class="task-card-copy"><b>${escape(habit.title)}</b><small>Неділя · без серій та оцінок</small></div>${checked.has(habit.id) ? '<span class="status-pill">Відмічено</span>' : `<button class="life-icon-action" type="button" data-habit-checkin="${habit.id}" title="Відмітити">✓</button>`}</article>`).join("")}</div>` : '<p class="life-quiet">Додай щотижневу звичку в розділі «Огляди».</p>'}<details class="life-disclosure"><summary>+ Нотатка після розмови з наставником</summary><form class="life-form compact-form" data-life-form="mentor-note"><label>Дата<input name="met_on" type="date" value="${today()}"></label><label>Поради / думки<textarea name="advice" rows="2"></textarea></label><label>Що зрозумів і що зроблю<textarea name="action_items" rows="2"></textarea></label><button class="ghost" type="submit">Зберегти</button></form></details>${mentorData.notes?.[0] ? `<p class="form-help">Остання нотатка: ${formatDate(mentorData.notes[0].met_on)}</p>` : ""}</section></div>`,
      `<button class="ghost" type="button" data-task-quick>+ Задача</button><details class="life-disclosure top-disclosure"><summary>+ Неділя</summary><form class="life-form compact-form" data-life-form="habit"><label>Щотижнева звичка<input name="title" value="Читати Біблію" maxlength="220" required></label><input name="cadence" type="hidden" value="weekly"><input name="weekday" type="hidden" value="0"><button class="ghost" type="submit">Додати</button></form></details>`,
    );
  }

  async function renderPlanner(ticket) {
    const [areas, goals, projects, tasks] = await Promise.all([
      api("/api/life/areas"), api("/api/life/goals"), api("/api/life/projects"), api("/api/life/tasks"),
    ]);
    if (!isCurrent("planner", ticket)) return;
    const allTasks = tasks.tasks || [];
    const active = allTasks.filter((task) => !["done", "archived"].includes(task.status));
    const goalSections = [
      ["year", "Рік", "Напрям, який хочеш тримати в полі зору"],
      ["quarter", "90 днів", "Відчутний крок, який підтримує річну ціль"],
      ["month", "Місяць", "Практичний результат цього місяця"],
      ["week", "Тиждень", "Короткий план, який можна реально виконати"],
    ].map(([period, title, text]) => {
      const rows = (goals.goals || []).filter((goal) => goal.period === period && goal.status !== "archived");
      return `<section class="goal-column"><p class="eyebrow">${period.toUpperCase()}</p><h3>${title}</h3><p>${text}</p>${rows.length ? rows.map((goal) => `<article class="goal-item"><b>${escape(goal.title)}</b>${goal.target_value != null ? `<small>${number(goal.current_value)} / ${number(goal.target_value)} ${escape(goal.unit)}</small>` : ""}${goal.due_date ? `<small>до ${formatDate(goal.due_date)}</small>` : ""}</article>`).join("") : '<span class="muted">Поки не задано</span>'}</section>`;
    }).join("");
    $("#life-view").innerHTML = page(
      "ПЛАНЕР · ВІД НАПРЯМКУ ДО ДІЇ",
      "План без перевантаження",
      "Цілі створюють контекст, а статус задачі показує, де вона живе зараз. Готові задачі не дублюються при переміщенні — зберігається одна історія.",
      `<div class="planner-layout"><section class="life-panel planner-form-panel"><div class="life-section-heading"><div><p class="eyebrow">ШВИДКЕ ДОДАВАННЯ</p><h2>Задача</h2></div></div><form class="life-form" data-life-form="task"><label>Що зробити<input name="title" maxlength="220" required placeholder="Наприклад: узгодити план на понеділок"></label><div class="form-row"><label>Коли<select name="status"><option value="today">Сьогодні</option><option value="week">Цей тиждень</option><option value="month">Цей місяць</option><option value="inbox">Вхідні</option></select></label><label>Пріоритет<select name="priority"><option value="normal">Звичайний</option><option value="high">Високий</option><option value="low">Низький</option></select></label></div><div class="form-row"><label>Дата<input name="due_date" type="date"></label><label>Оцінка, хв<input name="estimate_minutes" type="number" min="1" max="1440" inputmode="numeric"></label></div><label>Проєкт<select name="project_id">${selectOptions(projects.projects || [], "", "Без проєкту")}</select></label><label>Нотатка<textarea name="notes" rows="2" placeholder="Необов’язково"></textarea></label><button class="primary" type="submit">Додати задачу</button></form></section>
      ${taskList("Сьогодні", active.filter((task) => task.status === "today"), "FOCUS")}${taskList("Тиждень", active.filter((task) => task.status === "week"), "ПЛАН")}</div>
      <section class="life-panel goal-map"><div class="life-section-heading"><div><p class="eyebrow">ІЄРАРХІЯ</p><h2>Від великого до конкретного</h2></div><details class="life-disclosure"><summary>+ Додати ціль</summary><form class="life-form compact-form" data-life-form="goal"><label>Назва<input name="title" maxlength="220" required></label><label>Опис результату<textarea name="description" rows="2" placeholder="Що має стати правдою до дедлайну"></textarea></label><div class="form-row"><label>Горизонт<select name="period"><option value="year">Рік</option><option value="quarter">90 днів</option><option value="month">Місяць</option><option value="week">Тиждень</option></select></label><label>Батьківська ціль<select name="parent_id">${selectOptions(goals.goals || [], "", "Верхній рівень / оберу пізніше")}</select></label></div><div class="form-row"><label>Сфера<select name="area_id">${selectOptions(areas.areas || [], "", "Без сфери")}</select></label><label>Поточний результат<input name="current_value" inputmode="decimal"></label></div><div class="form-row"><label>Цільове значення<input name="target_value" inputmode="decimal"></label><label>Одиниця<input name="unit" maxlength="40" placeholder="кг, задач, грн"></label></div><label>Дедлайн<input name="due_date" type="date"></label><button class="primary" type="submit">Зберегти ціль</button></form></details></div><div class="goal-map-grid">${goalSections}</div></section>
      <div class="planner-bottom-grid">${taskList("Місяць", active.filter((task) => task.status === "month"), "ЗАПЛАНОВАНО")}${taskList("Вхідні", active.filter((task) => task.status === "inbox"), "РОЗІБРАТИ")}${taskList("Нещодавно виконано", allTasks.filter((task) => task.status === "done").slice(0, 5), "ІСТОРІЯ")}</div>`,
      `<details class="life-disclosure top-disclosure"><summary>+ Нова сфера</summary><form class="life-form inline-form" data-life-form="area"><label>Назва<input name="title" maxlength="120" required placeholder="Наприклад: Здоров’я"></label><fieldset class="color-palette"><legend>Колір сфери</legend><label class="color-picker-control"><input name="color" type="color" value="#19d4bd" aria-label="Власний колір сфери"><span>Свій колір</span></label><div class="color-swatches" role="group" aria-label="Швидкий вибір кольору">${[{ color: "#19d4bd", label: "Бірюзовий" }, { color: "#4f75ff", label: "Синій" }, { color: "#a567e8", label: "Фіолетовий" }, { color: "#ef8d4d", label: "Помаранчевий" }, { color: "#e3637a", label: "Рожевий" }, { color: "#4da87a", label: "Зелений" }].map((item, index) => `<button class="color-swatch${index === 0 ? " selected" : ""}" type="button" data-area-color="${item.color}" title="${item.label}" aria-label="${item.label}" aria-pressed="${index === 0 ? "true" : "false"}" style="--swatch:${item.color}"></button>`).join("")}</div></fieldset><button class="ghost" type="submit">Зберегти</button></form></details>`,
    );
  }

  async function renderTraining(ticket) {
    const [templates, workoutData] = await Promise.all([api("/api/life/training/days"), api("/api/life/workouts")]);
    if (!isCurrent("training", ticket)) return;
    let selected = null;
    const workouts = workoutData.workouts || [];
    const selectedId = state.workoutId || workouts[0]?.id;
    if (selectedId) selected = await api(`/api/life/workouts/${selectedId}`).catch(() => null);
    if (!isCurrent("training", ticket)) return;
    const days = templates.days || [];
    $("#life-view").innerHTML = page(
      "ТРЕНУВАННЯ · ЖУРНАЛ",
      "План, факт і самопочуття",
      "Робоча вага, повторення, RIR і відчуття фіксуються окремо. Це журнал тренувань, а не медична рекомендація.",
      `<div class="training-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ШАБЛОНИ</p><h2>Тренувальні дні</h2></div><details class="life-disclosure"><summary>+ Шаблон</summary><form class="life-form compact-form" data-life-form="training-day"><label>Назва дня<input name="title" maxlength="220" required placeholder="Наприклад: Верх тіла"></label><label>Нотатка<textarea name="description" rows="2"></textarea></label><button class="primary" type="submit">Створити</button></form></details></div><div class="training-template-list">${days.length ? days.map((day) => `<article class="training-template"><div><b>${escape(day.title)}</b><p>${escape(day.description || "Без опису")}</p><ul>${day.exercises.length ? day.exercises.map((exercise) => `<li>${escape(exercise.title)} <small>${exercise.planned_sets || "—"}× ${exercise.rep_min || "—"}${exercise.rep_max ? `–${exercise.rep_max}` : ""}</small></li>`).join("") : "<li>Ще немає вправ</li>"}</ul></div><details class="life-disclosure small"><summary>+ Вправа</summary><form class="life-form compact-form" data-life-form="exercise" data-training-day="${day.id}"><label>Назва<input name="title" required maxlength="220"></label><div class="form-row"><label>Підходи<input name="planned_sets" type="number" min="1" max="20"></label><label>Повторення<input name="rep_min" type="number" min="1" max="100"></label></div><label>Макс. повторень<input name="rep_max" type="number" min="1" max="100"></label><label>Техніка<textarea name="technique_notes" rows="2"></textarea></label><button class="ghost" type="submit">Додати</button></form></details></article>`).join("") : empty("Шаблонів ще немає", "Створи день і додай вправи, щоб швидко планувати сесії.")}</div></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">НАСТУПНЕ</p><h2>Запланувати тренування</h2></div></div><form class="life-form" data-life-form="workout"><label>Шаблон<select name="training_day_id">${selectOptions(days, "", "Без шаблону")}</select></label><label>Назва (необов’язково)<input name="title" maxlength="220" placeholder="Візьмемо назву шаблону"></label><label>Дата<input name="scheduled_date" type="date" value="${today()}"></label><button class="primary" type="submit">Додати в план</button></form><div class="workout-list">${workouts.length ? workouts.slice(0, 8).map((workout) => `<button type="button" class="workout-row ${workout.id === selected?.id ? "active" : ""}" data-workout-open="${workout.id}"><span>${escape(workout.title)}</span><small>${formatDate(workout.scheduled_date || workout.performed_at)} · ${escape(statusLabel[workout.status])}</small></button>`).join("") : empty("Немає тренувань", "Заплануй першу сесію з шаблону або без нього.")}</div></section></div>
      ${selected ? workoutDetail(selected) : ""}`,
    );
  }

  function workoutDetail(workout) {
    return `<section class="life-panel workout-detail"><div class="life-section-heading"><div><p class="eyebrow">ВИКОНАННЯ</p><h2>${escape(workout.title)}</h2><p>${formatDate(workout.scheduled_date || workout.performed_at)}</p></div><span class="status-pill">${escape(statusLabel[workout.status])}</span></div><form class="life-form workout-sets-form" data-life-form="workout-sets" data-workout="${workout.id}"><div class="set-table"><div class="set-head"><span>Вправа</span><span>Вага, кг</span><span>Повтори</span><span>RIR</span><span>Дискомфорт</span></div>${(workout.sets || []).map((set) => `<div class="set-row" data-set="${set.id}"><b>${escape(set.exercise_title)} <small>№${set.set_number}</small></b><input name="weight_kg" inputmode="decimal" value="${set.weight_kg ?? ""}" aria-label="Вага"><input name="reps" inputmode="numeric" value="${set.reps ?? ""}" aria-label="Повтори"><input name="rir" inputmode="decimal" value="${set.rir ?? ""}" aria-label="RIR"><input name="discomfort" value="${escape(set.discomfort || "")}" aria-label="Дискомфорт"></div>`).join("") || '<p class="life-quiet">У цього тренування ще немає вправ. Їх можна додати в шаблоні для наступної сесії.</p>'}</div><label>Самопочуття<textarea name="wellbeing" rows="2" placeholder="Як відчувалося тренування">${escape(workout.wellbeing || "")}</textarea></label><label>Нотатка<textarea name="notes" rows="2">${escape(workout.notes || "")}</textarea></label><div class="form-actions"><button class="ghost" type="submit">Зберегти підходи</button><button class="primary" type="button" data-workout-complete="${workout.id}">Позначити виконаним</button></div></form></section>`;
  }

  async function renderNutrition(ticket) {
    const [products, meals, metrics, targetData] = await Promise.all([
      api("/api/life/products"), api(`/api/life/meals?date=${today()}`), api("/api/life/body-metrics"), api("/api/life/nutrition/targets"),
    ]);
    if (!isCurrent("nutrition", ticket)) return;
    const rows = meals.meals || [];
    const sum = (field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);
    const targets = targetData.targets || {};
    $("#life-view").innerHTML = page(
      "ХАРЧУВАННЯ · ЩОДЕННИК",
      "Дані замість здогадів",
      "Зберігай те, що фактично з’їв. БЖУ автоматично рахуються з продукту, якщо для нього є дані на 100 г; інакше їх можна ввести вручну.",
      `<div class="life-metrics nutrition-metrics">${card("Прийомів їжі", rows.length, "За сьогодні", "mint")}${card("Калорії", `${number(sum("calories"), "—")} ккал`, targets.calories != null ? `твоя ціль: ${number(targets.calories)} ккал` : "За внесеними записами", "blue")}${card("Білок", `${number(sum("protein_g"), "—")} г`, targets.protein_g != null ? `твоя ціль: ${number(targets.protein_g)} г` : "За внесеними записами", "orange")}${card("Остання вага", metrics.entries?.[0]?.weight_kg ? `${number(metrics.entries[0].weight_kg)} кг` : "—", metrics.entries?.[0] ? formatDate(metrics.entries[0].recorded_on) : "Ще не зафіксовано", "violet")}</div>
      <div class="nutrition-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ДОДАТИ ЗАПИС</p><h2>Що з’їв</h2></div></div><form class="life-form" data-life-form="meal"><label>Збережений продукт<select name="product_id"><option value="">Страва без каталогу</option>${(products.products || []).map((product) => `<option value="${product.id}">${escape(product.title)}</option>`).join("")}</select></label><label>Назва<input name="title" maxlength="220" required placeholder="Наприклад: сніданок вдома"></label><div class="form-row"><label>Тип<select name="meal_type"><option value="breakfast">Сніданок</option><option value="lunch">Обід</option><option value="dinner">Вечеря</option><option value="snack">Перекус</option></select></label><label>Вага, г<input name="amount_g" type="number" min="0" inputmode="decimal"></label></div><div class="macro-row"><label>Ккал<input name="calories" inputmode="decimal"></label><label>Б<input name="protein_g" inputmode="decimal"></label><label>Ж<input name="fat_g" inputmode="decimal"></label><label>В<input name="carbs_g" inputmode="decimal"></label></div><label>Нотатка<input name="note" maxlength="1000"></label><button class="primary" type="submit">Додати прийом їжі</button></form></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">СЬОГОДНІ</p><h2>Щоденник</h2></div><span class="count-badge">${rows.length}</span></div><div class="meal-list">${rows.length ? rows.map((meal) => `<article class="meal-row"><div><b>${escape(meal.title)}</b><small>${escape({ breakfast: "Сніданок", lunch: "Обід", dinner: "Вечеря", snack: "Перекус" }[meal.meal_type] || meal.meal_type)}${meal.amount_g ? ` · ${number(meal.amount_g)} г` : ""}</small></div><span>${number(meal.calories, "—")} ккал<br><small>Б ${number(meal.protein_g, "—")} · Ж ${number(meal.fat_g, "—")} · В ${number(meal.carbs_g, "—")}</small></span></article>`).join("") : empty("Поки немає записів", "Додай реальний прийом їжі — підсумки оновляться.")}</div></section></div>
      <div class="nutrition-grid lower"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">КАТАЛОГ</p><h2>Продукти</h2></div><details class="life-disclosure"><summary>+ Новий продукт</summary><form class="life-form compact-form" data-life-form="product"><label>Назва<input name="title" maxlength="220" required></label><label>Категорія<input name="category" maxlength="100"></label><div class="form-row"><label>Ціна упаковки, грн<input name="price" type="number" min="0" step="0.01" inputmode="decimal"></label><label>Вага упаковки, г<input name="package_weight_g" type="number" min="1" step="1" inputmode="decimal"></label></div><p class="form-help">Якщо вказати ціну, вагу упаковки й вагу порції, сума цієї порції збережеться разом із записом їжі.</p><div class="macro-row"><label>Ккал /100г<input name="calories_per_100g" inputmode="decimal"></label><label>Б /100г<input name="protein_per_100g" inputmode="decimal"></label><label>Ж /100г<input name="fat_per_100g" inputmode="decimal"></label><label>В /100г<input name="carbs_per_100g" inputmode="decimal"></label></div><button class="ghost" type="submit">Зберегти продукт</button></form></details></div><div class="product-list">${(products.products || []).length ? products.products.map((product) => `<span>${escape(product.title)} <small>${number(product.calories_per_100g, "—")} ккал /100г${product.price != null && product.package_weight_g ? ` · ${money(product.price)} / ${number(product.package_weight_g)} г` : ""}</small></span>`).join("") : '<span class="muted">Каталог ще порожній</span>'}</div></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ТВОЇ ОРІЄНТИРИ</p><h2>Цілі БЖУ</h2></div></div><p class="life-quiet">Ти задаєш орієнтири самостійно. Система лише порівнює їх із внесеними фактами.</p><form class="life-form compact-form" data-life-form="nutrition-targets"><div class="macro-row"><label>Ккал<input name="calories" inputmode="decimal" value="${targets.calories ?? ""}"></label><label>Білок, г<input name="protein_g" inputmode="decimal" value="${targets.protein_g ?? ""}"></label><label>Жири, г<input name="fat_g" inputmode="decimal" value="${targets.fat_g ?? ""}"></label><label>Вуглеводи, г<input name="carbs_g" inputmode="decimal" value="${targets.carbs_g ?? ""}"></label></div><button class="ghost" type="submit">Зберегти орієнтири</button></form></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ЩОДЕННИЙ ЧЕК-ІН</p><h2>Вода і самопочуття</h2></div></div><form class="life-form compact-form" data-life-form="nutrition-checkin"><div class="form-row"><label>Вода, мл<input name="water_ml" type="number" min="0" max="20000" inputmode="numeric"></label><label>Регулярність<input name="regularity" maxlength="100" placeholder="Наприклад: нормально"></label></div><label>Самопочуття<textarea name="wellbeing_note" rows="2"></textarea></label><button class="ghost" type="submit">Зберегти чек-ін</button></form></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ВИМІРЮВАННЯ</p><h2>Вага</h2></div></div><form class="life-form compact-form" data-life-form="body-metric"><div class="form-row"><label>Дата<input name="recorded_on" type="date" value="${today()}"></label><label>Вага, кг<input name="weight_kg" type="number" step="0.1" min="20" max="500" required inputmode="decimal"></label></div><label>Нотатка<input name="note" maxlength="1000"></label><button class="ghost" type="submit">Зберегти вимірювання</button></form></section></div>`,
    );
  }

  async function renderFinance(ticket) {
    const to = today(); const fromDate = new Date(`${to}T12:00:00Z`); fromDate.setUTCDate(fromDate.getUTCDate() - 29);
    const finance = await api(`/api/life/finance?from=${dateKey(fromDate)}&to=${to}`);
    if (!isCurrent("finance", ticket)) return;
    const totalsMarkup = ["personal", "business"].map((scope) => {
      const values = finance.totals?.[scope] || {}; const currencies = Object.entries(values);
      return `<section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">${scope === "business" ? "БІЗНЕС" : "ОСОБИСТЕ"}</p><h2>${scope === "business" ? "Результат бізнесу" : "Особисті гроші"}</h2></div></div>${currencies.length ? `<div class="fact-table">${currencies.map(([currency, data]) => `<div><b>${escape(currency)}</b><span>Дохід ${money(data.income, currency)} · витрати ${money(data.expense, currency)}</span><small>Прибуток: ${money(data.profit, currency)} · накопичення: ${money(data.saving, currency)}</small></div>`).join("")}</div>` : '<p class="life-quiet">За 30 днів ще немає внесених записів.</p>'}</section>`;
    }).join("");
    const savings = finance.savings_goals || [];
    const groupedFinance = (from) => (finance.entries || []).filter((entry) => entry.occurred_on >= from).reduce((all, entry) => {
      const currency = entry.currency || "UAH";
      const bucket = all[currency] || (all[currency] = { income: 0, expense: 0 });
      bucket[entry.entry_type] = (bucket[entry.entry_type] || 0) + Number(entry.amount || 0);
      return all;
    }, {});
    const weekFrom = new Date(`${to}T12:00:00Z`); weekFrom.setUTCDate(weekFrom.getUTCDate() - 6);
    const monthFrom = new Date(`${to}T12:00:00Z`); monthFrom.setUTCDate(monthFrom.getUTCDate() - 29);
    const periodText = (from) => Object.entries(groupedFinance(from)).map(([currency, data]) => money((data.income || 0) - (data.expense || 0), currency)).join(" · ") || "—";
    $("#life-view").innerHTML = page(
      "ФІНАНСИ · ЛИШЕ ФАКТИЧНІ СУМИ",
      "Гроші без змішування валют",
      `UAH і USD показуються окремо. Сьогодні: ${periodText(to)} · 7 днів: ${periodText(dateKey(weekFrom))} · 30 днів: ${periodText(dateKey(monthFrom))}. Курс не вигадується і не застосовується автоматично.`,
      `<div class="analytics-grid">${totalsMarkup}</div><div class="finance-layout"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">НОВА ОПЕРАЦІЯ</p><h2>Дохід, витрата або накопичення</h2></div></div><form class="life-form" data-life-form="finance"><div class="form-row"><label>Тип<select name="entry_type"><option value="income">Дохід</option><option value="expense">Витрата</option><option value="saving">В накопичення</option></select></label><label>Контур<select name="scope"><option value="personal">Особисте</option><option value="business">Бізнес</option></select></label></div><div class="form-row"><label>Сума<input name="amount" type="number" min="0" step="0.01" required inputmode="decimal"></label><label>Валюта<select name="currency"><option>UAH</option><option>USD</option></select></label></div><div class="form-row"><label>Категорія<input name="category" maxlength="120" placeholder="Наприклад: хостинг"></label><label>Джерело<input name="source" maxlength="120" placeholder="Наприклад: клієнт"></label></div><label>Дата<input name="occurred_on" type="date" value="${today()}"></label><label>Нотатка<textarea name="note" rows="2"></textarea></label><label><input name="is_recurring" type="checkbox" value="1"> Регулярний платіж</label><button class="primary" type="submit">Зберегти операцію</button></form></section><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">НАКОПИЧЕННЯ</p><h2>Фінансові цілі</h2></div></div>${savings.length ? `<div class="fact-table">${savings.map((goal) => `<div><b>${escape(goal.title)}</b><span>${money(goal.current_amount, goal.currency)} з ${money(goal.target_amount, goal.currency)}</span><small>${goal.due_date ? `до ${formatDate(goal.due_date)}` : "без дати"}</small></div>`).join("")}</div>` : '<p class="life-quiet">Додай, наприклад, окрему ціль «Переїзд». Вона не змішується з бізнес-грошима.</p>'}<details class="life-disclosure"><summary>+ Фінансова ціль</summary><form class="life-form compact-form" data-life-form="savings-goal"><label>Назва<input name="title" value="Переїзд" maxlength="220" required></label><div class="form-row"><label>Цільова сума<input name="target_amount" type="number" min="0" step="0.01" required></label><label>Валюта<select name="currency"><option>USD</option><option>UAH</option></select></label></div><label>Дедлайн<input name="due_date" type="date"></label><button class="ghost" type="submit">Зберегти ціль</button></form></details></section></div><section class="life-panel recent-finance"><div class="life-section-heading"><div><p class="eyebrow">ОСТАННІ 30 ДНІВ</p><h2>Операції</h2></div></div>${finance.entries?.length ? `<div class="fact-table">${finance.entries.map((entry) => `<div><b>${entry.entry_type === "income" ? "Дохід" : entry.entry_type === "saving" ? "Накопичення" : "Витрата"} · ${money(entry.amount, entry.currency)}</b><span>${escape(entry.scope === "business" ? "Бізнес" : "Особисте")} · ${escape(entry.category || entry.source || "Без категорії")}</span><small>${formatDate(entry.occurred_on)}${entry.note ? ` · ${escape(entry.note)}` : ""}</small></div>`).join("")}</div>` : empty("Операцій ще немає", "Додай лише фактичний дохід, витрату або внесок у накопичення.")}</section>`,
    );
  }

  function miniTrend(points, field, tone, label) {
    const values = points.map((point) => Number(point[field])).filter(Number.isFinite);
    if (!values.length) return '<span class="muted">Ще немає достатньо зафіксованих значень</span>';
    const low = Math.min(...values); const high = Math.max(...values); const width = 240; const height = 56;
    const coordinates = values.map((value, index) => {
      const x = values.length === 1 ? width / 2 : 8 + index * ((width - 16) / (values.length - 1));
      const y = high === low ? height / 2 : height - 8 - ((value - low) / (high - low)) * (height - 16);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
    return `<figure class="mini-trend"><figcaption>${escape(label)}: ${number(values.at(-1))}</figcaption><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escape(label)}"><polyline class="${tone}" points="${coordinates}"></polyline>${coordinates.split(" ").map((point) => `<circle class="${tone}" cx="${point.split(",")[0]}" cy="${point.split(",")[1]}" r="2.5"></circle>`).join("")}</svg></figure>`;
  }
  function nutritionPeriodRows(periods) {
    if (!periods.length) return '<p class="life-quiet">За обраний період немає записів.</p>';
    return `<div class="fact-table">${periods.map((period) => {
      const spend = Object.entries(period.spend || {}).map(([currency, amount]) => money(amount, currency)).join(" · ");
      return `<div><b>${escape(formatDate(period.period_start))}</b><span>${number(period.meals)} прийомів · ${number(period.calories)} ккал · Б ${number(period.protein_g)} г</span><small>${spend ? `Фактична вартість: ${escape(spend)} (${period.spend_entries} записів)` : `Витрати не підсумовані: ${period.missing_cost_entries} записів без ціни й ваги`}</small></div>`;
    }).join("")}</div>`;
  }

  async function renderAnalytics(ticket) {
    const dateTo = today();
    const fromDate = new Date(`${dateTo}T12:00:00Z`); fromDate.setUTCDate(fromDate.getUTCDate() - 27);
    const range = `from=${dateKey(fromDate)}&to=${dateTo}`;
    const [dashboard, tasks, workouts, meals, income, training, nutritionWeek, nutritionMonth, reviews, sleep] = await Promise.all([
      api("/api/life/dashboard"), api("/api/life/tasks"), api("/api/life/workouts"), api("/api/life/meals"), api("/api/life/income"),
      api(`/api/life/training/analytics?${range}`), api(`/api/life/nutrition/analytics?${range}&group=week`), api(`/api/life/nutrition/analytics?${range}&group=month`), api("/api/life/reviews"), api(`/api/life/sleep/analytics?${range}`),
    ]);
    if (!isCurrent("analytics", ticket)) return;
    const done = (tasks.tasks || []).filter((task) => task.status === "done").length;
    const plannedWorkouts = (workouts.workouts || []).filter((item) => item.status === "planned").length;
    const completedWorkouts = (workouts.workouts || []).filter((item) => item.status === "completed").length;
    const totals = (income.entries || []).reduce((all, item) => {
      all[item.currency || "UAH"] = (all[item.currency || "UAH"] || 0) + Number(item.amount || 0);
      return all;
    }, {});
    const exercises = training.exercises || [];
    const weeklyTraining = training.weekly || [];
    $("#life-view").innerHTML = page(
      "АНАЛІТИКА · ФАКТИ",
      "Тільки те, що зафіксовано",
      `Останні 28 днів: ${formatDate(training.range?.from)} — ${formatDate(training.range?.to)}. Сон: ${sleep.summary?.entries || 0} записів${sleep.summary?.average_quality != null ? ` · середня самооцінка ${sleep.summary.average_quality}/5` : ""}. Це підсумок внесених фактів, не прогноз і не рекомендація.`,
      `<div class="life-metrics">${card("Задач виконано", done, `із ${(tasks.tasks || []).length} у системі`, "mint")}${card("Тренування", training.totals?.workouts_completed || completedWorkouts, `${plannedWorkouts} ще заплановано`, "blue")}${card("Записів харчування", nutritionWeek.totals?.meals || 0, `${nutritionWeek.totals?.unpriced_entries || 0} без даних для вартості`, "orange")}${card("Outreach-відповіді", dashboard.outreach?.replies || 0, `${dashboard.outreach?.calls || 0} дзвінків · ${dashboard.outreach?.clients || 0} клієнтів`, "violet")}</div>
      <section class="life-panel analytics-wide"><div class="life-section-heading"><div><p class="eyebrow">ТРЕНУВАННЯ · ПОРІВНЯННЯ</p><h2>Вага та повторення по одній вправі</h2></div></div><p class="life-quiet">Графіки показують лише підходи з внесеною вагою або повтореннями. Кожна точка — дата виконаного тренування.</p><div class="exercise-trends">${exercises.length ? exercises.map((exercise) => `<article><h3>${escape(exercise.title)}</h3><div class="trend-pair">${miniTrend(exercise.points, "max_weight_kg", "weight", "Макс. вага, кг")}${miniTrend(exercise.points, "max_reps", "reps", "Макс. повторення")}</div><small>${exercise.points.map((point) => `${formatDate(point.date)}: ${point.sets} підх. · ${number(point.volume_kg_reps, "—")} кг×повт.`).join(" · ")}</small></article>`).join("") : empty("Ще немає завершених тренувань", "Заверши тренування та внеси підходи — тут з’явиться порівняння.")}</div></section>
      <div class="analytics-grid analytics-grid-two"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ТРЕНУВАННЯ · ТИЖДЕНЬ</p><h2>Навантаження</h2></div></div>${weeklyTraining.length ? `<div class="fact-table">${weeklyTraining.map((week) => `<div><b>від ${formatDate(week.week_start)}</b><span>${week.workouts_completed} тренувань · ${week.sets_logged} підходів</span><small>${number(week.volume_kg_reps, "—")} кг×повт. за внесеними вагами</small></div>`).join("")}</div>` : '<p class="life-quiet">Щотижнева статистика з’явиться після завершених тренувань.</p>'}</section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ХАРЧУВАННЯ · ТИЖДЕНЬ</p><h2>Щотижневий підсумок</h2></div></div>${nutritionPeriodRows(nutritionWeek.periods || [])}</section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ХАРЧУВАННЯ · МІСЯЦЬ</p><h2>Щомісячний підсумок</h2></div></div>${nutritionPeriodRows(nutritionMonth.periods || [])}</section></div>
      <div class="analytics-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ФІНАНСИ</p><h2>Доходи</h2></div><button class="ghost" type="button" data-life-open="finance">Фінанси</button></div><div class="income-summary">${Object.keys(totals).length ? Object.entries(totals).map(([currency, amount]) => `<strong>${money(amount, currency)}</strong>`).join("") : '<p class="life-quiet">Записів доходу поки немає.</p>'}</div></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ДИСЦИПЛІНА</p><h2>Задачі за статусом</h2></div></div><div class="bar-list">${["today", "week", "month", "inbox", "done"].map((status) => { const n = (tasks.tasks || []).filter((task) => task.status === status).length; const max = Math.max(1, (tasks.tasks || []).length); return `<div><span>${escape(statusLabel[status])}</span><i><b style="width:${Math.round((n / max) * 100)}%"></b></i><strong>${n}</strong></div>`; }).join("")}</div></section>
      <section class="life-panel review-panel"><div class="life-section-heading"><div><p class="eyebrow">РУЧНИЙ ОГЛЯД</p><h2>Тиждень або місяць</h2></div></div><p class="life-quiet">Збережи короткий підсумок у неділю або наприкінці місяця. Дані не вигадуються автоматично.</p><form class="life-form compact-form" data-life-form="period-review"><div class="form-row"><label>Період<select name="review_type"><option value="week">Тиждень</option><option value="month">Місяць</option></select></label><label>Початок<input name="period_start" type="date" value="${today()}"></label></div><label>Що планувалося?<textarea name="planned_summary" rows="2"></textarea></label><label>Що вийшло?<textarea name="results_summary" rows="2"></textarea></label><label>Що змінити?<textarea name="adjustment_summary" rows="2"></textarea></label><label>Фокус наступного періоду<textarea name="next_focus" rows="2"></textarea></label><button class="ghost" type="submit">Зберегти огляд</button></form>${reviews.reviews?.length ? `<p class="form-help">Останній огляд: ${formatDate(reviews.reviews[0].period_start)} · ${reviews.reviews[0].review_type === "week" ? "тиждень" : "місяць"}</p>` : ""}</section><div class="analytics-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ДАНІ</p><h2>Експорт</h2></div></div><p class="life-quiet">JSON експортується з поточного акаунта. Це не містить чужих даних.</p><div class="export-actions"><button class="ghost" type="button" data-export-scope="tasks">Задачі JSON</button><button class="ghost" type="button" data-export-scope="meals">Харчування JSON</button><button class="ghost" type="button" data-export-scope="workouts">Тренування JSON</button><button class="ghost" type="button" data-export-scope="finance">Фінанси JSON</button></div></section></div>`,
    );
  }

  async function renderSettings(ticket) {
    const user = app().state.user;
    if (!isCurrent("settings", ticket)) return;
    $("#life-view").innerHTML = page(
      "НАЛАШТУВАННЯ · ДОСТУП",
      "Акаунт і дані",
      "Паролі не зберігаються у відкритому вигляді. Сесії відокремлені від спільного старого ключа CRM.",
      `<div class="settings-grid"><section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">ПРОФІЛЬ</p><h2>${escape(user?.name || user?.email || "Акаунт")}</h2></div></div><form class="life-form" data-life-form="profile"><label>Ім’я<input name="name" maxlength="120" value="${escape(user?.name || "")}" required></label><label>Email<input value="${escape(user?.email || "")}" disabled></label><p class="form-help">Роль: <b>${user?.role === "owner" ? "власник" : "учасник"}</b>. Зміна email потребує окремого безпечного сценарію підтвердження, тому тут навмисно недоступна.</p><button class="primary" type="submit">Зберегти ім’я</button></form></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">БЕЗПЕКА</p><h2>Змінити пароль</h2></div></div><form class="life-form" data-life-form="password"><label>Поточний пароль<input name="current_password" type="password" autocomplete="current-password" required></label><label>Новий пароль<input name="new_password" type="password" minlength="12" autocomplete="new-password" required></label><label>Повтори новий пароль<input name="password_confirm" type="password" minlength="12" autocomplete="new-password" required></label><button class="ghost" type="submit">Оновити пароль</button></form></section>
      <section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">РЕЗЕРВНЕ КОПІЮВАННЯ</p><h2>Вивантаження даних</h2></div></div><p class="life-quiet">Експорт дає тобі незалежну копію особистих даних. Серверний backup запускається окремим безпечним скриптом на інфраструктурі, а не з браузера.</p><div class="export-actions"><button class="ghost" type="button" data-export-scope="tasks">Задачі</button><button class="ghost" type="button" data-export-scope="meals">Харчування</button><button class="ghost" type="button" data-export-scope="workouts">Тренування</button></div></section>
      ${user?.role === "owner" ? `<section class="life-panel"><div class="life-section-heading"><div><p class="eyebrow">КОМАНДА</p><h2>Новий учасник</h2></div></div><form class="life-form" data-life-form="member"><label>Ім’я<input name="name" maxlength="120" required></label><label>Email<input name="email" type="email" required></label><label>Тимчасовий пароль<input name="password" type="password" minlength="12" required></label><p class="form-help">Передай тимчасовий пароль безпечним каналом; новий учасник зможе змінити його в профілі.</p><button class="ghost" type="submit">Створити учасника</button></form></section>` : ""}</div>`,
    );
  }

  async function render(view) {
    if (!app()?.state?.user) return;
    const ticket = ++state.loaded;
    state.view = view;
    const host = $("#life-view");
    host.innerHTML = '<div class="life-loading"><span></span>Завантажуємо дані…</div>';
    try {
      if (view === "dashboard") return renderDashboard(ticket);
      if (view === "today") return renderToday(ticket);
      if (view === "planner") return renderPlanner(ticket);
      if (view === "training") return renderTraining(ticket);
      if (view === "nutrition") return renderNutrition(ticket);
      if (view === "finance") return renderFinance(ticket);
      if (view === "analytics") return renderAnalytics(ticket);
      if (view === "settings") return renderSettings(ticket);
    } catch (error) {
      if (isCurrent(view, ticket)) host.innerHTML = `<div class="life-empty"><b>Не вдалося завантажити дані</b><p>${escape(error.message)}</p><button class="primary" type="button" data-life-open="${view}">Спробувати ще раз</button></div>`;
    }
  }

  function activate(view = "dashboard") {
    const crm = view === "crm";
    app().state.section = view;
    localStorage.setItem("life-active-section", view);
    $("#life-view").classList.toggle("hidden", crm);
    $("#crm-view").classList.toggle("hidden", !crm);
    $("#crm-nav").hidden = !crm;
    document.querySelectorAll("[data-life-view]").forEach((item) => item.classList.toggle("active", item.dataset.lifeView === view));
    if (crm) return window.SkyBreezeOutreach?.activate ? window.SkyBreezeOutreach.activate() : app().refreshCrm();
    return render(view);
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }
  async function exportJson(scope) {
    const data = await api(`/api/life/export?scope=${encodeURIComponent(scope)}`);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `skybreeze-${scope}-${today()}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  document.addEventListener("click", async (event) => {
    const nav = event.target.closest("[data-life-view]");
    if (nav) return activate(nav.dataset.lifeView);
    const open = event.target.closest("[data-life-open]");
    if (open) return activate(open.dataset.lifeOpen);
    const editorClose = event.target.closest("[data-task-editor-close]");
    if (editorClose) return document.querySelector("#task-editor-dialog")?.close();
    const taskEdit = event.target.closest("[data-task-edit]");
    if (taskEdit) {
      taskEdit.disabled = true;
      try { return await openTaskEditor(taskEdit.dataset.taskEdit); } catch (error) { setMessage(error.message, "error"); } finally { taskEdit.disabled = false; }
    }
    const taskQuick = event.target.closest("[data-task-quick]");
    if (taskQuick) {
      taskQuick.disabled = true;
      try { return await openTaskEditor(); } catch (error) { setMessage(error.message, "error"); } finally { taskQuick.disabled = false; }
    }
    const taskDelete = event.target.closest("[data-task-delete]");
    if (taskDelete) {
      if (!window.confirm("Видалити цю задачу без можливості відновлення?")) return;
      taskDelete.disabled = true;
      try {
        await api(`/api/life/tasks/${taskDelete.dataset.taskDelete}`, { method: "DELETE" });
        return render(state.view);
      } catch (error) {
        taskDelete.disabled = false;
        return setMessage(error.message || "Не вдалося видалити задачу", "error");
      }
    }
    const areaColor = event.target.closest("[data-area-color]");
    if (areaColor) {
      const form = areaColor.closest("form[data-life-form='area']");
      form.querySelector('[name="color"]').value = areaColor.dataset.areaColor;
      form.querySelectorAll("[data-area-color]").forEach((swatch) => {
        const selected = swatch === areaColor;
        swatch.classList.toggle("selected", selected);
        swatch.setAttribute("aria-pressed", String(selected));
      });
      return;
    }
    const transition = event.target.closest("[data-task-transition]");
    if (transition) {
      transition.disabled = true;
      try {
        const toStatus = transition.dataset.taskStatus;
        const payload = { status: toStatus };
        if (toStatus !== "done") {
          const reason = window.prompt("Чому переносиш задачу? (необов’язково, але допоможе в огляді)");
          if (reason === null) { transition.disabled = false; return; }
          payload.action = "rescheduled";
          payload.cancel_reason = reason;
        }
        await api(`/api/life/tasks/${transition.dataset.taskTransition}/transition`, { method: "POST", body: JSON.stringify(payload) });
        if (toStatus === "archived") document.querySelector("#task-editor-dialog")?.close();
        return render(state.view);
      } catch (error) {
        transition.disabled = false;
        return setMessage(error.message, "error");
      }
    }
    const workout = event.target.closest("[data-workout-open]");
    if (workout) {
      state.workoutId = workout.dataset.workoutOpen;
      return render("training");
    }
    const habitCheckin = event.target.closest("[data-habit-checkin]");
    if (habitCheckin) {
      habitCheckin.disabled = true;
      try {
        await api(`/api/life/habits/${habitCheckin.dataset.habitCheckin}/checkin`, { method: "POST", body: JSON.stringify({ recorded_on: today() }) });
        return render("today");
      } catch (error) {
        habitCheckin.disabled = false;
        return setMessage(error.message, "error");
      }
    }
    const quickTea = event.target.closest("[data-quick-tea]");
    if (quickTea) {
      quickTea.disabled = true;
      try {
        await api("/api/life/meals", { method: "POST", body: JSON.stringify({ title: "Чай з 2 ч. л. цукру", meal_type: "snack", amount_text: "1 чашка", calories: 32, carbs_g: 8, is_estimate: true }) });
        setMessage("Чай додано як приблизний запис", "success");
        return render("nutrition");
      } catch (error) {
        quickTea.disabled = false;
        return setMessage(error.message, "error");
      }
    }
    const completeWorkout = event.target.closest("[data-workout-complete]");
    if (completeWorkout) {
      completeWorkout.disabled = true;
      try {
        await api(`/api/life/workouts/${completeWorkout.dataset.workoutComplete}`, { method: "PATCH", body: JSON.stringify({ status: "completed" }) });
        return render("training");
      } catch (error) {
        completeWorkout.disabled = false;
        return setMessage(error.message, "error");
      }
    }
    const exportButton = event.target.closest("[data-export-scope]");
    if (exportButton) {
      exportButton.disabled = true;
      try { await exportJson(exportButton.dataset.exportScope); setMessage("Експорт готовий", "success"); } catch (error) { setMessage(error.message, "error"); }
      exportButton.disabled = false;
    }
  });

  document.addEventListener("input", (event) => {
    const picker = event.target.closest('input[type="color"][name="color"]');
    if (!picker) return;
    const form = picker.closest("form[data-life-form='area']");
    if (!form) return;
    form.querySelectorAll("[data-area-color]").forEach((swatch) => {
      const selected = swatch.dataset.areaColor.toLowerCase() === picker.value.toLowerCase();
      swatch.classList.toggle("selected", selected);
      swatch.setAttribute("aria-pressed", String(selected));
    });
  });

  document.addEventListener("submit", async (event) => {
    const form = event.target.closest("[data-life-form]");
    if (!form) return;
    event.preventDefault();
    const action = form.dataset.lifeForm;
    const data = formData(form);
    const submit = form.querySelector('button[type="submit"]');
    submit?.setAttribute("disabled", "");
    setMessage("");
    try {
      if (action === "task") await api("/api/life/tasks", { method: "POST", body: JSON.stringify(data) });
      if (action === "task-editor") {
        const taskId = form.dataset.taskId;
        const originalStatus = form.dataset.originalStatus;
        const { status, ...patch } = data;
        if (taskId) {
          await api(`/api/life/tasks/${taskId}`, { method: "PATCH", body: JSON.stringify(patch) });
          if (status !== originalStatus) await api(`/api/life/tasks/${taskId}/transition`, { method: "POST", body: JSON.stringify({ status, action: "edited" }) });
        } else {
          await api("/api/life/tasks", { method: "POST", body: JSON.stringify({ ...patch, status }) });
        }
        document.querySelector("#task-editor-dialog")?.close();
      }
      if (action === "area") await api("/api/life/areas", { method: "POST", body: JSON.stringify(data) });
      if (action === "goal") await api("/api/life/goals", { method: "POST", body: JSON.stringify(data) });
      if (action === "training-day") await api("/api/life/training/days", { method: "POST", body: JSON.stringify(data) });
      if (action === "exercise") await api(`/api/life/training/days/${form.dataset.trainingDay}/exercises`, { method: "POST", body: JSON.stringify(data) });
      if (action === "workout") await api("/api/life/workouts", { method: "POST", body: JSON.stringify(data) });
      if (action === "workout-sets") {
        const updates = [...form.querySelectorAll("[data-set]")].map((row) => ({ id: row.dataset.set, weight_kg: row.querySelector('[name="weight_kg"]').value, reps: row.querySelector('[name="reps"]').value, rir: row.querySelector('[name="rir"]').value, discomfort: row.querySelector('[name="discomfort"]').value }));
        await Promise.all(updates.map((set) => api(`/api/life/workout-sets/${set.id}`, { method: "PATCH", body: JSON.stringify(set) })));
        const extra = formData(form);
        await api(`/api/life/workouts/${form.dataset.workout}`, { method: "PATCH", body: JSON.stringify({ wellbeing: extra.wellbeing, notes: extra.notes }) });
      }
      if (action === "product") await api("/api/life/products", { method: "POST", body: JSON.stringify(data) });
      if (action === "meal") await api("/api/life/meals", { method: "POST", body: JSON.stringify(data) });
      if (action === "nutrition-checkin") await api("/api/life/nutrition/checkin", { method: "POST", body: JSON.stringify(data) });
      if (action === "nutrition-targets") await api("/api/life/nutrition/targets", { method: "POST", body: JSON.stringify(data) });
      if (action === "body-metric") await api("/api/life/body-metrics", { method: "POST", body: JSON.stringify(data) });
      if (action === "income") await api("/api/life/income", { method: "POST", body: JSON.stringify(data) });
      if (action === "daily-review") await api("/api/life/daily-review", { method: "POST", body: JSON.stringify(data) });
      if (action === "sleep") await api("/api/life/sleep", { method: "POST", body: JSON.stringify(data) });
      if (action === "mentor-note") await api("/api/life/mentor-notes", { method: "POST", body: JSON.stringify(data) });
      if (action === "habit") await api("/api/life/habits", { method: "POST", body: JSON.stringify(data) });
      if (action === "finance") await api("/api/life/finance", { method: "POST", body: JSON.stringify(data) });
      if (action === "savings-goal") await api("/api/life/savings-goals", { method: "POST", body: JSON.stringify(data) });
      if (action === "period-review") await api("/api/life/reviews", { method: "POST", body: JSON.stringify(data) });
      if (action === "profile") {
        const payload = await api("/api/auth/profile", { method: "PATCH", body: JSON.stringify(data) });
        app().state.user = payload.user;
      }
      if (action === "password") {
        if (data.new_password !== data.password_confirm) throw new Error("Нові паролі не співпадають");
        const payload = await api("/api/auth/change-password", { method: "POST", body: JSON.stringify(data) });
        app().state.sessionToken = payload.session_token;
        sessionStorage.setItem("life-session-token", payload.session_token);
      }
      if (action === "member") await api("/api/auth/register", { method: "POST", body: JSON.stringify(data) });
      setMessage("Збережено", "success");
      await render(state.view);
    } catch (error) {
      setMessage(error.message || "Не вдалося зберегти", "error");
    } finally {
      submit?.removeAttribute("disabled");
    }
  });

  window.SkyBreezeLife = { activate };
  window.addEventListener("skybreeze-app-ready", () => {
    if (app().state.user) activate(app().state.section);
  });
  if (app()?.state?.user) activate(app().state.section);
})();
