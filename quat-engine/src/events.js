/** Tiny event bus. Pattern from this lab's Aether Kernel. */

export class EventBus {
  constructor() {
    this.events = Object.create(null);
  }
  on(event, cb) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(cb);
    return () => this.off(event, cb);
  }
  off(event, cb) {
    const list = this.events[event];
    if (!list) return;
    const i = list.indexOf(cb);
    if (i >= 0) list.splice(i, 1);
  }
  emit(event, data) {
    const list = this.events[event];
    if (!list) return;
    for (const cb of list) cb(data);
  }
}
