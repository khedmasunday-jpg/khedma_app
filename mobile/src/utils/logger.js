

const isProduction = !__DEV__;

function safeLog(level, ...args) {
  
  return;
}

export const logger = {
  log: () => {},
  warn: () => {},
  error: () => {},
  info: () => {},
  debug: () => {},
  assert: () => {},
};

if (typeof global !== 'undefined') {
  const noop = () => {};
  global.console = {
    log: noop,
    warn: noop,
    error: noop,
    info: noop,
    debug: noop,
    assert: noop,
    clear: noop,
    count: noop,
    group: noop,
    groupCollapsed: noop,
    groupEnd: noop,
    table: noop,
    time: noop,
    timeEnd: noop,
    trace: noop,
    profile: noop,
    profileEnd: noop,
  };
}

export default logger;
