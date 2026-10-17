/**
 * Ids are opaque strings. We prefer the platform UUID generator and fall back to a time-plus-random
 * scheme where it is missing (very old WebViews). Core has no DOM types, hence the narrow cast.
 */
export function createId(prefix?: string): string {
  const globalCrypto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const uuid =
    typeof globalCrypto?.randomUUID === 'function' ? globalCrypto.randomUUID() : fallbackUuid();
  return prefix ? `${prefix}_${uuid}` : uuid;
}

function fallbackUuid(): string {
  const time = Date.now().toString(16).padStart(12, '0');
  let random = '';
  for (let i = 0; i < 20; i++) random += Math.floor(Math.random() * 16).toString(16);
  return `${time.slice(0, 8)}-${time.slice(8, 12)}-4${random.slice(0, 3)}-${random.slice(3, 7)}-${random.slice(7, 19)}`;
}
