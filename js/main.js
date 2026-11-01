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
  // Касание и клавиатура открывают сразу, мышь — двойным щелчком, как в настоящей Windows
  const opensOnClick = (e) => touch || e.pointerType === 'touch' || e.detail === 0;

  const desktop = $('#desktop');
  const layer = $('#windows');
  const tasks = $('#tasks');

  // Текстовая версия остаётся для поисковиков и скринридеров, но без лишних остановок клавиатуры
  $$('#page a').forEach((a) => a.setAttribute('tabindex', '-1'));

  /* ---------- Контакты ---------- */

  const channels = [
    C.telegram && { id: 'telegram', label: 'Telegram', sub: '@' + C.telegram, href: `https://t.me/${C.telegram}`, icon: 'telegram' },
    C.whatsapp && { id: 'whatsapp', label: 'WhatsApp', sub: '+' + C.whatsapp, href: `https://wa.me/${C.whatsapp}`, icon: 'whatsapp' },
    C.email && { id: 'email', label: 'Почта', sub: C.email, href: `mailto:${C.email}`, icon: 'mail' }
  ].filter(Boolean);
  const ext = (c) => (c.id === 'email' ? '' : ' target="_blank" rel="noopener"');

  $('#start-links').innerHTML =
    channels.map((c) => `<li><a href="${esc(c.href)}"${ext(c)}>${ico(c.icon)}<span>${esc(c.label)}</span></a></li>`).join('') +
    `<li class="start__sep" role="separator"></li>
     <li><button data-open="contacts">${ico('contacts')}<span>Все контакты</span></button></li>
     <li><button data-open="hero">${ico('info')}<span>Добро пожаловать</span></button></li>`;

  if (S.avatar) $('.start__avatar').insertAdjacentHTML('afterbegin', `<img src="${esc(S.avatar)}" alt="">`);

  /* ---------- Первый экран ---------- */

  const hero = $('#hero');
  $('[data-hero-works]', hero).innerHTML = S.works.map((w) => `
    <li><button data-open="work:${w.id}">
      <img src="${esc(w.thumb)}" alt="" width="480" height="300"><span>${esc(w.file)}</span>
    </button></li>`).join('');
  $('[data-hero-contacts]', hero).innerHTML = channels.map((c) => `<a href="${esc(c.href)}"${ext(c)}>${ico(c.icon)}<span>${esc(c.label)}</span></a>`).join('');
  $('[data-hero-hint]', hero).hidden = touch;

  function syncHero() {
    const st = wins.get('hero');
    desktop.style.setProperty('--hero-h', isMobile() && st && !st.min ? `${st.el.offsetHeight + 8}px` : '0px');
  }
  const heroObserver = 'ResizeObserver' in window ? new ResizeObserver(syncHero) : null;

  /* ---------- Окна ---------- */

  const wins = new Map();
  let z = 10;
  let cascade = 0;

  function area() {
    return { w: desktop.clientWidth, h: desktop.clientHeight };
  }

  function createWindow({ id, title, icon, w = 640, h = 460, body, resizable = true, cls = '', center = false, auto = false }) {
    const opener = document.activeElement;
    const el = document.createElement('section');
    el.className = `win ${cls}`;
    el.tabIndex = -1;
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', title);
    el.innerHTML = `
      <header class="win__bar">
        ${ico(icon, 'win__ico')}
        <span class="win__title">${esc(title)}</span>
        <div class="win__btns">
          <button class="win__btn win__btn--min" aria-label="Свернуть: ${esc(title)}"></button>
          ${resizable ? `<button class="win__btn win__btn--max" aria-label="Развернуть: ${esc(title)}"></button>` : ''}
          <button class="win__btn win__btn--close" aria-label="Закрыть: ${esc(title)}"></button>
        </div>
      </header>
      <div class="win__body"></div>
      ${resizable ? '<div class="win__grip" aria-hidden="true"></div>' : ''}`;
    $('.win__body', el).append(body);

    const a = area();
    const W = Math.min(w, a.w - 16);
    const H = Math.min(h, a.h - 16);
    const step = center ? 0 : (cascade++ % 6) * 28;
    el.style.width = W + 'px';
    if (!auto) el.style.height = H + 'px';
    // не закрываем колонку значков, если экран позволяет
    const minLeft = Math.min(110, a.w - W - 8);
    el.style.left = (center
      ? Math.round((a.w - W) / 2)
      : clamp(Math.round((a.w - W) / 2) - 70 + step, Math.max(8, minLeft), Math.max(8, a.w - W - 8))) + 'px';
    el.style.top = (center ? Math.round((a.h - H) / 2.4) : clamp(Math.round((a.h - H) / 2) - 50 + step, 8, Math.max(8, a.h - H - 8))) + 'px';

    const task = document.createElement('button');
    task.className = 'task';
    task.setAttribute('aria-label', title);
    task.setAttribute('title', title);
    task.innerHTML = `${ico(icon)}<span>${esc(title)}</span>`;
    task.addEventListener('click', () => {
      const st = wins.get(id);
      if (st.min) restore(id);
      else if (el.classList.contains('is-active')) minimize(id);
      else focus(id);
    });
    tasks.append(task);

    const st = { el, task, opener, min: false, max: false };
    wins.set(id, st);
    layer.append(el);
    wireWindow(id, st, resizable);
    if (auto) {
      el.style.top = Math.max(8, Math.round((a.h - el.offsetHeight) / 2.4)) + 'px';
    }
    focus(id);
    el.focus({ preventScroll: true });
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
      o.task.setAttribute('aria-pressed', k === id);
    });
  }

  function blurAll() {
    wins.forEach((o) => { o.el.classList.remove('is-active'); o.task.classList.remove('is-active'); o.task.setAttribute('aria-pressed', false); });
  }

  function focusTop() {
    let top = null;
    wins.forEach((o, k) => { if (!o.min && (!top || +o.el.style.zIndex > +wins.get(top).el.style.zIndex)) top = k; });
    top ? focus(top) : blurAll();
    return top;
  }

  function close(id) {
    const st = wins.get(id);
    if (!st) return;
    st.el.classList.add('is-closing');
    st.task.remove();
    wins.delete(id);
    if (id === 'hero') { heroObserver?.disconnect(); syncHero(); }
    setTimeout(() => st.el.remove(), reduced ? 0 : 140);
    const top = focusTop();
    if (top) wins.get(top).el.focus({ preventScroll: true });
    else if (st.opener?.isConnected) st.opener.focus({ preventScroll: true });
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
    st.task.setAttribute('aria-pressed', false);
    st.el.inert = true;
    if (id === 'hero') syncHero();
    focusTop();
  }

  function restore(id) {
    const st = wins.get(id);
    st.min = false;
    st.el.classList.remove('is-min');
    st.el.inert = false;
    if (id === 'hero') syncHero();
    focus(id);
    st.el.focus({ preventScroll: true });
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
    if (wins.has(id)) {
      const st = wins.get(id);
      if (st.min) restore(id); else { focus(id); st.el.focus({ preventScroll: true }); }
      if (id === 'order' && opts.preset) $('.wiz', st.el).dispatchEvent(new CustomEvent('preset', { detail: opts.preset }));
      return;
    }
    if (id.startsWith('work:')) return openWork(id.slice(5));
    if (id === 'hero') return openHero();
    const app = APPS[id];
    if (app) createWindow({ id, ...app, body: app.build(opts) });
  }

  function openHero() {
    const el = createWindow({ id: 'hero', title: 'Добро пожаловать', icon: 'mark', w: 640, body: hero, resizable: false, cls: 'win--hero', auto: true });
    heroObserver?.observe(el);
    syncHero();
  }

  // После поворота экрана и смены размера окна не должны оставаться за его краем
  addEventListener('resize', () => {
    syncHero();
    if (isMobile()) return;
    const a = area();
    wins.forEach((o) => {
      if (o.max) return;
      o.el.style.width = Math.min(o.el.offsetWidth, a.w - 16) + 'px';
      if (o.el.style.height) o.el.style.height = Math.min(o.el.offsetHeight, a.h - 16) + 'px';
      o.el.style.left = clamp(o.el.offsetLeft, 8, Math.max(8, a.w - o.el.offsetWidth - 8)) + 'px';
      o.el.style.top = clamp(o.el.offsetTop, 0, Math.max(0, a.h - 40)) + 'px';
    });
  });

  /* ---------- Проводник ---------- */

  function shell({ path, icon, pane, main, status, hint = '' }) {
    return html(`
      <div class="explorer">
        <div class="xp-menu" aria-hidden="true"><span>Файл</span><span>Правка</span><span>Вид</span><span>Избранное</span><span>Сервис</span><span>Справка</span></div>
        <div class="xp-tools">
          <button class="tool" data-action="show-desktop" title="Свернуть все окна">${ico('up')}<span>Рабочий стол</span></button>
        </div>
        <div class="xp-addr"><span class="xp-addr__label">Адрес</span><div class="xp-addr__field">${ico(icon)}<span>${esc(path)}</span></div></div>
        <div class="explorer__main">
          <aside class="taskpane">${pane}</aside>
          <div class="explorer__content">${main}</div>
        </div>
        <div class="xp-status"><span>${esc(status)}</span><span class="xp-status__hint">${hint}</span></div>
      </div>`).firstElementChild;
  }

  function explorer({ path, icon, items, pane, onOpen, detailsFor, status }) {
    const root = shell({
      path, icon, status,
      hint: touch ? 'Нажмите, чтобы открыть' : 'Дважды щёлкните, чтобы открыть',
      pane: `${pane}<section class="tp tp--details"><h3>Подробно</h3><div class="tp__body" data-details></div></section>`,
      main: `<div class="files" role="listbox" aria-label="${esc(path)}"></div>`
    });

    const files = $('.files', root);
    const details = $('[data-details]', root);
    const idle = details.innerHTML = `<p>Выберите файл, чтобы увидеть подробности.</p>`;

    items.forEach((it) => {
      const b = document.createElement('button');
      b.className = 'file' + (it.thumb ? ' file--thumb' : '');
      b.setAttribute('role', 'option');
      b.dataset.id = it.id;
      b.innerHTML = it.thumb
        ? `<span class="file__thumb"><img src="${esc(it.thumb)}" alt="" width="480" height="300" decoding="async"></span><span class="file__name">${esc(it.name)}</span><span class="file__meta">${esc(it.meta)}</span>`
        : `${ico(it.icon, 'file__ico')}<span class="file__name">${esc(it.name)}</span>`;
      const select = () => {
        $$('.file', files).forEach((f) => f.setAttribute('aria-selected', f === b));
        details.innerHTML = detailsFor(it);
      };
      b.addEventListener('click', (e) => { select(); if (opensOnClick(e)) onOpen(it); });
      b.addEventListener('dblclick', () => onOpen(it));
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
  const orderPane = `<section class="tp tp--special"><h3>Задачи</h3>${paneLinks([
    paneBtn('order', 'order', 'Заказать сайт'),
    paneBtn('contacts', 'contacts', 'Написать мне')
  ])}</section>`;
  const placesPane = (...ids) => `<section class="tp"><h3>Другие места</h3>${paneLinks(ids.map((id) => paneBtn(id, APPS[id].icon, APPS[id].label || APPS[id].title)))}</section>`;
  const orderBar = (text) => `<div class="cta-bar"><span>${text}</span><button class="btn btn--go" data-open="order">Заказать сайт</button></div>`;

  /* ---------- Приложения ---------- */

  const APPS = {
    works: {
      title: 'Мои работы', icon: 'folder', w: 820, h: 540,
      build: () => explorer({
        path: 'C:\\Портфолио\\Мои работы',
        icon: 'folder',
        status: `Объектов: ${S.works.length}`,
        items: S.works.map((w) => ({ id: w.id, name: w.file, meta: w.kind, thumb: w.thumb, w })),
        pane: orderPane + placesPane('services', 'process', 'reviews'),
        detailsFor: ({ w }) => `
          <b>${esc(w.title)}</b>
          <p>${esc(w.kind)}<br>Год: ${esc(w.year)}</p>
          <button class="btn btn--sm" data-open="work:${w.id}">Открыть проект</button>`,
        onOpen: ({ id }) => open('work:' + id)
      })
    },

    services: {
      title: 'Услуги', icon: 'folder-services', w: 780, h: 560,
      build: () => shell({
        path: 'C:\\Портфолио\\Услуги',
        icon: 'folder-services',
        status: `Объектов: ${S.services.length}`,
        pane: orderPane + placesPane('works', 'process'),
        main: `
          <ul class="cp">
            ${S.services.map((s) => `
              <li class="cp__item">
                ${ico(s.icon, 'cp__ico')}
                <div class="cp__text">
                  <h3>${esc(s.title)}</h3>
                  <p>${esc(s.text)}</p>
                  ${s.price ? `<p class="cp__price">${esc(s.price)}</p>` : ''}
                </div>
                <button class="btn btn--sm" data-open="order" data-preset="type:${esc(s.title)}" aria-label="Обсудить: ${esc(s.title)}">Обсудить</button>
              </li>`).join('')}
          </ul>
          ${orderBar('Цена и сроки зависят от задачи — обсудим их после короткого описания.')}`
      })
    },

    process: {
      title: 'Как проходит работа', icon: 'folder-steps', w: 720, h: 540,
      build: () => shell({
        path: 'C:\\Портфолио\\Как проходит работа',
        icon: 'folder-steps',
        status: `Этапов: ${S.process.length}`,
        pane: orderPane + placesPane('services', 'works'),
        main: `
          <ol class="steps">
            ${S.process.map((p, i) => `
              <li><span class="steps__n" aria-hidden="true">${i + 1}</span>
                <div><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p></div></li>`).join('')}
          </ol>
          ${orderBar('Сроки и условия согласуем отдельно для каждого проекта.')}`
      })
    },

    reviews: {
      title: 'Отзывы', icon: 'folder-reviews', w: 680, h: 460,
      build: () => shell({
        path: 'C:\\Портфолио\\Отзывы',
        icon: 'folder-reviews',
        status: `Объектов: ${S.reviews.length}`,
        pane: orderPane + placesPane('works', 'process'),
        main: S.reviews.length
          ? `<ul class="reviews">${S.reviews.map((r) => `
              <li><blockquote>${esc(r.text)}</blockquote>
                <p class="reviews__who"><b>${esc(r.author)}</b>${r.project ? ` · ${esc(r.project)}` : ''}${r.url ? ` · <a href="${esc(r.url)}" target="_blank" rel="noopener">источник</a>` : ''}</p></li>`).join('')}</ul>`
          : `<div class="empty">${ico('folder-reviews', 'empty__ico')}
              <h3>Отзывов пока нет</h3>
              <p>Надеюсь, именно ваш отзыв станет первым!</p>
            </div>`
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
          text: 'Этот файл не поддерживается.\nЯ не собираю сайты из конструктора и стоковых фото — каждый проект делаю под конкретную задачу.',
          action: { label: 'Посмотреть работы', open: 'works' }
        })
      })
    },

    about: {
      title: 'Обо мне.txt — Блокнот', label: 'Обо мне.txt', icon: 'notepad', w: 640, h: 560, cls: 'win--notepad',
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
          d.textContent = line || ' ';
          box.append(d);
        });
        return root;
      }
    },

    contacts: {
      title: 'Контакты', icon: 'contacts', w: 480, h: 360, resizable: false,
      build: () => html(`
        <div class="contacts">
          <p class="contacts__lead">Пишите туда, где вам удобнее — отвечу лично.</p>
          <ul class="contacts__list">
            ${channels.map((c) => `<li><a href="${esc(c.href)}"${ext(c)}>${ico(c.icon)}<span><b>${esc(c.label)}</b><small>${esc(c.sub)}</small></span></a></li>`).join('')}
          </ul>
          <div class="contacts__foot">
            <span>Не знаете, что написать?</span>
            <button class="btn" data-open="order">Заполнить заявку</button>
          </div>
        </div>`).firstElementChild
    },

    order: {
      title: 'Заказать сайт', icon: 'order', w: 620, h: 480, resizable: false,
      build: (opts) => wizard(opts)
    }
  };

  /* ---------- Карточка проекта ---------- */

  function openWork(id) {
    const i = S.works.findIndex((x) => x.id === id);
    if (i < 0) return;
    const w = S.works[i];
    const winId = 'work:' + id;
    const next = S.works[(i + 1) % S.works.length];
    const host = w.url ? w.url.replace(/^https?:\/\//, '').replace(/\/$/, '') : 'ссылка появится позже';
    const body = html(`
      <div class="work">
        <div class="xp-tools">
          <button class="tool" data-work-back>${ico('back')}<span>Мои работы</span></button>
          ${S.works.length > 1 ? `<button class="tool" data-work-next>${ico('next')}<span>Следующий</span></button>` : ''}
        </div>
        <div class="xp-addr"><span class="xp-addr__label">Адрес</span><div class="xp-addr__field">${ico('browser')}<span>${esc(host)}</span></div>
          ${w.url ? `<a class="btn btn--sm" href="${esc(w.url)}" target="_blank" rel="noopener">Переход</a>` : ''}</div>
        <div class="work__wrap">
          <div class="work__stage">
            <figure class="work__desk"><div class="work__chrome"><i></i><i></i><i></i></div><img src="${esc(w.shot)}" width="1200" height="750" alt="Скриншот сайта «${esc(w.title)}», версия для компьютера"></figure>
            ${w.shotMobile ? `<figure class="work__phone"><img src="${esc(w.shotMobile)}" width="390" height="844" alt="Скриншот сайта «${esc(w.title)}», версия для телефона"></figure>` : ''}
          </div>
          <article class="work__info">
            <p class="work__kind">${esc(w.kind)} · ${esc(w.year)}</p>
            <h2>${esc(w.title)}</h2>
            <p class="work__status">${esc(w.status)}</p>
            <h3>Для кого</h3>
            <p>${esc(w.audience)}</p>
            <h3>Задача</h3>
            <p>${esc(w.task)}</p>
            <h3>Что реализовано</h3>
            <ul>${w.done.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
            <h3>Особенность</h3>
            <p>${esc(w.features)}</p>
            <h3>Технологии</h3>
            <p class="work__stack">${w.stack.map((s) => `<span>${esc(s)}</span>`).join('')}</p>
            <div class="work__cta">
              ${w.url ? `<a class="btn btn--go" href="${esc(w.url)}" target="_blank" rel="noopener">Открыть сайт ↗</a>` : ''}
              <button class="btn" data-open="order" data-preset="${w.id}">Хочу похожий сайт</button>
            </div>
          </article>
        </div>
      </div>`).firstElementChild;
    $('[data-work-back]', body).addEventListener('click', () => { open('works'); close(winId); });
    $('[data-work-next]', body)?.addEventListener('click', () => { close(winId); open('work:' + next.id); });
    createWindow({ id: winId, title: `${w.file} — Просмотр проекта`, icon: 'browser', w: 980, h: 620, body, cls: 'win--work' });
  }

  /* ---------- Диалог-сообщение ---------- */

  let alerts = 0;
  function alertBox({ title, icon, text, action, link }) {
    const id = 'alert' + ++alerts;
    const body = html(`
      <div class="alert">
        <div class="alert__row">${ico(icon, 'alert__ico')}<p>${esc(text).replace(/\n/g, '<br>')}</p></div>
        <div class="alert__btns">
          ${action ? `<button class="btn" data-open="${action.open}" data-close>${esc(action.label)}</button>` : ''}
          ${link ? `<a class="btn" href="${esc(link.href)}"${link.href.startsWith('mailto') ? '' : ' target="_blank" rel="noopener"'}>${esc(link.label)}</a>` : ''}
          <button class="btn btn--default" data-close>OK</button>
        </div>
      </div>`).firstElementChild;
    $$('[data-close]', body).forEach((b) => b.addEventListener('click', () => close(id)));
    createWindow({ id, title, icon, w: 440, h: 210, body, resizable: false, cls: 'win--alert', center: true });
    $('.btn--default', body).focus();
  }

  /* ---------- Мастер заявки ---------- */

  const TYPES = [...S.services.map((s) => s.title), 'Пока не знаю'];
  const WHEN = ['Не указаны', 'Как можно скорее', 'В течение месяца', 'Не горит'];

  function chatLink(id, text) {
    const q = encodeURIComponent(text);
    if (id === 'whatsapp') return `https://wa.me/${C.whatsapp}?text=${q}`;
    if (id === 'telegram') return `https://t.me/${C.telegram}?text=${q}`;
    return `mailto:${C.email}?subject=${encodeURIComponent('Заявка на сайт')}&body=${q}`;
  }

  function wizard(opts = {}) {
    const data = { type: '', task: '', budget: '', when: WHEN[0], name: '', channel: channels[0]?.id || '', like: '' };
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
      if (id.startsWith('type:')) data.type = id.slice(5);
      else {
        const w = S.works.find((x) => x.id === id);
        if (!w) return;
        data.like = w.title;
      }
      render();
    };

    const head = (t, s) => `<div class="wiz__head"><div><b>${t}</b><span>Шаг ${step + 1} из 4. ${s}</span></div>${ico('order')}</div>`;

    function summary() {
      return [
        'Здравствуйте, Дмитрий! Хочу обсудить сайт.',
        '',
        `Тип сайта: ${data.type}`,
        data.like ? `Похожий на: ${data.like}` : null,
        `Задача: ${data.task}`,
        data.budget ? `Примерный бюджет: ${data.budget}` : null,
        data.when !== WHEN[0] ? `Сроки: ${data.when}` : null,
        '',
        `Меня зовут ${data.name}.`
      ].filter((x) => x !== null).join('\n');
    }

    function render() {
      $('[data-back]', root).disabled = step === 0;
      $('[data-next]', root).textContent = step === 3 ? 'Готово' : 'Далее >';

      if (step === 0) {
        page.innerHTML = head('Какой сайт вам нужен?', 'Выберите ближайший вариант, потом уточним.') + `
          <fieldset class="wiz__body wiz__radios">
            <legend class="visually-hidden">Тип сайта</legend>
            ${TYPES.map((t) => `
              <label class="radio"><input type="radio" name="type" value="${esc(t)}" ${data.type === t ? 'checked' : ''}><span>${esc(t)}</span></label>`).join('')}
            ${data.like ? `<p class="wiz__note">Ориентир: «${esc(data.like)}»</p>` : ''}
            <p class="wiz__err" role="alert" hidden>Выберите один из вариантов.</p>
          </fieldset>`;
      } else if (step === 1) {
        page.innerHTML = head('Расскажите о задаче', 'Пары фраз достаточно.') + `
          <div class="wiz__body wiz__grid">
            <label for="f-task">Что нужно сделать?</label>
            <textarea id="f-task" name="task" rows="4" required placeholder="Например: кофейня в центре города, нужно меню и бронь столика">${esc(data.task)}</textarea>
            <label for="f-budget">Примерный бюджет <small>(необязательно)</small></label>
            <input id="f-budget" name="budget" value="${esc(data.budget)}">
            <label for="f-when">Желаемые сроки <small>(необязательно)</small></label>
            <select id="f-when" name="when">
              ${WHEN.map((o) => `<option ${data.when === o ? 'selected' : ''}>${o}</option>`).join('')}
            </select>
            <p class="wiz__err" role="alert" hidden>Опишите задачу хотя бы парой слов.</p>
          </div>`;
      } else if (step === 2) {
        page.innerHTML = head('Как с вами связаться?', 'Заявку вы отправите сами через удобный канал.') + `
          <div class="wiz__body wiz__grid">
            <label for="f-name">Ваше имя</label>
            <input id="f-name" name="name" autocomplete="given-name" required value="${esc(data.name)}">
            <span class="wiz__lbl" id="lbl-channel">Способ связи</span>
            <div class="wiz__chips" role="radiogroup" aria-labelledby="lbl-channel">
              ${channels.map((c) => `<label class="chip"><input type="radio" name="channel" value="${c.id}" ${data.channel === c.id ? 'checked' : ''}>${ico(c.icon)}<span>${c.label}</span></label>`).join('')}
            </div>
            <p class="wiz__err" role="alert" hidden>Напишите, как к вам обращаться.</p>
          </div>`;
      } else {
        const ch = channels.find((c) => c.id === data.channel);
        page.innerHTML = head('Проверьте заявку', 'Осталось отправить.') + `
          <div class="wiz__body">
            <pre class="wiz__sum">${esc(summary())}</pre>
            <div class="wiz__copy"><button type="button" class="btn btn--sm" data-copy>Скопировать текст</button><span role="status" data-copied></span></div>
            <p class="wiz__muted">После нажатия «Готово» откроется ${ch.label} с этим текстом. Сообщение уйдёт, только когда вы сами его отправите.</p>
          </div>`;
        $('[data-copy]', page).addEventListener('click', async () => {
          const note = $('[data-copied]', page);
          try { await navigator.clipboard.writeText(summary()); note.textContent = 'Скопировано'; }
          catch (e) { note.textContent = 'Не удалось: выделите текст вручную'; }
        });
      }
      const first = $('input:checked, textarea, input, select', page);
      if (first && !touch && step > 0) first.focus();
    }

    function collect() {
      new FormData(root).forEach((v, k) => { data[k] = String(v).trim(); });
    }

    function fail(field) {
      $('.wiz__err', page).hidden = false;
      if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
    }

    function send() {
      const text = summary();
      const ch = data.channel;
      const href = chatLink(ch, text);
      if (ch === 'telegram') {
        // Копия в буфере — на случай веб-версии, где текст не подставляется
        navigator.clipboard?.writeText(text).catch(() => {});
        // Встроенный браузер Telegram перехватывает ссылки t.me и теряет текст — там открываем чат через tg://
        const inTelegram = 'TelegramWebviewProxy' in window || /Telegram/i.test(navigator.userAgent);
        if (inTelegram) location.href = `tg://resolve?domain=${C.telegram}&text=${encodeURIComponent(text)}`;
        else window.open(href, '_blank', 'noopener');
      } else if (ch === 'whatsapp') window.open(href, '_blank', 'noopener');
      else location.href = href;
      close('order');
      const label = channels.find((c) => c.id === ch).label;
      alertBox({
        title: 'Заявка подготовлена',
        icon: 'info',
        text: ch === 'email'
          ? `Заявка ещё не отправлена: нажмите «Отправить» в почтовой программе.\nЕсли она не открылась, напишите на ${C.email}.`
          : `Заявка ещё не отправлена: нажмите «Отправить» в ${label}.\n${ch === 'telegram' ? 'Если текст не подставился сам, он уже скопирован — вставьте его в чат.' : ''}`.trim(),
        link: ch === 'email' ? null : { href, label: `Открыть ${label} ещё раз` }
      });
    }

    root.addEventListener('submit', (e) => {
      e.preventDefault();
      collect();
      if (step === 0 && !data.type) return fail();
      if (step === 1 && !data.task) return fail($('#f-task', page));
      if (step === 2 && !data.name) return fail($('#f-name', page));
      if (step === 3) return send();
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
    e.preventDefault();
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
      if (opensOnClick(e)) { selectIcon(null); return open(el.dataset.open); }
      selectIcon(el, e.ctrlKey);
    });
    el.addEventListener('dblclick', () => open(el.dataset.open));
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
    if (on && e.detail === 0) $('button, a', start).focus();
  });
  start.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = $$('button, a', start);
    const i = items.indexOf(document.activeElement);
    items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus();
  });
  document.addEventListener('pointerdown', (e) => {
    if (!start.hidden && !e.target.closest('#start, #startbtn')) closeStart();
    if (!ctx.hidden && !e.target.closest('#ctx')) hideCtx();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!start.hidden) { closeStart(); return startBtn.focus(); }
    if (!ctx.hidden) return hideCtx();
    if (!$('#shutdown').hidden) return closeShutdown();
    const active = [...wins.entries()].find(([, o]) => o.el.classList.contains('is-active'));
    // Заявку по Esc не закрываем: потерялся бы набранный текст
    if (active && active[0] !== 'order' && active[0] !== 'hero') close(active[0]);
  });

  /* ---------- Часы ---------- */

  const clock = $('#clock');
  const fmt = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const fmtDate = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const tick = () => { const d = new Date(); clock.textContent = fmt.format(d); clock.title = fmtDate.format(d); clock.dateTime = d.toISOString(); };
  tick();
  setInterval(tick, 10000);
  $$('[data-year]').forEach((n) => { n.textContent = new Date().getFullYear(); });

  /* ---------- Выключение ---------- */

  const sd = $('#shutdown');
  const off = $('#off');
  const taskbar = $('#taskbar');
  function setBackgroundInert(on) { desktop.inert = on; taskbar.inert = on; }
  function openShutdown() { sd.hidden = false; setBackgroundInert(true); document.body.classList.add('is-grey'); $('[data-sd="off"]', sd).focus(); }
  function closeShutdown() { sd.hidden = true; setBackgroundInert(false); document.body.classList.remove('is-grey'); }
  sd.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sd]');
    if (!b) return;
    const m = b.dataset.sd;
    closeShutdown();
    if (m === 'off') { closeAll(); off.hidden = false; $('#poweron').focus(); }
    if (m === 'restart') { closeAll(); boot(); }
    if (m === 'standby') {
      document.body.classList.add('is-standby');
      setTimeout(() => {
        const wake = () => {
          document.body.classList.remove('is-standby');
          document.removeEventListener('pointerdown', wake);
          document.removeEventListener('keydown', wake);
        };
        document.addEventListener('pointerdown', wake);
        document.addEventListener('keydown', wake);
      }, 50);
    }
  });
  $('#poweron').addEventListener('click', () => { off.hidden = true; boot(); });

  /* ---------- Загрузка ---------- */

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
      ready();
      setTimeout(() => { el.hidden = true; }, reduced ? 0 : 250);
    };
    const timer = setTimeout(finish, reduced ? 0 : 1300);
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
    }, reduced ? 0 : 900);
  }

  const HASHES = ['works', 'about', 'services', 'process', 'reviews', 'order', 'contacts'];

  function ready() {
    document.body.classList.remove('is-booting');
    try { sessionStorage.setItem('booted', '1'); } catch (e) { /* приватный режим */ }
    open('hero');
    const hash = location.hash.slice(1);
    if (HASHES.includes(hash)) open(hash);
  }

  addEventListener('hashchange', () => {
    const hash = location.hash.slice(1);
    if (HASHES.includes(hash)) open(hash);
  });

  $('#welcome').hidden = true;
  if (document.documentElement.classList.contains('skip-boot')) {
    $('#boot').hidden = true;
    ready();
  } else {
    boot();
  }
})();
