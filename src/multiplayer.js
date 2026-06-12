// Visitors. Press O: host an island (you get an invite code to send), or
// join with a friend's code. Raw WebRTC, no third-party servers, no
// accounts — the "code" IS the connection, passed by hand like a note.
// Built for two friends and an island tour, not for the masses.

import * as THREE from 'three';
import { buildAnimal } from './animals.js';
import { applyHat } from './hats.js';
import * as zones from './zones.js';
import * as ui from './ui.js';
import { state } from './state.js';
import { jingle, doorChime } from './audio.js';

const STUN = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

function encode(desc) {
  return btoa(JSON.stringify(desc));
}

function decode(code) {
  return JSON.parse(atob(code.trim()));
}

async function gathered(pc) {
  if (pc.iceGatheringState === 'complete') return;
  await new Promise((res) => {
    pc.addEventListener('icegatheringstatechange', function f() {
      if (pc.iceGatheringState === 'complete') {
        pc.removeEventListener('icegatheringstatechange', f);
        res();
      }
    });
    setTimeout(res, 4000); // good enough is good enough
  });
}

export function createMultiplayer(player, scene) {
  const peers = []; // { channel, avatar: {group, kind, hat, target, lastPos} }

  function nameSprite(text) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 64;
    const c2 = cv.getContext('2d');
    c2.font = '700 30px ui-rounded, "Segoe UI", system-ui, sans-serif';
    c2.textAlign = 'center';
    c2.textBaseline = 'middle';
    c2.fillStyle = 'rgba(60,50,36,0.75)';
    const w = Math.min(244, c2.measureText(text).width + 26);
    c2.roundRect((256 - w) / 2, 8, w, 48, 24);
    c2.fill();
    c2.fillStyle = '#fff7e6';
    c2.fillText(text, 128, 34);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    spr.scale.set(1.7, 0.43, 1);
    spr.position.y = 2.3;
    return spr;
  }

  function makeAvatar(kind, name) {
    const group = buildAnimal(kind || 'cat', { body: 0xc9a06a });
    group.visible = false;
    if (name) group.add(nameSprite(name));
    scene.add(group);
    return {
      group, kind: kind || 'cat', name: name || '', hat: null,
      target: new THREE.Vector3(),
      ry: 0, zone: 'island', walk: 0, lastPos: new THREE.Vector3(),
    };
  }

  function wireChannel(channel) {
    const peer = { channel, avatar: null, sendTimer: 0 };
    channel.onopen = () => {
      jingle();
      ui.toast('A visitor steps off the horizon. Show them everything.', '🛶');
    };
    channel.onclose = () => {
      if (peer.avatar) scene.remove(peer.avatar.group);
      const i = peers.indexOf(peer);
      if (i >= 0) peers.splice(i, 1);
      ui.toast('Your visitor has sailed home.', '👋');
    };
    channel.onmessage = (ev) => {
      try {
        const m = JSON.parse(ev.data);
        if (!peer.avatar || peer.avatar.kind !== m.kind || peer.avatar.name !== (m.name || '')) {
          if (peer.avatar) scene.remove(peer.avatar.group);
          peer.avatar = makeAvatar(m.kind, m.name || 'Visitor');
        }
        const av = peer.avatar;
        av.target.set(m.x, m.y, m.z);
        av.ry = m.ry;
        av.zone = m.zone;
        if (m.hat !== av.hat) {
          av.hat = m.hat;
          applyHat(av.group, m.hat);
        }
      } catch { /* a gull pecked the packet */ }
    };
    peers.push(peer);
    return peer;
  }

  async function host() {
    const pc = new RTCPeerConnection(STUN);
    const channel = pc.createDataChannel('notbell');
    wireChannel(channel);
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = encode(pc.localDescription);
    try { await navigator.clipboard.writeText(code); } catch { /* below */ }
    await ui.say([
      'Invite copied to your clipboard! Send the whole blob to your visitor — it is long; it is supposed to be long. It is the boat.',
      'When they send back THEIR code, press O again and choose “Finish inviting.”',
    ]);
    pendingHost = pc;
  }

  let pendingHost = null;

  async function finishHost() {
    const reply = window.prompt('Paste your visitor’s reply code:');
    if (!reply || !pendingHost) return;
    try {
      await pendingHost.setRemoteDescription(decode(reply));
      ui.toast('The tide is bringing them in…', '🌊');
    } catch {
      ui.say('That code didn’t take. Make sure the whole blob arrived — every last barnacle of it.');
    }
  }

  async function join() {
    const invite = window.prompt('Paste the invite code from your host:');
    if (!invite) return;
    try {
      const pc = new RTCPeerConnection(STUN);
      pc.ondatachannel = (ev) => wireChannel(ev.channel);
      await pc.setRemoteDescription(decode(invite));
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      const code = encode(pc.localDescription);
      try { await navigator.clipboard.writeText(code); } catch { /* shrug */ }
      await ui.say([
        'Your reply code is on your clipboard — send it back to your host.',
        'Once they paste it in, you’ll wash up on their shore. Mind the tide pools.',
      ]);
    } catch {
      ui.say('That code didn’t take. Ask your host to send it again — all of it.');
    }
  }

  addEventListener('keydown', async (e) => {
    if (e.code !== 'KeyO' || e.repeat || ui.isBusy()) return;
    const opts = [
      { label: '🏝️ Host — invite a friend', value: 'host' },
      { label: '🛶 Join a friend’s island', value: 'join' },
      { label: 'Never mind', value: null },
    ];
    if (pendingHost) opts.splice(1, 0, { label: '✉️ Finish inviting (paste their reply)', value: 'finish' });
    const choice = await ui.ask('Visitors! (Two friends, one archipelago, codes passed by hand.)', opts);
    if (choice === 'host') host();
    else if (choice === 'finish') finishHost();
    else if (choice === 'join') join();
  });

  let sendT = 0;

  function update(dt) {
    // broadcast where we are, ten times a second
    sendT -= dt;
    if (sendT <= 0 && peers.length) {
      sendT = 0.1;
      const p = player.group.position;
      const msg = JSON.stringify({
        x: +p.x.toFixed(2), y: +p.y.toFixed(2), z: +p.z.toFixed(2),
        ry: +player.group.rotation.y.toFixed(2),
        zone: zones.current(),
        kind: (state.avatar || {}).kind || 'cat',
        name: state.name || 'Visitor',
        hat: state.wearing,
      });
      for (const peer of peers) {
        if (peer.channel.readyState === 'open') peer.channel.send(msg);
      }
    }
    // glide the visitors to where they say they are
    for (const peer of peers) {
      const av = peer.avatar;
      if (!av) continue;
      av.group.visible = av.zone === zones.current();
      if (!av.group.visible) continue;
      av.lastPos.copy(av.group.position);
      av.group.position.lerp(av.target, Math.min(1, dt * 10));
      av.group.rotation.y += (av.ry - av.group.rotation.y) * Math.min(1, dt * 10);
      const speed = av.lastPos.distanceTo(av.group.position) / Math.max(dt, 1e-4);
      av.walk += ((speed > 0.5 ? 1 : 0) - av.walk) * Math.min(1, dt * 8);
      const parts = av.group.userData.parts;
      for (let i = 0; i < parts.legs.length; i++) {
        const phase = i === 0 || i === 3 ? 0 : Math.PI;
        parts.legs[i].rotation.x = Math.sin(performance.now() / 100 + phase) * 0.7 * av.walk;
      }
    }
  }

  void doorChime;
  return { update };
}
