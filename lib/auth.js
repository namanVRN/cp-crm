import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.SESSION_SECRET);
const SESSION_DAYS = 30;
export const SESSION_COOKIE = 'session';

export async function createSessionToken(userData) {
  return await new SignJWT({
    name: userData.name,
    userNumber: userData.userNumber,
    role: userData.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secret);
}

export async function verifySessionToken(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload; // { name, userNumber, role, iat, exp }
  } catch {
    return null;
  }
}

// Use inside API routes: const session = await requireAuth();
export async function requireAuth(request) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    const err = new Error('Unauthorized: Please login again');
    err.status = 401;
    throw err;
  }
  return session;
}

export async function requireAdmin(request) {
  const session = await requireAuth(request);
  if (session.role !== 'Admin') {
    const err = new Error('Unauthorized: Admin access required');
    err.status = 403;
    throw err;
  }
  return session;
}