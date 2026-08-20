import { cookies, headers } from 'next/headers';
import { getDb } from './db';
import { User } from './types';

export const DEFAULT_USER_ID = 'user-alex';

export async function getCurrentUser(): Promise<User> {
  const db = getDb();
  
  // Try cookie first
  let userId: string | undefined;
  try {
    const cookieStore = await cookies();
    userId = cookieStore.get('ajaia_user_id')?.value;
  } catch {
    // Context might be non-request or during build
  }

  // If no cookie, check header
  if (!userId) {
    try {
      const headerList = await headers();
      userId = headerList.get('x-user-id') || undefined;
    } catch {
      // Ignored
    }
  }

  if (!userId) {
    userId = DEFAULT_USER_ID;
  }

  const user = db.prepare('SELECT id, name, email, avatar, role_title, color FROM users WHERE id = ?').get(userId) as User | undefined;

  if (user) {
    return user;
  }

  // Fallback to default user
  const defaultUser = db.prepare('SELECT id, name, email, avatar, role_title, color FROM users WHERE id = ?').get(DEFAULT_USER_ID) as User;
  return defaultUser;
}

export function getAllUsers(): User[] {
  const db = getDb();
  return db.prepare('SELECT id, name, email, avatar, role_title, color FROM users ORDER BY name ASC').all() as User[];
}

export function getUserById(id: string): User | undefined {
  const db = getDb();
  return db.prepare('SELECT id, name, email, avatar, role_title, color FROM users WHERE id = ?').get(id) as User | undefined;
}
