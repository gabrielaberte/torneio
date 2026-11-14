export async function supabaseRequest(resource, { method = 'GET', body, prefer } = {}) {
  const projectUrl = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!projectUrl || !secretKey) throw new Error('Supabase is not configured on the server.');
  const headers = new Headers({ apikey: secretKey, Accept: 'application/json' });
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  if (prefer) headers.set('Prefer', prefer);
  const response = await fetch(projectUrl.replace(/\/+$/, '') + '/rest/v1/' + resource, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    const error = new Error('Supabase request failed.');
    error.status = response.status;
    throw error;
  }
  return text ? JSON.parse(text) : null;
}
