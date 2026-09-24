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
  panel.className = 'panel';
  panel.style.display = 'none';
  document.body.appendChild(panel);

  const style = document.createElement('style');
  style.textContent = `
    #settings {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      width: min(440px, calc(100vw - 28px)); max-height: 86vh; overflow-y: auto;
      z-index: 9; padding: 20px 22px;
    }
    #settings .row { display: flex; gap: 8px; align-items: center; margin: 6px 0; flex-wrap: wrap; }
    #settings input, #settings select {
      font: inherit; color: inherit; background: #fff;
      border: 3px solid var(--edge); border-radius: 12px; padding: 7px 11px; flex: 1; min-width: 120px; outline: none;
    }
    #settings input:focus, #settings select:focus { border-color: var(--accent); }
    #settings button:not(.closex) {
      font: inherit; background: var(--gold); color: var(--gold-ink); border: none;
      border-radius: 12px; padding: 8px 15px; cursor: pointer; font-weight: 800;
    }
    #settings button.soft { background: var(--edge-2); color: var(--ink); }
    #settings .keys { display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 13px; }
    #settings kbd {
      font-family: inherit; font-size: 11px; font-weight: 800; background: var(--gold); color: var(--gold-ink);
      border-radius: 5px; padding: 1px 6px;
    }
  `;
  document.head.appendChild(style);

  let open = false;

  function render() {
    panel.innerHTML = `
      <button class="closex" aria-label="close">✕</button>
      <h3>⚙️ Settings</h3>
      <div class="sub">Everything here is optional. The island doesn’t mind either way.</div>

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
      <div class="sub">Day, night, and the weather schedule follow this clock.</div>

      <h4>Controls</h4>
      <div class="keys">
        <span><kbd>WASD</kbd></span><span>walk — double-tap (or hold Shift) to run</span>
        <span><kbd>drag</kbd></span><span>turn the camera · scroll or pinch to zoom</span>
        <span><kbd>E</kbd></span><span>talk · use · pick up (or tap the prompt)</span>
        <span><kbd>P</kbd></span><span>the map</span>
        <span><kbd>I</kbd></span><span>your pockets</span>
        <span><kbd>C</kbd></span><span>Old Tansy’s almanac</span>
        <span><kbd>H</kbd></span><span>cycle your hats</span>
        <span><kbd>O</kbd></span><span>visit a friend (or invite one)</span>
        <span><kbd>M</kbd></span><span>sound on / off</span>
      </div>
      <div class="foot">Esc to close</div>
    `;

    panel.querySelector('.closex').onclick = hide;
    panel.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (e) => e.stopPropagation()));
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
    ui.setVeil(true, hide);
  }

  function hide() {
    panel.style.display = 'none';
    open = false;
    ui.setVeil(false);
  }

  document.getElementById('title')?.addEventListener('click', () => (open ? hide() : show()));
  addEventListener('notbell-settings', () => (open ? hide() : show()));
  addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) hide();
  });
}
