/* «Империя Авто»: запись в четыре шага (услуги – день – время – контакты) и просмотр фото.
   Даты и часы считаются по времени Ижевска (Europe/Samara). Заявка не уходит сама: её копируют
   и отправляют в Telegram или называют по телефону – подтверждает администратор. */
(() => {
  const form = document.querySelector("[data-b-book]");
  if (form) initBooking(form);
  initLightbox();

  function initBooking(form) {
    const TZ = "Europe/Samara";
    // часы работы по дням недели (0 – вс): последний приём – за час до закрытия
    const HOURS = { 0: [8, 21], 1: [8, 21], 2: [8, 21], 3: [8, 21], 4: [8, 21], 5: [8, 21], 6: [8, 21] }; // ежедневно 08:00–21:00
    const DAYS_AHEAD = 8;
    const WD = ["вс", "пн", "вт", "ср", "чт", "пт", "сб"];
    const WD_FULL = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
    const MON = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
    const MON_FULL = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];

    const $ = (s) => form.querySelector(s), $$ = (s) => [...form.querySelectorAll(s)];
    const tabs = $$("[data-b-tab]"), panels = $$("[data-b-panel]");
    const daysBox = $("[data-b-days]"), timesBox = $("[data-b-times]");
    const back = $("[data-b-back]"), next = $("[data-b-next]");
    const result = $("[data-b-result]"), msgEl = $("[data-b-message]"), statusEl = $("[data-b-status]");
    const summary = $("[data-b-summary]"), countEl = $("[data-b-count]"), dayLabel = $("[data-b-day-label]");
    const state = { step: 0, day: null, time: null, done: false };
    let days = [];

    // «сейчас» в Ижевске: год, месяц, число, день недели и часы, независимо от пояса посетителя
    const nowInTz = () => {
      const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
        .formatToParts(new Date()).map((x) => [x.type, x.value]));
      return { y: +p.year, m: +p.month - 1, d: +p.day, h: +p.hour, min: +p.minute };
    };
    const slotsFor = (day, now) => {
      const [open, close] = HOURS[day.wd];
      const out = [];
      for (let h = open; h < close; h++) {
        const past = day.offset === 0 && h <= now.h + (now.min > 0 ? 1 : 0);
        if (!past) out.push(String(h).padStart(2, "0") + ":00");
      }
      return out;
    };
    const buildDays = () => {
      const now = nowInTz();
      const base = Date.UTC(now.y, now.m, now.d);
      const list = [];
      for (let i = 0; list.length < DAYS_AHEAD && i < 21; i++) {
        const dt = new Date(base + i * 864e5);
        const day = { offset: i, wd: dt.getUTCDay(), d: dt.getUTCDate(), m: dt.getUTCMonth(), y: dt.getUTCFullYear() };
        if (!HOURS[day.wd]) continue;
        day.key = `${day.y}-${day.m + 1}-${day.d}`;
        day.slots = slotsFor(day, now);
        if (!day.slots.length) continue; // сегодня приём уже закончился
        day.short = i === 0 ? "Сегодня" : i === 1 ? "Завтра" : WD[day.wd];
        day.date = `${day.d} ${MON[day.m]}`;
        day.full = `${WD_FULL[day.wd]}, ${day.d} ${MON_FULL[day.m]} ${day.y}`;
        list.push(day);
      }
      return list;
    };
    const drawDays = () => {
      days = buildDays();
      daysBox.innerHTML = days.map((d) => `<label><input type="radio" name="day" value="${d.key}"${state.day === d.key ? " checked" : ""}><span>${d.short}<small>${d.date}</small></span></label>`).join("");
      if (state.day && !days.some((d) => d.key === state.day)) { state.day = null; state.time = null; }
    };
    const drawTimes = () => {
      const day = days.find((d) => d.key === state.day);
      dayLabel.textContent = day ? `${day.short}, ${day.date}` : "";
      if (!day) { timesBox.innerHTML = `<p class="b-hint">Сначала выберите день.</p>`; return; }
      if (state.time && !day.slots.includes(state.time)) state.time = null; // время сохраняется, если оно есть и в новом дне
      timesBox.innerHTML = day.slots.map((t) => `<label><input type="radio" name="time" value="${t}"${state.time === t ? " checked" : ""}><span>${t}</span></label>`).join("");
    };

    const services = () => $$("input[name=svc]:checked").map((i) => i.value);
    const field = (n) => form.elements[n].value.trim();
    const phoneOk = (v) => { const d = v.replace(/\D/g, ""); return d.length === 11 ? /^[78]/.test(d) : d.length === 10; };
    const stepValid = (i) => i === 0 ? services().length > 0 : i === 1 ? !!state.day : i === 2 ? !!state.time : contactsValid(false);
    const contactsValid = (show) => {
      const checks = { name: !!field("name"), phone: phoneOk(field("phone")), car: !!field("car") };
      if (show) for (const [n, ok] of Object.entries(checks)) {
        form.elements[n].setAttribute("aria-invalid", ok ? "false" : "true");
        $(`[data-b-ferr="${n}"]`).hidden = ok;
      }
      return Object.values(checks).every(Boolean);
    };

    const message = () => {
      const day = days.find((d) => d.key === state.day);
      const lines = ["Здравствуйте! Хочу записаться в Империя Авто.", "", "Услуги:", ...services().map((s) => "- " + s), "",
        "Желаемая дата: " + (day ? day.full : "уточню"),
        "Желаемое время: " + (state.time || "уточню"),
        "Автомобиль: " + (field("car") || "-"),
        "Имя: " + (field("name") || "-"),
        "Телефон: " + (field("phone") || "-")];
      if (field("comment")) lines.push("Комментарий: " + field("comment"));
      lines.push("", "Прошу подтвердить запись и уточнить стоимость.");
      return lines.join("\n");
    };

    const render = () => {
      const n = services().length;
      countEl.textContent = `Выбрано: ${n} из 5`;
      panels.forEach((p, i) => (p.hidden = i !== state.step || state.done));
      tabs.forEach((t, i) => {
        t.setAttribute("aria-selected", String(i === state.step && !state.done));
        t.classList.toggle("is-done", i !== state.step && stepValid(i));
        // вперёд можно только через заполненные шаги, назад – всегда
        t.disabled = i > state.step && ![...Array(i).keys()].every(stepValid);
      });
      const day = days.find((d) => d.key === state.day);
      const parts = [];
      parts.push(n ? `<span>Услуги: <b>${n === 1 ? escapeHtml(services()[0]) : n + " шт."}</b></span>` : `<span>Услуги не выбраны</span>`);
      parts.push(`<span>День: <b>${day ? day.short + ", " + day.date : "–"}</b></span>`);
      parts.push(`<span>Время: <b>${state.time || "–"}</b></span>`);
      summary.innerHTML = parts.join("");
      back.hidden = state.step === 0 && !state.done;
      next.hidden = state.done;
      next.textContent = state.step === 3 ? "Сформировать заявку" : "Далее";
      result.hidden = !state.done;
      if (state.done) msgEl.textContent = message();
    };
    const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
    const showErr = (i, on) => { const e = $(`[data-b-err="${i}"]`); if (e) e.hidden = !on; };
    const go = (i) => {
      state.done = false; state.step = Math.max(0, Math.min(3, i));
      if (state.step === 2) drawTimes();
      render();
      const t = tabs[state.step]; if (t && document.activeElement && form.contains(document.activeElement)) t.focus({ preventScroll: true });
    };

    tabs.forEach((t, i) => t.addEventListener("click", () => { if (!t.disabled) go(i); }));
    next.addEventListener("click", () => {
      if (state.step === 3) {
        if (!contactsValid(true)) { form.querySelector("[aria-invalid=true]")?.focus(); return; }
        state.done = true; statusEl.classList.remove("is-ok");
        statusEl.textContent = "Заявка ещё не отправлена. Скопируйте её и отправьте в Telegram или позвоните – администратор подтвердит запись.";
        render(); return;
      }
      if (!stepValid(state.step)) { showErr(state.step, true); return; }
      showErr(state.step, false); go(state.step + 1);
    });
    back.addEventListener("click", () => go(state.done ? 3 : state.step - 1));

    form.addEventListener("change", (e) => {
      const el = e.target;
      if (el.name === "svc") showErr(0, false);
      if (el.name === "day") { state.day = el.value; showErr(1, false); drawTimes(); }
      if (el.name === "time") { state.time = el.value; showErr(2, false); }
      render();
    });
    form.addEventListener("input", (e) => {
      const n = e.target.name;
      if (["name", "phone", "car"].includes(n) && e.target.getAttribute("aria-invalid") === "true") contactsValid(true);
    });
    form.addEventListener("submit", (e) => e.preventDefault());

    const copy = async (text) => {
      try { await navigator.clipboard.writeText(text); return true; } catch (_) {}
      const ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.cssText = "position:fixed;opacity:0;top:0";
      document.body.appendChild(ta); ta.select();
      let ok = false; try { ok = document.execCommand("copy"); } catch (_) {}
      ta.remove(); return ok;
    };
    const copied = (ok, extra = "") => {
      statusEl.classList.toggle("is-ok", ok);
      statusEl.textContent = ok ? "Текст заявки скопирован. " + extra + "Запись подтвердит администратор." : "Не получилось скопировать автоматически – выделите текст заявки и скопируйте вручную.";
    };
    $("[data-b-copy]").addEventListener("click", async () => copied(await copy(message()), "Вставьте его в сообщение в Telegram или продиктуйте по телефону. "));
    // Telegram не подставляет текст в личный чат по ссылке: сначала копируем, потом ссылка открывает чат
    $("[data-b-tg]").addEventListener("click", async () => copied(await copy(message()), "Вставьте его в чат Telegram. "));

    // дни пересчитываются, если вкладка была открыта долго (например, перешли через полночь)
    document.addEventListener("visibilitychange", () => { if (!document.hidden) { drawDays(); drawTimes(); render(); } });
    drawDays(); drawTimes(); render();
    window.__booking = { state, services, message }; // для проверки сценариев
  }

  function initLightbox() {
    const dlg = document.querySelector("[data-b-lightbox]"); if (!dlg || !dlg.showModal) return;
    const img = dlg.querySelector("[data-b-lightbox-img]"), cap = dlg.querySelector("[data-b-lightbox-cap]");
    document.addEventListener("click", (e) => {
      const b = e.target.closest("[data-zoom]"); if (!b) return;
      img.src = b.dataset.zoom; img.alt = b.dataset.caption || ""; cap.textContent = b.dataset.caption || "";
      dlg.showModal();
    });
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
  }
})();
