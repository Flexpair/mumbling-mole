if (typeof window === "undefined" || typeof document === "undefined") {
  // The overlay only applies in browser environments.
} else {
  const installationFlag = "__mumblingMoleConsoleOverlay";
  if (!window[installationFlag]) {
    window[installationFlag] = true;

    const MAX_ENTRIES = 200;
    const entries = [];

    const state = {
      root: null,
      body: null,
      toggle: null,
      isVisible: false,
    };

    const originalConsole = {};
    const METHODS = ["log", "info", "warn", "error", "debug", "table"];

    function createCircularReplacer() {
      const seen = new WeakSet();
      return function replacer(key, value) {
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) {
            return "[Circular]";
          }
          seen.add(value);
        }
        return value;
      };
    }

    function formatValue(value) {
      if (value instanceof Error) {
        return value.stack || `${value.name}: ${value.message}`;
      }

      const type = typeof value;
      if (type === "string") {
        return value;
      }
      if (type === "number" || type === "boolean" || value === null || value === undefined) {
        return String(value);
      }
      if (type === "function") {
        return value.toString();
      }
      if (type === "object") {
        try {
          return JSON.stringify(value, createCircularReplacer(), 2);
        } catch (error) {
          return Object.prototype.toString.call(value);
        }
      }
      return String(value);
    }

    function formatArgs(args) {
      return args
        .map((arg) => {
          try {
            return formatValue(arg);
          } catch (error) {
            return `[Unserializable: ${error}]`;
          }
        })
        .filter((part) => part && part.length > 0)
        .join(" ");
    }

    function createEntryElement(entry) {
      const container = document.createElement("div");
      container.className = `console-overlay__entry console-overlay__entry--${entry.level}`;

      const timestamp = document.createElement("span");
      timestamp.className = "console-overlay__time";
      timestamp.textContent = entry.timestamp.toLocaleTimeString();
      container.appendChild(timestamp);

      const message = document.createElement("pre");
      message.className = "console-overlay__text";
      message.textContent = formatArgs(entry.args);
      container.appendChild(message);

      return container;
    }

    function removeOverflow() {
      while (entries.length > MAX_ENTRIES) {
        entries.shift();
        if (state.body && state.body.firstChild) {
          state.body.removeChild(state.body.firstChild);
        }
      }
    }

    function appendEntry(entry) {
      if (!state.body) {
        return;
      }
      state.body.appendChild(createEntryElement(entry));
      state.body.scrollTop = state.body.scrollHeight;
    }

    function addEntry(level, args) {
      const entry = {
        level,
        args: Array.from(args || []),
        timestamp: new Date(),
      };
      entries.push(entry);
      removeOverflow();
      appendEntry(entry);
      if (level === "error") {
        showOverlay();
      }
    }

    function clearEntries() {
      entries.length = 0;
      if (state.body) {
        state.body.textContent = "";
      }
    }

    function updateVisibility() {
      if (!state.root || !state.toggle) {
        return;
      }
      if (state.isVisible) {
        state.root.classList.add("console-overlay--visible");
        state.toggle.classList.add("console-overlay__toggle--hidden");
      } else {
        state.root.classList.remove("console-overlay--visible");
        state.toggle.classList.remove("console-overlay__toggle--hidden");
      }
    }

    function showOverlay() {
      state.isVisible = true;
      updateVisibility();
    }

    function hideOverlay() {
      state.isVisible = false;
      updateVisibility();
    }

    function toggleOverlay() {
      state.isVisible = !state.isVisible;
      updateVisibility();
    }

    function createOverlayDom() {
      if (!document.body || state.root) {
        return;
      }

      const overlay = document.createElement("section");
      overlay.id = "console-overlay";
      overlay.className = "console-overlay";
      overlay.setAttribute("role", "log");
      overlay.setAttribute("aria-live", "polite");

      const header = document.createElement("div");
      header.className = "console-overlay__header";

      const title = document.createElement("span");
      title.className = "console-overlay__title";
      title.textContent = "Console";
      header.appendChild(title);

      const hint = document.createElement("span");
      hint.className = "console-overlay__hint";
      hint.textContent = "Ctrl+Shift+L";
      header.appendChild(hint);

      const controls = document.createElement("div");
      controls.className = "console-overlay__controls";

      const clearButton = document.createElement("button");
      clearButton.type = "button";
      clearButton.className = "console-overlay__button";
      clearButton.textContent = "Clear";
      clearButton.addEventListener("click", () => {
        clearEntries();
      });
      controls.appendChild(clearButton);

      const hideButton = document.createElement("button");
      hideButton.type = "button";
      hideButton.className = "console-overlay__button";
      hideButton.textContent = "Hide";
      hideButton.addEventListener("click", () => {
        hideOverlay();
      });
      controls.appendChild(hideButton);

      header.appendChild(controls);

      const body = document.createElement("div");
      body.className = "console-overlay__body";

      overlay.appendChild(header);
      overlay.appendChild(body);

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "console-overlay__toggle";
      toggle.title = "Show console overlay (Ctrl+Shift+L)";
      toggle.textContent = "Console";
      toggle.addEventListener("click", () => {
        showOverlay();
      });

      document.body.appendChild(overlay);
      document.body.appendChild(toggle);

      state.root = overlay;
      state.body = body;
      state.toggle = toggle;

      updateVisibility();
      entries.forEach((entry) => {
        appendEntry(entry);
      });
    }

    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", createOverlayDom);
    } else {
      createOverlayDom();
    }

    window.addEventListener("keydown", (event) => {
      if (event.ctrlKey && event.shiftKey && event.key && event.key.toLowerCase() === "l") {
        event.preventDefault();
        toggleOverlay();
      }
    });

    window.addEventListener("error", (event) => {
      const info = [];
      if (event.message) {
        info.push(event.message);
      }
      if (event.error instanceof Error) {
        info.push(event.error);
      } else if (event.filename) {
        info.push(`${event.filename}:${event.lineno || 0}:${event.colno || 0}`);
      }
      addEntry("error", info);
    });

    window.addEventListener("unhandledrejection", (event) => {
      addEntry("error", ["Unhandled rejection", event.reason]);
    });

    if (typeof console.clear === "function") {
      const originalClear = console.clear.bind(console);
      console.clear = function clear(...args) {
        originalClear(...args);
        clearEntries();
      };
    }

    METHODS.forEach((method) => {
      if (typeof console[method] !== "function") {
        return;
      }
      originalConsole[method] = console[method].bind(console);
      console[method] = function patchedConsoleMethod(...args) {
        originalConsole[method](...args);
        addEntry(method, args);
      };
    });
  }
}
