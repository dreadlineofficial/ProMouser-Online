/* =====================================================================
   ProMouser Online: realtime
   channel(topic) gives broadcast messages + presence (who is here).
   Supabase mode: Supabase Realtime channels.
   Demo mode: BroadcastChannel between tabs of this browser, with presence
   kept by heartbeats.
   Nothing private is sent over broadcast: chat content stays in the database;
   broadcasts only say "you have something new" or carry game state.
   ===================================================================== */
import { api } from './api.js';

class DemoChannel {
  constructor(topic, { key, self }) {
    this.topic = topic; this.key = key || 'anon-' + Math.random().toString(36).slice(2); this.self = !!self;
    this.handlers = {}; this.pres = new Map(); this.presFns = []; this.state = null; this.timer = null;
  }
  on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); return this; }
  onPresence(fn) { this.presFns.push(fn); return this; }
  _emit(e, d, from) { (this.handlers[e] || []).forEach(f => { try { f(d, from); } catch (x) { console.error(x); } }); }
  _pres() { const list = [...this.pres.entries()].map(([key, v]) => ({ key, ...v.state })); this.presFns.forEach(f => f(list)); }
  join(state) {
    this.bc = new BroadcastChannel('pmo:' + this.topic);
    this.bc.onmessage = ({ data: m }) => {
      if (m.k === 'm') this._emit(m.e, m.d, m.from);
      else if (m.k === 'p') { const had = this.pres.has(m.key), prev = had && JSON.stringify(this.pres.get(m.key).state); this.pres.set(m.key, { state: m.state, seen: Date.now() }); if (!had || prev !== JSON.stringify(m.state)) this._pres(); }
      else if (m.k === 'pl') { if (this.pres.delete(m.key)) this._pres(); }
      else if (m.k === 'pq' && this.state) this._beat();
    };
    this.timer = setInterval(() => {
      if (this.state) this._beat();
      let changed = false; this.pres.forEach((v, k) => { if (k !== this.key && Date.now() - v.seen > 6500) { this.pres.delete(k); changed = true; } });
      if (changed) this._pres();
    }, 2000);
    this._unload = () => this.leave(); addEventListener('pagehide', this._unload);
    if (state) this.track(state);
    this.bc.postMessage({ k: 'pq' });
    return Promise.resolve(this);
  }
  _beat() { this.bc && this.bc.postMessage({ k: 'p', key: this.key, state: this.state }); }
  track(state) { this.state = state; this.pres.set(this.key, { state, seen: Date.now() }); this._beat(); this._pres(); }
  send(e, d) { if (!this.bc) return; this.bc.postMessage({ k: 'm', e, d, from: this.key }); if (this.self) this._emit(e, d, this.key); }
  leave() { if (!this.bc) return; if (this.state) this.bc.postMessage({ k: 'pl', key: this.key }); clearInterval(this.timer); this.bc.close(); this.bc = null; removeEventListener('pagehide', this._unload); }
}

class SbChannel {
  constructor(topic, { key, self }) { this.topic = topic; this.key = key; this.self = !!self; this.handlers = {}; this.presFns = []; }
  on(event, fn) { (this.handlers[event] = this.handlers[event] || []).push(fn); return this; }
  onPresence(fn) { this.presFns.push(fn); return this; }
  join(state) {
    const c = api.client;
    this.ch = c.channel(this.topic, { config: { broadcast: { self: this.self }, presence: { key: this.key || '' } } });
    this.ch.on('broadcast', { event: 'm' }, ({ payload }) => (this.handlers[payload.e] || []).forEach(f => { try { f(payload.d, payload.from); } catch (x) { console.error(x); } }));
    this.ch.on('presence', { event: 'sync' }, () => {
      const st = this.ch.presenceState(), list = Object.entries(st).map(([key, metas]) => ({ key, ...(metas[metas.length - 1] || {}) }));
      this.presFns.forEach(f => f(list));
    });
    return new Promise(res => {
      let done = false;
      this.ch.subscribe(async status => {
        if (status === 'SUBSCRIBED' && !done) { done = true; if (state) await this.track(state); res(this); }
      });
      setTimeout(() => { if (!done) { done = true; res(this); } }, 8000);
    });
  }
  async track(state) { this.state = state; if (this.ch) await this.ch.track(state); }
  send(e, d) { if (this.ch) this.ch.send({ type: 'broadcast', event: 'm', payload: { e, d, from: this.key } }); }
  leave() { if (this.ch) { api.client.removeChannel(this.ch); this.ch = null; } }
}

export function channel(topic, opts = {}) { return api.mode === 'supabase' ? new SbChannel(topic, opts) : new DemoChannel(topic, opts); }

/* ---------- per-user inbox: "you have a new message / request / invite" ---------- */
const outbox = new Map();   // topic -> joined channel (kept for a minute)
export async function ping(userId, type, data = {}) {
  const t = 'user:' + userId; let c = outbox.get(t);
  if (!c) { c = channel(t, { key: api.userId() }); outbox.set(t, c); await c.join(); setTimeout(() => { c.leave(); outbox.delete(t); }, 60000); }
  c.send(type, { ...data, from: api.userId() });
}
let inbox = null;
export function listen(handlers) {
  const id = api.userId(); if (!id) return null;
  if (inbox && inbox.topic !== 'user:' + id) { inbox.leave(); inbox = null; }
  if (!inbox) { inbox = channel('user:' + id, { key: id }); inbox.join(); }
  Object.entries(handlers).forEach(([e, f]) => inbox.on(e, f));
  return inbox;
}

/* ---------- global presence: who is online and what they're doing ---------- */
let world = null; const worldFns = new Set(); let online = [];
export function presence(state) {
  const id = api.userId(); if (!id) return;
  if (!world) { world = channel('online', { key: id }); world.onPresence(list => { online = list; worldFns.forEach(f => f(list)); }); world.join(state); }
  else world.track(state);
}
export const onOnline = fn => { worldFns.add(fn); fn(online); return () => worldFns.delete(fn); };
export const onlineIds = () => new Set(online.map(p => p.key));
export const statusOf = id => (online.find(p => p.key === id) || {}).status || null;
