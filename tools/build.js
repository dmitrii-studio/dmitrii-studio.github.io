/*
  Собирает текстовую версию сайта из js/config.js и вписывает её в index.html,
  обновляет номер версии файлов и sitemap.xml. Запуск из любой папки: node tools/build.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8').replace(/\r\n/g, '\n');
const ctx = { window: {} };
vm.runInNewContext(read('js/config.js'), ctx);
const S = ctx.window.SITE;
const C = S.contacts;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function aboutHtml(text) {
  return text.trim().split(/\n\s*\n+/).map((block) => {
    const lines = block.split('\n');
    if (/^[А-ЯЁ\s]+$/.test(lines[0].trim()) && lines.length > 1) {
      const items = lines.slice(1).map((l) => `<li>${esc(l.replace(/^\s*•\s*/, ''))}</li>`).join('');
      return `<h3>${esc(lines[0].trim())}</h3><ul>${items}</ul>`;
    }
    return `<p>${esc(block.replace(/\n/g, ' '))}</p>`;
  }).join('\n');
}

const links = [
  C.telegram && `<li><a href="https://t.me/${C.telegram}">Telegram: @${esc(C.telegram)}</a></li>`,
  C.whatsapp && `<li><a href="https://wa.me/${C.whatsapp}">WhatsApp: +${esc(C.whatsapp)}</a></li>`,
  C.email && `<li><a href="mailto:${C.email}">Почта: ${esc(C.email)}</a></li>`
].filter(Boolean).join('\n');

const page = `
<section id="works">
<h2>Мои работы</h2>
${S.works.map((w) => `<article id="work-${w.id}">
<h3>${esc(w.title)}</h3>
<img src="${esc(w.thumb)}" width="480" height="300" loading="lazy" alt="Скриншот сайта «${esc(w.title)}»">
<p><b>${esc(w.kind)}, ${esc(w.year)}.</b> ${esc(w.status)}</p>
<p><b>Для кого:</b> ${esc(w.audience)}</p>
<p><b>Задача:</b> ${esc(w.task)}</p>
<ul>${w.done.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
<p><b>Особенность:</b> ${esc(w.features)}</p>
<p><b>Технологии:</b> ${w.stack.map(esc).join(', ')}.</p>
${w.url ? `<p><a href="${esc(w.url)}">Открыть сайт</a></p>` : ''}
</article>`).join('\n')}
</section>
<section id="about">
<h2>Обо мне</h2>
${aboutHtml(S.about)}
</section>
<section id="services">
<h2>Услуги</h2>
${S.services.map((s) => `<h3>${esc(s.title)}</h3>\n<p>${esc(s.text)}${s.price ? ` ${esc(s.price)}.` : ''}</p>`).join('\n')}
</section>
<section id="process">
<h2>Как проходит работа</h2>
<ol>${S.process.map((p) => `<li><b>${esc(p.title)}.</b> ${esc(p.text)}</li>`).join('')}</ol>
</section>
<section id="reviews">
<h2>Отзывы</h2>
${S.reviews.length
    ? S.reviews.map((r) => `<blockquote><p>${esc(r.text)}</p><p>${esc(r.author)}${r.project ? `, ${esc(r.project)}` : ''}</p></blockquote>`).join('\n')
    : '<p>Отзывов пока нет. Надеюсь, именно ваш отзыв станет первым!</p>'}
</section>
<section id="order">
<h2>Заказать сайт и контакты</h2>
<p>Напишите, какой сайт вам нужен и какую задачу он должен решать:</p>
<ul id="contacts">
${links}
</ul>
</section>
`;

const version = new Date().toISOString().replace(/\D/g, '').slice(0, 12);
let index = read('index.html');
index = index.replace(/<!-- static:start -->[\s\S]*?<!-- static:end -->/, () => `<!-- static:start -->${page}<!-- static:end -->`);
index = index.replace(/(css\/style\.css|js\/config\.js|js\/main\.js)(\?v=\d+)?"/g, `$1?v=${version}"`);
index = index.replace(/(rel="canonical" href=")[^"]+/, `$1${S.url}`);
index = index.replace(/(og:url" content=")[^"]+/, `$1${S.url}`);
index = index.replace(/(og:image" content=")[^"]+/, `$1${S.url}assets/og.jpg`);
fs.writeFileSync(path.join(root, 'index.html'), index);

fs.writeFileSync(path.join(root, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${S.url}</loc>
    <lastmod>${new Date().toISOString().slice(0, 10)}</lastmod>
  </url>
</urlset>
`);
console.log('Готово, версия', version);
