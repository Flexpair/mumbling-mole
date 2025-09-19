// Instrumentation to detect legacy ScriptProcessorNode usage.
// Logs stack traces whenever deprecated createScriptProcessor() is invoked.
// Remove this file once no more calls appear.
(function(){
  const AC = window.AudioContext || window.webkitAudioContext;
  if(!AC || !AC.prototype.createScriptProcessor) return; // Nothing to hook
  if(AC.prototype.__createScriptProcessorHooked) return; // Avoid double hook
  const orig = AC.prototype.createScriptProcessor;
  AC.prototype.__createScriptProcessorHooked = true;
  AC.prototype.createScriptProcessor = function(){
    try {
      const err = new Error('[DEBUG] Deprecated createScriptProcessor() called');
      // Improve readability: filter out this wrapper frame
      const stack = (err.stack || '').split('\n').filter(l => !/createScriptProcessor/.test(l) || /DEBUG/.test(l)).join('\n');
      console.warn('[Audio Debug] ScriptProcessorNode usage detected:', arguments, '\nStack:', stack);
      // Expose a global accumulator for later inspection
      if(!window.__scriptProcessorCalls){ window.__scriptProcessorCalls = []; }
      window.__scriptProcessorCalls.push({ when: Date.now(), args: Array.from(arguments), stack });
    } catch(e) {
      console.warn('[Audio Debug] Error capturing stack for createScriptProcessor', e);
    }
    return orig.apply(this, arguments);
  };
  console.info('[Audio Debug] Instrumented AudioContext.createScriptProcessor');
})();
