(() => {
  'use strict';

  const S = window.SITE;
  const C = S.contacts;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const ico = (name, cls = '') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const html = (str) => { const t = document.createElement('template'); t.innerHTML = str.trim(); return t.content; };

  const touch = matchMedia('(hover: none)').matches;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isMobile = () => innerWidth <= 760;

  const desktop = $('#desktop');
  const layer = $('#windows');
  const tasks = $('#tasks');

  /* ---------- Контакты ---------- */

  const channels = [
    C.telegram && { id: 'telegram', label: 'Telegram', sub: '@' + C.telegram, href: `https://t.me/${C.telegram}`, icon: 'telegram' },
    C.whatsapp && { id: 'whatsapp', label: 'WhatsApp', sub: '+' + C.whatsapp, href: `https://wa.me/${C.whatsapp}`, icon: 'whatsapp' },
    C.email && { id: 'email', label: 'Почта', sub: C.email, href: `mailto:${C.email}`, icon: 'mail' },
    C.github && { id: 'github', label: 'GitHub', sub: C.github, href: `https://github.com/${C.github}`, icon: 'code' }
  ].filter(Boolean);
  const writable = channels.filter((c) => c.id !== 'github');
  const ext = (c) => (c.id === 'email' ? '' : ' target="_blank" rel="noopener"');

  $('#start-links').innerHTML =
    channels.map((c) => `<li><a href="${esc(c.href)}"${ext(c)}>${ico(c.icon)}<span>${esc(c.label)}</span></a></li>`).join('') +
    `<li class="start__sep" role="separator"></li>
     <li><button data-open="about">${ico('info')}<span>Как я работаю</span></button></li>`;

  if (S.avatar) $('.start__avatar').insertAdjacentHTML('afterbegin', `<img src="${esc(S.avatar)}" alt="">`);

  /* ---------- Окна ---------- */

  const wins = new Map();
  let z = 10;
  let cascade = 0;

  function area() {
    return { w: desktop.clientWidth, h: desktop.clientHeight };
  }

  function createWindow({ id, title, icon, w = 640, h = 460, body, resizable = true, cls = '', center = false }) {
    const el = document.createElement('section');
    el.className = `win ${cls}`;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = `
      <header class="win__bar">
        ${ico(icon, 'win__ico')}
        <span class="win__title">${esc(title)}</span>
        <div class="win__btns">
          <button class="win__btn win__btn--min" aria-label="Свернуть"></button>
          ${resizable ? '<button class="win__btn win__btn--max" aria-label="Развернуть"></button>' : ''}
          <button class="win__btn win__btn--close" aria-label="Закрыть"></button>
        </div>
      </header>
      <div class="win__body"></div>
      ${resizable ? '<div class="win__grip" aria-hidden="true"></div>' : ''}`;
    $('.win__body', el).append(body);

    const a = area();
    const W = Math.min(w, a.w - 24);
    const H = Math.min(h, a.h - 24);
    const step = center ? 0 : (cascade++ % 6) * 28;
    el.style.width = W + 'px';
    el.style.height = H + 'px';
    el.style.left = clamp(Math.round((a.w - W) / 2) - 70 + step, 8, a.w - W - 8) + 'px';
    el.style.top = clamp(Math.round((a.h - H) / 2) - 50 + step, 8, a.h - H - 8) + 'px';
    // не закрываем колонку значков, если экран позволяет
    if (!center && a.w - W > 240) el.style.left = Math.max(parseInt(el.style.left, 10), 110) + 'px';
    if (center) { el.style.left = Math.round((a.w - W) / 2) + 'px'; el.style.top = Math.round((a.h - H) / 2.4) + 'px'; }

    const task = document.createElement('button');
    task.className = 'task';
    task.innerHTML = `${ico(icon)}<span>${esc(title)}</span>`;
    task.addEventListener('click', () => {
      const st = wins.get(id);
      if (st.min) restore(id);
      else if (el.classList.contains('is-active')) minimize(id);
      else focus(id);
    });
    tasks.append(task);

    const st = { el, task, min: false, max: false };
    wins.set(id, st);
    layer.append(el);
    wireWindow(id, st, resizable);
    focus(id);
    return el;
  }

  function wireWindow(id, st, resizable) {
    const { el } = st;
    const bar = $('.win__bar', el);

    el.addEventListener('pointerdown', () => focus(id));
    $('.win__btn--close', el).addEventListener('click', () => close(id));
    $('.win__btn--min', el).addEventListener('click', () => minimize(id));
    if (resizable) {
      $('.win__btn--max', el).addEventListener('click', () => toggleMax(id));
      bar.addEventListener('dblclick', (e) => { if (!e.target.closest('.win__btn')) toggleMax(id); });
    }

    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 || e.target.closest('.win__btn') || st.max || isMobile()) return;
      const dx = e.clientX - el.offsetLeft;
      const dy = e.clientY - el.offsetTop;
      bar.setPointerCapture(e.pointerId);
      el.classList.add('is-dragging');
      const move = (ev) => {
        const a = area();
        el.style.left = clamp(ev.clientX - dx, 90 - el.offsetWidth, a.w - 90) + 'px';
        el.style.top = clamp(ev.clientY - dy, 0, a.h - 30) + 'px';
      };
      const up = () => {
        el.classList.remove('is-dragging');
        bar.removeEventListener('pointermove', move);
        bar.removeEventListener('pointerup', up);
        bar.removeEventListener('pointercancel', up);
      };
      bar.addEventListener('pointermove', move);
      bar.addEventListener('pointerup', up);
      bar.addEventListener('pointercancel', up);
    });

    const grip = $('.win__grip', el);
    if (grip) grip.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      grip.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight;
      const move = (ev) => {
        el.style.width = Math.max(340, sw + ev.clientX - sx) + 'px';
        el.style.height = Math.max(220, sh + ev.clientY - sy) + 'px';
      };
      const up = () => { grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); };
      grip.addEventListener('pointermove', move);
      grip.addEventListener('pointerup', up);
    });
  }

  function focus(id) {
    const st = wins.get(id);
    if (!st) return;
    if (!st.el.classList.contains('is-active')) st.el.style.zIndex = ++z;
    wins.forEach((o, k) => {
      o.el.classList.toggle('is-active', k === id);
      o.task.classList.toggle('is-active', k === id);
    });
  }

  function blurAll() {
    wins.forEach((o) => { o.el.classList.remove('is-active'); o.task.classList.remove('is-active'); });
  }

  function focusTop() {
    let top = null;
    wins.forEach((o, k) => { if (!o.min && (!top || +o.el.style.zIndex > +wins.get(top).el.style.zIndex)) top = k; });
    top ? focus(top) : blurAll();
  }

  function close(id) {
    const st = wins.get(id);
    if (!st) return;
    st.el.classList.add('is-closing');
    st.task.remove();
    wins.delete(id);
    setTimeout(() => st.el.remove(), reduced ? 0 : 140);
    focusTop();
  }

  function minimize(id) {
    const st = wins.get(id);
    const t = st.task.getBoundingClientRect();
    const r = st.el.getBoundingClientRect();
    st.el.style.setProperty('--tx', `${t.left - r.left}px`);
    st.el.style.setProperty('--ty', `${t.top - r.top}px`);
    st.min = true;
    st.el.classList.add('is-min');
    st.el.classList.remove('is-active');
    st.task.classList.remove('is-active');
    focusTop();
  }

  function restore(id) {
    const st = wins.get(id);
    st.min = false;
    st.el.classList.remove('is-min');
    focus(id);
  }

  function toggleMax(id) {
    const st = wins.get(id);
    st.max = !st.max;
    st.el.classList.toggle('is-max', st.max);
    $('.win__btn--max', st.el)?.setAttribute('aria-label', st.max ? 'Восстановить' : 'Развернуть');
  }

  function showDesktop() {
    wins.forEach((o, k) => { if (!o.min) minimize(k); });
  }

  function closeAll() {
    [...wins.keys()].forEach(close);
  }

  function open(id, opts = {}) {
    hideBalloon();
    if (wins.has(id)) {
      const st = wins.get(id);
      if (st.min) restore(id); else focus(id);
      if (id === 'order' && opts.preset) $('.wiz', st.el).dispatchEvent(new CustomEvent('preset', { detail: opts.preset }));
      return;
    }
    if (id.startsWith('work:')) return openWork(id.slice(5));
    const app = APPS[id];
    if (app) createWindow({ id, ...app, body: app.build(opts) });
  }

  /* ---------- Проводник ---------- */

  function explorer({ path, icon, items, pane, onOpen, detailsFor, status }) {
    const root = html(`
      <div class="explorer">
        <div class="xp-menu" aria-hidden="true"><span>Файл</span><span>Правка</span><span>Вид</span><span>Избранное</span><span>Сервис</span><span>Справка</span></div>
        <div class="xp-tools">
          <button class="tool" disabled>${ico('back')}<span>Назад</span></button>
          <button class="tool tool--fwd" disabled aria-label="Вперёд">${ico('back')}</button>
          <span class="tool-sep"></span>
          <button class="tool" data-action="show-desktop" title="Свернуть все окна">${ico('up')}<span>Рабочий стол</span></button>
        </div>
        <div class="xp-addr"><span class="xp-addr__label">Адрес</span><div class="xp-addr__field">${ico(icon)}<span>${esc(path)}</span></div></div>
        <div class="explorer__main">
          <aside class="taskpane">${pane}
            <section class="tp tp--details"><h3>Подробно</h3><div class="tp__body" data-details></div></section>
          </aside>
          <div class="files" role="listbox" aria-label="${esc(path)}"></div>
        </div>
        <div class="xp-status"><span data-status>${esc(status)}</span><span class="xp-status__hint">${touch ? 'Нажмите, чтобы открыть' : 'Дважды щёлкните, чтобы открыть'}</span></div>
      </div>`).firstElementChild;

    const files = $('.files', root);
    const details = $('[data-details]', root);
    const idle = details.innerHTML = `<p>Выберите файл, чтобы увидеть подробности.</p>`;

    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'file' + (it.thumb ? ' file--thumb' : '');
      b.setAttribute('role', 'option');
      b.dataset.id = it.id;
      b.innerHTML = it.thumb
        ? `<span class="file__thumb"><img src="${esc(it.thumb)}" alt="" decoding="async"></span><span class="file__name">${esc(it.name)}</span>`
        : `${ico(it.icon, 'file__ico')}<span class="file__name">${esc(it.name)}</span>`;
      const select = () => {
        $$('.file', files).forEach((f) => f.setAttribute('aria-selected', f === b));
        details.innerHTML = detailsFor(it);
      };
      b.addEventListener('click', () => { select(); if (touch) onOpen(it); });
      b.addEventListener('dblclick', () => onOpen(it));
      b.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); onOpen(it); } });
      b.addEventListener('focus', select);
      files.append(b);
    });

    files.addEventListener('pointerdown', (e) => {
      if (e.target === files) { $$('.file', files).forEach((f) => f.setAttribute('aria-selected', false)); details.innerHTML = idle; }
    });
    return root;
  }

  const paneLinks = (list) => `<ul>${list.join('')}</ul>`;
  const paneBtn = (open, icon, label) => `<li><button data-open="${open}">${ico(icon)}<span>${label}</span></button></li>`;

  /* ---------- Приложения ---------- */

  const APPS = {
    works: {
      title: 'Работы', icon: 'folder', w: 820, h: 540,
      build: () => explorer({
        path: 'C:\\Портфолио\\Работы',
        icon: 'folder',
        status: `Объектов: ${S.works.length}`,
        items: S.works.map((w) => ({ id: w.id, name: w.file, thumb: w.shot, w })),
        pane: `
          <section class="tp tp--special"><h3>Задачи</h3>${paneLinks([
            paneBtn('order', 'order', 'Заказать сайт'),
            paneBtn('contacts', 'contacts', 'Написать мне')
          ])}</section>
          <section class="tp"><h3>Другие места</h3>${paneLinks([
            paneBtn('about', 'notepad', 'Обо мне.txt'),
            paneBtn('bin', 'bin', 'Корзина')
          ])}</section>`,
        detailsFor: ({ w }) => `
          <b>${esc(w.title)}</b>
          <p>${esc(w.kind)}<br>Год: ${esc(w.year)}</p>
          <button class="btn btn--sm" data-open="work:${w.id}">Открыть проект</button>`,
        onOpen: ({ id }) => open('work:' + id)
      })
    },

    bin: {
      title: 'Корзина', icon: 'bin', w: 640, h: 420,
      build: () => explorer({
        path: 'Корзина',
        icon: 'bin',
        status: 'Объектов: 3 — и пусть там остаются',
        items: [
          { id: 'z', name: 'Шаблон_с_конструктора.zip', icon: 'zip', what: 'Сжатая ZIP-папка' },
          { id: 'e', name: 'Сайт_за_один_день.exe', icon: 'exe', what: 'Приложение' },
          { id: 'i', name: 'Стоковые_улыбки.jpg', icon: 'image', what: 'Рисунок JPEG' }
        ],
        pane: `<section class="tp tp--special"><h3>Задачи корзины</h3>${paneLinks([
          `<li><button data-action="bin-empty">${ico('bin')}<span>Очистить корзину</span></button></li>`,
          paneBtn('works', 'folder', 'Лучше посмотреть работы')
        ])}</section>`,
        detailsFor: (it) => `<b>${esc(it.name)}</b><p>${esc(it.what)}<br>Удалён: из моей практики</p>`,
        onOpen: () => alertBox({
          title: 'Ошибка открытия файла',
          icon: 'error',
          text: 'Этот файл не поддерживается.\nЯ не собираю сайты из конструктора и стоковых фото — каждый проект придумываю под конкретный бизнес.',
          action: { label: 'Посмотреть работы', open: 'works' }
        })
      })
    },

    about: {
      title: 'Обо мне.txt — Блокнот', icon: 'notepad', w: 640, h: 560, cls: 'win--notepad',
      build: () => {
        const root = html(`
          <div class="notepad">
            <div class="xp-menu" aria-hidden="true"><span>Файл</span><span>Правка</span><span>Формат</span><span>Вид</span><span>Справка</span></div>
            <div class="notepad__text" role="textbox" aria-multiline="true" aria-label="Обо мне" spellcheck="false"></div>
          </div>`).firstElementChild;
        const box = $('.notepad__text', root);
        try { box.contentEditable = 'plaintext-only'; } catch (e) { box.contentEditable = 'true'; }
        // Каждая строка — отдельный блок: перенесённый хвост пункта списка встаёт под текст, а не под маркер
        S.about.replace(/\n+$/, '').split('\n').forEach((line) => {
          const d = document.createElement('div');
          const hang = (line.match(/^\s*(?:[•–—-]|\d+\.)\s+/) || [''])[0].length;
          if (hang) d.style.cssText = `padding-left:${hang}ch;text-indent:-${hang}ch`;
          d.textContent = line || ' ';
          box.append(d);
        });
        return root;
      }
    },

    contacts: {
      title: 'Контакты', icon: 'contacts', w: 480, h: 380, resizable: false,
      build: () => html(`
        <div class="contacts">
          <p class="contacts__lead">Пишите туда, где вам удобнее — отвечу лично.</p>
          <ul class="contacts__list">
            ${channels.map((c) => `<li><a href="${esc(c.href)}"${ext(c)}>${ico(c.icon)}<span><b>${esc(c.label)}</b><small>${esc(c.sub)}</small></span></a></li>`).join('')}
          </ul>
          <div class="contacts__foot">
            <span>Не знаете, что написать?</span>
            <button class="btn" data-open="order">Заполнить бриф</button>
          </div>
        </div>`).firstElementChild
    },

    order: {
      title: 'Мастер нового сайта', icon: 'order', w: 620, h: 430, resizable: false,
      build: (opts) => wizard(opts)
    }
  };

  /* ---------- Карточка проекта ---------- */

  function openWork(id) {
    const w = S.works.find((x) => x.id === id);
    if (!w) return;
    const host = w.url ? w.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'локальная копия проекта';
    const body = html(`
      <div class="work">
        <div class="xp-addr"><span class="xp-addr__label">Адрес</span><div class="xp-addr__field">${ico('browser')}<span>${esc(host)}</span></div>
          ${w.url ? `<a class="btn btn--sm" href="${esc(w.url)}" target="_blank" rel="noopener">Переход</a>` : ''}</div>
        <div class="work__wrap">
          <div class="work__stage">
            <figure class="work__desk"><div class="work__chrome"><i></i><i></i><i></i></div><img src="${esc(w.shot)}" alt="Сайт «${esc(w.title)}», версия для компьютера"></figure>
            ${w.shotMobile ? `<figure class="work__phone"><img src="${esc(w.shotMobile)}" alt="Сайт «${esc(w.title)}», версия для телефона"></figure>` : ''}
          </div>
          <article class="work__info">
            <p class="work__kind">${esc(w.kind)} · ${esc(w.year)}</p>
            <h2>${esc(w.title)}</h2>
            <h3>Задача</h3>
            <p>${esc(w.task)}</p>
            <h3>Что сделано</h3>
            <ul>${w.done.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
            <p class="work__stack">${w.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</p>
            <div class="work__cta">
              <button class="btn btn--go" data-open="order" data-preset="${w.id}">Хочу похожий сайт</button>
              ${w.url ? `<a class="btn" href="${esc(w.url)}" target="_blank" rel="noopener">Открыть сайт ↗</a>` : ''}
            </div>
          </article>
        </div>
      </div>`).firstElementChild;
    createWindow({ id: 'work:' + id, title: `${w.file} — Просмотр проекта`, icon: 'browser', w: 980, h: 620, body, cls: 'win--work' });
  }

  /* ---------- Диалог-сообщение ---------- */

  let alerts = 0;
  function alertBox({ title, icon, text, action }) {
    const id = 'alert' + ++alerts;
    const body = html(`
      <div class="alert">
        <div class="alert__row">${ico(icon, 'alert__ico')}<p>${esc(text).replace(/\n/g, '<br>')}</p></div>
        <div class="alert__btns">
          ${action ? `<button class="btn" data-open="${action.open}" data-close>${esc(action.label)}</button>` : ''}
          <button class="btn btn--default" data-close>OK</button>
        </div>
      </div>`).firstElementChild;
    $$('[data-close]', body).forEach((b) => b.addEventListener('click', () => close(id)));
    createWindow({ id, title, icon, w: 420, h: 210, body, resizable: false, cls: 'win--alert', center: true });
    $('.btn--default', body).focus();
  }

  /* ---------- Мастер заявки ---------- */

  const TYPES = [
    ['Лендинг', 'Одна страница под одну услугу, курс или акцию'],
    ['Сайт-визитка', 'Несколько разделов: о вас, услуги, цены, контакты'],
    ['Сайт для кафе или ресторана', 'Меню с ценами, бронь, доставка, несколько языков'],
    ['Пока не знаю', 'Расскажите о бизнесе — подскажу, что подойдёт']
  ];

  function wizard(opts = {}) {
    const data = { type: '', niche: '', wish: '', when: 'В течение месяца', name: '', channel: writable[0]?.id || '', like: '' };
    let step = 0;

    const root = html(`
      <form class="wiz" novalidate>
        <div class="wiz__page"></div>
        <div class="wiz__foot">
          <button type="button" class="btn" data-back>&lt; Назад</button>
          <button type="submit" class="btn btn--default" data-next>Далее &gt;</button>
          <button type="button" class="btn" data-cancel>Отмена</button>
        </div>
      </form>`).firstElementChild;
    const page = $('.wiz__page', root);

    const applyPreset = (id) => {
      const w = S.works.find((x) => x.id === id);
      if (!w) return;
      data.type = id === 'restaurant' ? TYPES[2][0] : TYPES[1][0];
      data.like = w.title;
      if (step === 0) step = 1;
      render();
    };

    const head = (t, s) => `<div class="wiz__head"><div><b>${t}</b><span>${s}</span></div>${ico('order')}</div>`;

    function summary() {
      return [
        'Здравствуйте, Дмитрий! Хочу обсудить сайт.',
        '',
        `Тип сайта: ${data.type}`,
        data.like ? `Похожий на: ${data.like}` : null,
        `Чем занимаюсь: ${data.niche || '—'}`,
        data.wish ? `Что важно: ${data.wish}` : null,
        `Сроки: ${data.when}`,
        '',
        `Меня зовут ${data.name}.`
      ].filter((x) => x !== null).join('\n');
    }

    function render() {
      root.classList.toggle('wiz--welcome', step === 0);
      $('[data-back]', root).disabled = step === 0;
      $('[data-next]', root).textContent = step === 4 ? 'Готово' : 'Далее >';

      if (step === 0) {
        page.innerHTML = `
          <div class="wiz__side">${ico('mark')}</div>
          <div class="wiz__intro">
            <h2>Вас приветствует мастер нового сайта</h2>
            <p>Три коротких вопроса — и я пойму, какой сайт вам нужен и сколько он будет стоить.</p>
            <p>Заявка не уходит на сервер: в конце откроется ваш мессенджер или почта с готовым текстом. Вы сами решите, отправлять ли его.</p>
            <p class="wiz__muted">Для продолжения нажмите кнопку «Далее».</p>
          </div>`;
      } else if (step === 1) {
        page.innerHTML = head('Какой сайт вам нужен?', 'Выберите ближайший вариант — потом уточним.') + `
          <fieldset class="wiz__body wiz__radios">
            <legend class="visually-hidden">Тип сайта</legend>
            ${TYPES.map(([t, d], i) => `
              <label class="radio"><input type="radio" name="type" value="${esc(t)}" ${data.type === t ? 'checked' : ''} ${i === 0 ? 'required' : ''}>
                <span><b>${esc(t)}</b><small>${esc(d)}</small></span></label>`).join('')}
            ${data.like ? `<p class="wiz__note">Ориентир: «${esc(data.like)}»</p>` : ''}
          </fieldset>`;
      } else if (step === 2) {
        page.innerHTML = head('Расскажите о проекте', 'Пара фраз — этого достаточно.') + `
          <div class="wiz__body wiz__grid">
            <label for="f-niche">Чем вы занимаетесь?</label>
            <input id="f-niche" name="niche" placeholder="Например: кофейня в центре города" value="${esc(data.niche)}">
            <label for="f-wish">Что важно на сайте?</label>
            <textarea id="f-wish" name="wish" rows="3" placeholder="Меню, запись онлайн, отзывы, свой стиль…">${esc(data.wish)}</textarea>
            <label for="f-when">Когда нужен сайт?</label>
            <select id="f-when" name="when">
              ${['Как можно скорее', 'В течение месяца', 'Не горит, хочу сделать хорошо'].map((o) => `<option ${data.when === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
          </div>`;
      } else if (step === 3) {
        page.innerHTML = head('Куда отправить заявку?', 'Отвечу лично в том же мессенджере или на почту.') + `
          <div class="wiz__body wiz__grid">
            <label for="f-name">Ваше имя</label>
            <input id="f-name" name="name" autocomplete="given-name" required value="${esc(data.name)}">
            <span class="wiz__lbl">Куда отправить</span>
            <div class="wiz__chips">
              ${writable.map((c) => `<label class="chip"><input type="radio" name="channel" value="${c.id}" ${data.channel === c.id ? 'checked' : ''}>${ico(c.icon)}<span>${c.label}</span></label>`).join('')}
            </div>
            <p class="wiz__err" role="alert" hidden>Напишите, как к вам обращаться.</p>
          </div>`;
      } else {
        const ch = writable.find((c) => c.id === data.channel);
        page.innerHTML = head('Завершение работы мастера', 'Проверьте текст заявки.') + `
          <div class="wiz__body">
            <pre class="wiz__sum">${esc(summary())}</pre>
            <p class="wiz__muted">${ch ? `После нажатия «Готово» откроется ${ch.label} с этим текстом — останется нажать «Отправить».` : 'Укажите контакты в config.js.'}</p>
          </div>`;
      }
      const first = $('input, textarea, select', page);
      if (first && step > 0 && !touch) first.focus();
    }

    function collect() {
      new FormData(root).forEach((v, k) => { data[k] = String(v).trim(); });
    }

    function send() {
      const text = summary();
      const ch = data.channel;
      if (ch === 'whatsapp') window.open(`https://wa.me/${C.whatsapp}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
      else if (ch === 'telegram') {
        // ?text= подставляет сообщение в поле ввода в приложениях Telegram; копия в буфере — на случай веб-версии
        navigator.clipboard?.writeText(text).catch(() => {});
        const q = `?text=${encodeURIComponent(text)}`;
        // Встроенный браузер Telegram перехватывает ссылки t.me и теряет текст — там открываем чат через tg://
        const inTelegram = 'TelegramWebviewProxy' in window || /Telegram/i.test(navigator.userAgent);
        if (inTelegram) location.href = `tg://resolve?domain=${C.telegram}&${q.slice(1)}`;
        else window.open(`https://t.me/${C.telegram}${q}`, '_blank', 'noopener');
      } else if (ch === 'email') location.href = `mailto:${C.email}?subject=${encodeURIComponent('Заявка на сайт')}&body=${encodeURIComponent(text)}`;
      close('order');
      alertBox({
        title: 'Заявка готова',
        icon: 'info',
        text: ch === 'telegram'
          ? 'Нажмите «Отправить» в Telegram — я отвечу лично.\nЕсли текст не подставился сам, он уже скопирован: просто вставьте его в чат.'
          : 'Отправьте сообщение в открывшемся окне — я отвечу лично. Спасибо!'
      });
    }

    root.addEventListener('submit', (e) => {
      e.preventDefault();
      collect();
      if (step === 1 && !data.type) { $('.wiz__radios', page).classList.add('is-shake'); setTimeout(() => $('.wiz__radios', page)?.classList.remove('is-shake'), 400); return; }
      if (step === 3 && !data.name) { $('.wiz__err', page).hidden = false; return; }
      if (step === 4) return send();
      step++;
      render();
    });
    $('[data-back]', root).addEventListener('click', () => { collect(); step = Math.max(0, step - 1); render(); });
    $('[data-cancel]', root).addEventListener('click', () => close('order'));
    root.addEventListener('preset', (e) => applyPreset(e.detail));

    render();
    if (opts.preset) applyPreset(opts.preset);
    return root;
  }

  /* ---------- Глобальные клики: data-open / data-action ---------- */

  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-open], [data-action]');
    if (!t) return;
    closeStart();
    hideCtx();
    if (t.dataset.open && !t.classList.contains('icon')) open(t.dataset.open, { preset: t.dataset.preset });
    const a = t.dataset.action;
    if (a === 'show-desktop') showDesktop();
    if (a === 'shutdown') openShutdown();
    if (a === 'logoff') { closeAll(); welcome(); }
    if (a === 'arrange') $$('.icon').forEach((i) => i.classList.remove('is-selected'));
    if (a === 'refresh') { desktop.classList.add('is-refresh'); setTimeout(() => desktop.classList.remove('is-refresh'), 160); }
    if (a === 'bin-empty') alertBox({ title: 'Корзина', icon: 'info', text: 'Не получится: эти файлы лежат здесь как напоминание, каким мой сайт не будет.' });
  });

  /* ---------- Значки рабочего стола ---------- */

  const icons = $$('.icon');
  const selectIcon = (el, add = false) => icons.forEach((i) => i.classList.toggle('is-selected', i === el || (add && i.classList.contains('is-selected'))));

  icons.forEach((el) => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (touch) { selectIcon(null); return open(el.dataset.open); }
      selectIcon(el, e.ctrlKey);
    });
    el.addEventListener('dblclick', () => open(el.dataset.open));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); open(el.dataset.open); } });
  });

  // Рамка выделения
  const lasso = $('#lasso');
  desktop.addEventListener('pointerdown', (e) => {
    if (e.target !== desktop && e.target !== layer && !e.target.matches('.icons, .icons li')) return;
    hideCtx();
    closeStart();
    blurAll();
    selectIcon(null);
    if (e.button !== 0 || e.pointerType === 'touch') return;
    const r0 = desktop.getBoundingClientRect();
    const sx = e.clientX - r0.left, sy = e.clientY - r0.top;
    desktop.setPointerCapture(e.pointerId);
    const move = (ev) => {
      const x = ev.clientX - r0.left, y = ev.clientY - r0.top;
      const L = Math.min(sx, x), T = Math.min(sy, y), W = Math.abs(x - sx), H = Math.abs(y - sy);
      Object.assign(lasso.style, { left: L + 'px', top: T + 'px', width: W + 'px', height: H + 'px' });
      lasso.hidden = W + H < 4;
      icons.forEach((i) => {
        const b = i.getBoundingClientRect();
        const hit = b.right - r0.left > L && b.left - r0.left < L + W && b.bottom - r0.top > T && b.top - r0.top < T + H;
        i.classList.toggle('is-selected', hit);
      });
    };
    const up = () => {
      lasso.hidden = true;
      desktop.removeEventListener('pointermove', move);
      desktop.removeEventListener('pointerup', up);
    };
    desktop.addEventListener('pointermove', move);
    desktop.addEventListener('pointerup', up);
  });

  // Контекстное меню
  const ctx = $('#ctx');
  const hideCtx = () => { ctx.hidden = true; };
  desktop.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.win')) return;
    e.preventDefault();
    const r0 = desktop.getBoundingClientRect();
    ctx.hidden = false;
    ctx.style.left = clamp(e.clientX - r0.left, 0, r0.width - ctx.offsetWidth - 4) + 'px';
    ctx.style.top = clamp(e.clientY - r0.top, 0, r0.height - ctx.offsetHeight - 4) + 'px';
  });

  /* ---------- Пуск ---------- */

  const start = $('#start');
  const startBtn = $('#startbtn');
  function closeStart() { start.hidden = true; startBtn.setAttribute('aria-expanded', 'false'); startBtn.classList.remove('is-on'); }
  startBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const on = start.hidden;
    start.hidden = !on;
    startBtn.setAttribute('aria-expanded', on);
    startBtn.classList.toggle('is-on', on);
    hideCtx();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!start.hidden && !e.target.closest('#start, #startbtn')) closeStart();
    if (!ctx.hidden && !e.target.closest('#ctx')) hideCtx();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!start.hidden) return closeStart();
    if (!ctx.hidden) return hideCtx();
    if (!$('#shutdown').hidden) return closeShutdown();
    const active = [...wins.entries()].find(([, o]) => o.el.classList.contains('is-active'));
    if (active && active[1].el.classList.contains('win--alert')) close(active[0]);
  });

  /* ---------- Часы ---------- */

  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const tick = () => { const d = new Date(); clock.textContent = fmt.format(d); clock.title = fmtDate.format(d); clock.dateTime = d.toISOString(); };
  tick();
  setInterval(tick, 10000);
  $$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

  /* ---------- Подсказка в трее ---------- */

  const balloon = $('#balloon');
  let balloonTimer;
  function showBalloon() {
    if (isMobile() && wins.size) return;
    balloon.hidden = false;
    clearTimeout(balloonTimer);
    balloonTimer = setTimeout(hideBalloon, 14000);
  }
  function hideBalloon() { balloon.hidden = true; }
  balloon.addEventListener('click', (e) => {
    hideBalloon();
    if (!e.target.closest('.balloon__close')) open('order');
  });

  /* ---------- Выключение ---------- */

  const sd = $('#shutdown');
  const off = $('#off');
  function openShutdown() { sd.hidden = false; document.body.classList.add('is-grey'); $('[data-sd="off"]', sd).focus(); }
  function closeShutdown() { sd.hidden = true; document.body.classList.remove('is-grey'); }
  sd.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sd]');
    if (!b) return;
    const m = b.dataset.sd;
    closeShutdown();
    if (m === 'off') { closeAll(); hideBalloon(); off.hidden = false; $('#poweron').focus(); }
    if (m === 'restart') { closeAll(); hideBalloon(); boot(); }
    if (m === 'standby') {
      document.body.classList.add('is-standby');
      setTimeout(() => document.addEventListener('pointerdown', () => document.body.classList.remove('is-standby'), { once: true }), 50);
    }
  });
  $('#poweron').addEventListener('click', () => { off.hidden = true; boot(); });

  /* ---------- Загрузка ---------- */

  S.works.forEach((w) => { new Image().src = w.shot; });

  function boot() {
    const el = $('#boot');
    document.documentElement.classList.remove('skip-boot');
    document.body.classList.add('is-booting');
    el.hidden = false;
    el.classList.remove('is-out');
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      removeEventListener('keydown', finish);
      el.removeEventListener('pointerdown', finish);
      el.classList.add('is-out');
      setTimeout(() => { el.hidden = true; welcome(); }, reduced ? 0 : 350);
    };
    const timer = setTimeout(finish, reduced ? 700 : 3400);
    addEventListener('keydown', finish);
    el.addEventListener('pointerdown', finish);
  }

  function welcome() {
    const el = $('#welcome');
    document.body.classList.add('is-booting');
    el.hidden = false;
    el.classList.remove('is-out');
    setTimeout(() => {
      el.classList.add('is-out');
      setTimeout(() => { el.hidden = true; }, 500);
      ready();
    }, reduced ? 300 : 1400);
  }

  function ready() {
    document.body.classList.remove('is-booting');
    try { sessionStorage.setItem('booted', '1'); } catch (e) { /* приватный режим */ }
    if (!isMobile()) open('works');
    clearTimeout(balloonTimer);
    balloonTimer = setTimeout(showBalloon, isMobile() ? 900 : 1800);
  }

  let booted = false;
  try { booted = sessionStorage.getItem('booted') === '1'; } catch (e) { /* приватный режим */ }
  if (booted) {
    $('#boot').hidden = true;
    $('#welcome').hidden = true;
    ready();
  } else {
    $('#welcome').hidden = true;
    boot();
  }
})();
