export function authPaths(baseUrl = '/') {
  const base = baseUrl.replace(/\/+$/, '');
  return { home: `${base}/`, signIn: `${base}/sign-in` };
}
