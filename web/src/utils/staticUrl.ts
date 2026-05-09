export function getStaticBaseUrl(): string {
  if (import.meta.env.PROD) return '';
  return `http://${window.location.hostname}:${import.meta.env.VITE_SERVER_PORT}`;
}

export function buildStaticUrl(path: string): string {
  const encoded = path
    .split('/')
    .map((seg) => (seg === '' ? '' : encodeURIComponent(seg)))
    .join('/');
  return getStaticBaseUrl() + encoded;
}
