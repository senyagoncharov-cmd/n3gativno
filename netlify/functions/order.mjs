// Принимает заказ с сайта и пересылает его продавцу в Telegram через бота.
// Нужны переменные окружения в Netlify: TG_BOT_TOKEN и TG_CHAT_ID.
const clean = (v, n = 80) => String(v ?? '').replace(/[<>&]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

export default async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const { TG_BOT_TOKEN, TG_CHAT_ID } = process.env;
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return new Response('Not configured', { status: 500 });

  let data;
  try { data = await req.json(); } catch { return new Response('Bad JSON', { status: 400 }); }
  if (data.company) return new Response('ok'); // ловушка для спам-ботов

  const name = clean(data.name, 60), contact = clean(data.contact, 60);
  const items = Array.isArray(data.items) ? data.items.slice(0, 30) : [];
  if (!name || contact.length < 3 || !items.length) return new Response('Bad order', { status: 400 });

  const lines = items.map(i => {
    const qty = Math.min(Math.max(parseInt(i.qty) || 1, 1), 8);
    return `— ${clean(i.brand)} ${clean(i.name)}, ${clean(i.size, 10)} × ${qty}`;
  });
  const total = items.reduce((a, i) => a + Math.min(Math.max(parseInt(i.qty) || 1, 1), 8), 0);
  const tgLink = /^@?[A-Za-z]\w{3,31}$/.test(contact) ? `https://t.me/${contact.replace('@', '')}` : '';
  const when = new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' });

  const text =
    `🛍 <b>Новый заказ с сайта</b>\n\n${lines.join('\n')}\n\nВсего: ${total} шт.\n\n` +
    `👤 ${name}\n📱 ${tgLink ? `<a href="${tgLink}">${contact}</a>` : contact}\n🕒 ${when}`;

  const r = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: TG_CHAT_ID, text, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  if (!r.ok) { console.error(await r.text()); return new Response('Telegram error', { status: 502 }); }
  return new Response('ok');
};
