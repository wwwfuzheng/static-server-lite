export function ok(data = null, message = 'ok') {
  return { code: 0, data, message };
}

export function fail(code, message, data = null) {
  return { code, message, data };
}
