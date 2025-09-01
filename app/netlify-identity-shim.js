// Minimal shim to satisfy `require('netlify-identity-widget')` without bundling the package.
// Exports the global injected by the official CDN build loaded in index.html.
/* eslint-disable no-undef */
const getWidget = () => {
  if (typeof window !== 'undefined' && window.netlifyIdentity) {
    return window.netlifyIdentity;
  }
  // Not yet loaded; provide a lazy proxy that defers until the script has loaded
  const pending = [];
  const proxy = new Proxy({}, {
    get(_, prop) {
      return (...args) => {
        const target = (typeof window !== 'undefined' && window.netlifyIdentity);
        if (!target) {
          // Be quiet in production: queue calls without spamming the console.
          // Use debug so local dev can opt-in via console filter if needed.
          try { console.debug('[netlify-identity] widget not loaded yet; queuing call to', String(prop)); } catch {}
          pending.push([prop, args]);
          return undefined;
        }
        const fn = target[prop];
        return typeof fn === 'function' ? fn.apply(target, args) : fn;
      };
    }
  });
  // When the global appears, flush any queued calls
  const interval = setInterval(() => {
    if (typeof window !== 'undefined' && window.netlifyIdentity) {
      clearInterval(interval);
      for (const [prop, args] of pending.splice(0)) {
        const fn = window.netlifyIdentity[prop];
        if (typeof fn === 'function') fn.apply(window.netlifyIdentity, args);
      }
    }
  }, 50);
  return proxy;
};

module.exports = getWidget();
