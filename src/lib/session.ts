import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { config } from "./config";

export interface SessionData {
  userId?: string;
  tenantId?: string;
  email?: string;
  name?: string;
  role?: string;
  isLoggedIn: boolean;
}

const sessionOptions: SessionOptions = {
  password: config.session.secret,
  cookieName: config.session.cookieName,
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "lax",
    maxAge: config.session.maxAge,
    path: "/",
  },
};

/**
 * Get the current session
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  return getIronSession<SessionData>(await cookies(), sessionOptions);
}

/**
 * Create a new session for a user
 */
export async function createSession(user: {
  id: string;
  tenantId: string;
  email: string;
  name?: string | null;
  role: string;
}): Promise<void> {
  const session = await getSession();
  session.userId = user.id;
  session.tenantId = user.tenantId;
  session.email = user.email;
  session.name = user.name || undefined;
  session.role = user.role;
  session.isLoggedIn = true;
  await session.save();
}

/**
 * Destroy the current session
 */
export async function destroySession(): Promise<void> {
  const session = await getSession();
  session.destroy();
}

/**
 * Check if user is authenticated
 */
export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession();
  return session.isLoggedIn === true && !!session.userId;
}

/**
 * Get current user from session
 */
export async function getCurrentUser(): Promise<{
  userId: string;
  tenantId: string;
  email: string;
  name?: string;
  role: string;
} | null> {
  const session = await getSession();
  if (!session.isLoggedIn || !session.userId || !session.tenantId) {
    return null;
  }

  return {
    userId: session.userId,
    tenantId: session.tenantId,
    email: session.email!,
    name: session.name,
    role: session.role!,
  };
}
