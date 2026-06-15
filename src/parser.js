import { parse } from '@babel/parser';

export function parseJavaScript(source, filename = '<input>') {
  return parse(source, {
    sourceType: 'module',
    sourceFilename: filename,
    errorRecovery: false,
    allowReturnOutsideFunction: false,
    plugins: [
      'topLevelAwait',
      'numericSeparator',
      'objectRestSpread',
    ],
  });
}
