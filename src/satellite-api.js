export const SATELLITE_MODULE = 'satellite-os';

export const SATELLITE_NAMESPACES = new Set([
  'bus',
  'device',
  'task',
  'telemetry',
  'fault',
]);

export function isSatelliteNamespace(name) {
  return SATELLITE_NAMESPACES.has(name);
}

export function modulePathToHeader(modulePath) {
  let normalized = modulePath.replace(/^\.\//, '').replace(/^\.\.\//, '../');
  normalized = normalized.replace(/\.(mjs|cjs|js|ts)$/u, '.hpp');
  if (!normalized.endsWith('.hpp') && !normalized.endsWith('.h')) {
    normalized = `${normalized}.hpp`;
  }
  return normalized;
}

export function cppString(value) {
  return JSON.stringify(String(value));
}

export function sanitizeIdentifier(name) {
  return String(name).replace(/[^A-Za-z0-9_]/gu, '_');
}
