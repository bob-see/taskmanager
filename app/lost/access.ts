export const LOST_ALLOWED_EMAILS = ["robert.bob.see@gmail.com"];

export function canAccessLost(email?: string | null) {
  if (!email) return false;
  return LOST_ALLOWED_EMAILS.includes(email.toLocaleLowerCase());
}
