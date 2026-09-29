// sessionStorage so the key goes away when the tab closes. Good enough for a shared demo key;
// a real dashboard would use SSO and an httpOnly session cookie.
const STORAGE_KEY = 'refund-desk.admin-key';

export function getAdminKey(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setAdminKey(key: string | null) {
  try {
    if (key) sessionStorage.setItem(STORAGE_KEY, key);
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // private mode etc. - they'll just have to enter it again
  }
}
