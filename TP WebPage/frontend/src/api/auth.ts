export type Role = 'admin' | 'facilitator' | 'trainee';

async function parseJsonResponse(response: Response): Promise<{ role: Role }> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }
  return data;
}

export async function login(email: string, password: string): Promise<{ role: Role }> {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return parseJsonResponse(response);
}

export async function acceptInvite(email: string, password: string): Promise<{ role: Role }> {
  const response = await fetch('/api/auth/invite/accept', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  return parseJsonResponse(response);
}

async function parseJsonBody<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || 'Request failed.');
  }
  return data as T;
}

export async function forgotPassword(email: string, newPassword: string): Promise<{ success: true }> {
  const response = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, newPassword })
  });
  return parseJsonBody(response);
}

export async function createInvite(email: string): Promise<{ email: string }> {
  const response = await fetch('/api/auth/invite', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return parseJsonBody(response);
}
