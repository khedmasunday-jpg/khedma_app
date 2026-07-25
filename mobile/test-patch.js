(async () => {
  const forkJs = await import('./node_modules/@expo/metro-config/build/serializer/fork/js.js');

  // Simulate a module shape minimal for getModuleParams
  const module = {
    path: undefined,
    dependencies: new Map([
      ['dep', { absolutePath: undefined, data: { data: { asyncType: 'module', isOptional: true }, name: 'depName' } }]
    ])
  };

  const options = {
    createModuleId: () => 1,
    // projectRoot: undefined,
    // serverRoot: undefined,
    includeAsyncPaths: true,
    sourceUrl: undefined,
    dev: true,
  };

  try {
    const res = forkJs.getModuleParams(module, options);
    console.log('getModuleParams returned without throwing:', Object.keys(res));
  } catch (e) {
    console.error('getModuleParams threw:', e && e.stack || e);
  }

  try {
    const res2 = forkJs.getJsOutput({ output: [{ type: 'js/script', data: { code: 'console.log(1)', lineCount: 1 } }] });
    console.log('getJsOutput ok', res2.type);
  } catch (e) {
    console.error('getJsOutput threw', e && e.stack || e);
  }
})();
