// Accepts a bare name, or a name with its beginner setting.
export function toPlayer(entry) {
  if (typeof entry === 'string') return { name: entry, beginner: false };
  return { name: entry.name, beginner: entry.beginner === true };
}
