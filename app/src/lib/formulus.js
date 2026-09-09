const MIN_FORMULUS_VERSION = '1.3.0';

let apiPromise;

export function getFormulus() {
  if (!apiPromise) {
    if (typeof window.getFormulus !== 'function') {
      return Promise.reject(new Error('Formulus is not available. Open this app inside Formulus.'));
    }
    apiPromise = window.getFormulus();
  }
  return apiPromise;
}

export function compareVersions(leftVersion, rightVersion) {
  const left = String(leftVersion || '')
    .split('-')[0]
    .split('.');
  const right = String(rightVersion || '')
    .split('-')[0]
    .split('.');

  for (let index = 0; index < 3; index += 1) {
    const leftPart = Number.parseInt(left[index], 10) || 0;
    const rightPart = Number.parseInt(right[index], 10) || 0;
    if (leftPart !== rightPart) return leftPart > rightPart ? 1 : -1;
  }
  return 0;
}

export async function hostVersionIssue(api) {
  try {
    const version = await api.getVersion();
    if (compareVersions(version, MIN_FORMULUS_VERSION) < 0) {
      return `This version of Formulus (${version}) is too old for ODE Trail. Ask a host to update to ${MIN_FORMULUS_VERSION} or newer.`;
    }
  } catch {
    // An unreadable host version is not a reason to block the event app.
  }
  return null;
}
