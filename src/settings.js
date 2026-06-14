// Settings: a quiet panel behind the title chip (or the ⚙ button on touch).
// Display name, a sound toggle, and a clock nudge for travelers — all
// optional, none of it required to play.

import { state, save } from './state.js';
import * as ui from './ui.js';
import { isMuted } from './audio.js';

export function initSettings() {
  window.__notbellTz = state.tz || 0;

  const panel = document.createElement('div');
  panel.id = 'settings';
  panel.style.display = 'none';
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #settings {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(420px, 92vw); max-height: 84vh; overflow-y: auto;
      background: #fffaf0; border: 3px solid #e8d5ae; border-radius: 20px;
      box-shadow: 0 14px 40px rgba(0,0,0,0.35); color: #5b4a32;
      font-size: 14px; z-index: 9; padding: 18px 20px;
    }
    #settings h3 { margin: 0 0 4px; }
    #settings h4 { margin: 14px 0 6px; border-bottom: 2px solid #efe2c4; padding-bottom: 3px; }
    #settings .row { display: flex; gap: 8px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
    #settings input, #settings select {
      font: inherit; color: inherit; background: #fff;
      border: 2px solid #e8d5ae; border-radius: 10px; padding: 6px 10px; flex: 1; min-width: 120px;
    }
    #settings button {
      font: inherit; background: #ffd23e; color: #5a4516; border: none;
      border-radius: 10px; padding: 7px 14px; cursor: pointer; font-weight: 700;
    }
    #settings button.soft { background: #efe2c4; }
    #settings .dim { opacity: 0.6; font-size: 12.5px; }
    #title { cursor: pointer; }
  `;
  document.head.appendChild(style);

  let open = false;

  function render() {
    panel.innerHTML = `
      <h3>⚙️ Settings</h3>
      <div class="dim">Everything here is optional. The island doesn’t mind either way.</div>

      <h4>You</h4>
      <div class="row">
        <input id="set-name" maxlength="16" placeholder="display name" value="${ui.escapeHtml(state.name || '')}">
        <button id="set-name-go">Rename</button>
      </div>

      <h4>Sound</h4>
      <div class="row">
        <button id="set-sound" class="soft">${isMuted() ? '🔇 Sound is off — turn on' : '🔔 Sound is on — turn off'}</button>
      </div>

      <h4>The clock</h4>
      <div class="row">
        <select id="set-tz">
          ${[...Array(25)].map((_, i) => {
            const v = i - 12;
            const label = v === 0 ? 'device clock (recommended)' : `nudge ${v > 0 ? '+' : ''}${v}h`;
            return `<option value="${v}" ${v === (state.tz || 0) ? 'selected' : ''}>${label}</option>`;
          }).join('')}
      </select>
      </div>
      <div class="dim">Day, night, and the weather schedule follow this clock.</div>
      <div class="dim" style="text-align:center;margin-top:12px">Esc or click the title to close</div>
    `;

    panel.querySelector('#set-name-go').onclick = () => {
      const v = panel.querySelector('#set-name').value.trim().slice(0, 16);
      if (!v) return;
      state.name = v;
      save();
      ui.updateHUD();
      ui.toast(`The islanders will call you <b>${ui.escapeHtml(v)}</b> now.`, '✨');
    };
    panel.querySelector('#set-sound').onclick = () => {
      // M is the mute key; settings speaks fluent keyboard, like everything
      dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyM', bubbles: true }));
      render();
    };
    panel.querySelector('#set-tz').onchange = (e) => {
      state.tz = parseInt(e.target.value, 10) || 0;
      window.__notbellTz = state.tz;
      save();
      ui.toast(state.tz === 0 ? 'The island trusts your clock again.' : `Island clock nudged ${state.tz > 0 ? '+' : ''}${state.tz}h.`, '🕰️');
    };
  }

  function show() {
    if (ui.isBusy()) return;
    render();
    panel.style.display = 'block';
    open = true;
  }

  function hide() {
    panel.style.display = 'none';
    open = false;
  }

  document.getElementById('title')?.addEventListener('click', () => (open ? hide() : show()));
  addEventListener('notbell-settings', () => (open ? hide() : show()));
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) hide();
  });
}
