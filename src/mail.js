// The mail. Moss has finished sorting (it was thorough), and the Notbell
// Post is open: buy a stamp at his counter, write to anyone on the island,
// and a few minutes later your letter is in their mailbox with the little
// flag up. A while after that they've read it, and their answer is in
// yours. The Farther postcard can go too — "they'll know what to do."
//
// State lives in S.state.mail ({ out, inbox }); letters are plain text, and
// only ever reach the page through ui.say (textContent), never innerHTML.
// A postal carrier who walks a real route is still in docs/BACKLOG.md (C8).

import * as S from './state.js';
import * as ui from './ui.js';
import { jingle, kaching } from './audio.js';
import { ITEMS } from './catalog.js';
import { MAIL_REPLIES, VILLAGER_NAMES } from './villagers.js';

export const STAMP = 5;
const DELIVER_MS = 3 * 60 * 1000; // Moss is not slow. Moss is thorough.
const REPLY_MS = 4 * 60 * 1000;   // and they like to think before they write back
const MAX_TEXT = 280;
const KEEP = 40;                  // letters kept either way (old ones fall off the end)

const box = () => S.state.mail;

export function send(to, text, kind = 'letter') {
  const m = box();
  m.out.push({ to, text: String(text || '').slice(0, MAX_TEXT), kind, at: Date.now(), delivered: false, replied: false });
  if (m.out.length > KEEP) m.out.splice(0, m.out.length - KEEP);
  S.save();
}

function replyFor(to, kind) {
  const lines = MAIL_REPLIES[to] || MAIL_REPLIES._default;
  // a different answer each time you write to the same neighbor
  const n = box().inbox.filter((l) => l.from === to).length;
  const body = lines.letters[n % lines.letters.length];
  const pages = [
    `Dear ${S.state.name || 'neighbor'},`,
    ...(kind === 'postcard' ? [lines.postcard || MAIL_REPLIES._default.postcard] : []),
    body,
    `— ${lines.sign || to}`,
  ];
  return pages;
}

// called about once a second (houses.js): letters arrive, get read, get
// answered, on their own clock
let pollT = 0;
export function poll(dt) {
  pollT -= dt;
  if (pollT > 0) return;
  pollT = 1;
  const m = box(), now = Date.now();
  let changed = false;
  for (const l of m.out) {
    if (!l.delivered && now - l.at >= DELIVER_MS) { l.delivered = true; changed = true; }
    if (l.delivered && !l.replied && now - l.at >= DELIVER_MS + REPLY_MS) {
      l.replied = true;
      m.inbox.push({ from: l.to, pages: replyFor(l.to, l.kind), at: now, read: false });
      if (m.inbox.length > KEEP) m.inbox.splice(0, m.inbox.length - KEEP);
      changed = true;
      jingle();
      ui.toast(`A letter from <b>${ui.escapeHtml(l.to)}</b> is waiting in your mailbox.`, '📬');
    }
  }
  if (changed) S.save();
}

// is there a letter from you sitting in their box, flag up, not yet read?
export function flagUp(name) {
  return box().out.some((l) => l.to === name && l.delivered && !l.replied);
}
export function unread() {
  return box().inbox.filter((l) => !l.read).length;
}

// your mailbox: new letters first, one at a time; then, if you like, the old ones
export async function checkMailbox() {
  const m = box();
  const fresh = m.inbox.filter((l) => !l.read);
  if (fresh.length) {
    for (const l of fresh) {
      l.read = true;
      S.save();
      await ui.say([`A letter from ${l.from}.`, ...l.pages]);
    }
    return;
  }
  const waiting = m.out.filter((l) => !l.replied).length;
  if (!m.inbox.length) {
    ui.say(waiting
      ? 'Empty — but a letter of yours is out there, being thorough. Replies come back to this box.'
      : 'Empty, and very clean. A card inside: “The Post is open. Stamps at the counter. —Moss.”');
    return;
  }
  const pick = await ui.ask(waiting ? 'Nothing new yet. (Your letter’s still on its way.) Read an old one?' : 'Nothing new. Read an old one?', [
    ...m.inbox.slice(-6).reverse().map((l, i) => ({ label: `✉️ From ${l.from}`, value: i })),
    { label: 'Close the mailbox', value: null },
  ]);
  if (pick === null || pick === undefined) return;
  const l = m.inbox.slice(-6).reverse()[pick];
  if (l) await ui.say([`A letter from ${l.from}.`, ...l.pages]);
}

// choosing who to write to: the whole island, a page at a time
async function chooseRecipient(prompt) {
  const names = VILLAGER_NAMES;
  const PER = 8;
  for (let page = 0; ;) {
    const slice = names.slice(page * PER, page * PER + PER);
    const more = (page + 1) * PER < names.length;
    const choice = await ui.ask(prompt, [
      ...slice.map((n) => ({ label: `✉️ ${n}`, value: n })),
      ...(more || page > 0 ? [{ label: more ? 'More neighbors…' : 'Back to the first page', value: '__more' }] : []),
      { label: 'Never mind', value: null },
    ], { speaker: 'Moss', voice: 200 });
    if (choice !== '__more') return choice;
    page = more ? page + 1 : 0;
  }
}

// Moss's counter
export async function counter() {
  const hasCard = S.countItem('postcard_farther') > 0;
  const what = await ui.ask('“The sorting is complete. It was thorough. What can the Post do for you?”', [
    { label: `✉️ Send a letter`, value: 'letter', hint: `${STAMP}🔘`, disabled: S.state.buttons < STAMP },
    ...(hasCard ? [{ label: `${ITEMS.postcard_farther.emoji} Mail the Farther postcard`, value: 'postcard' }] : []),
    { label: 'Just visiting', value: null },
  ], { speaker: 'Moss', voice: 200 });
  if (!what) return false;
  const to = await chooseRecipient(what === 'postcard' ? '“A postcard. Lovely. Who is it for?”' : '“A letter. Who is it for?”');
  if (!to) return true;
  if (what === 'postcard') {
    if (!S.removeItem('postcard_farther')) return true;
    send(to, 'Wish you were farther.', 'postcard');
    jingle();
    ui.toast('Stamped, gently.', '📮');
    await ui.say(`“Farther, to ${to}. It is already a well-travelled card. I will add to its travels.”`, { speaker: 'Moss', voice: 200 });
    return true;
  }
  const text = await ui.input(`“Write whatever you like. ${to} will read every word. I will read none of them. That is the job.”`, {
    speaker: 'Moss', voice: 200, long: true, placeholder: `Dear ${to}…`,
  });
  if (!text) {
    await ui.say('“A blank letter. Very mysterious. Perhaps another day.”', { speaker: 'Moss', voice: 200 });
    return true;
  }
  if (!S.spend(STAMP)) return true;
  kaching();
  ui.updateHUD();
  send(to, text, 'letter');
  await ui.say([
    `“To ${to}. Stamped — a good one, with a button on it.”`,
    '“It will be in their box in a few minutes, and they will write back when they have thought about it. Replies come to your mailbox.”',
  ], { speaker: 'Moss', voice: 200 });
  return true;
}
