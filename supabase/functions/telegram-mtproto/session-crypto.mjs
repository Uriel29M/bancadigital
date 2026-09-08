const encoder = new TextEncoder();
function base64(bytes) { return btoa(String.fromCharCode(...bytes)); }
function unbase64(value) { return Uint8Array.from(atob(value), c => c.charCodeAt(0)); }
export function createSessionCrypto(secret) {
  if (typeof secret !== 'string' || secret.length < 32) throw new Error('A session encryption key must contain at least 32 characters.');
  let keyPromise;
  const key = () => keyPromise ||= (async () => {
    const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:encoder.encode('banca-mtproto-v1'),info:encoder.encode('telegram-session')}, material, {name:'AES-GCM',length:256}, false, ['encrypt','decrypt']);
  })();
  return {
    async encrypt(value) {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const cipher = new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(),encoder.encode(value)));
      return `v1.${base64(iv)}.${base64(cipher)}`;
    },
    async decrypt(value) {
      const parts = String(value).split('.');
      if (parts.length !== 3 || parts[0] !== 'v1') throw new Error('Unsupported session encryption format.');
      return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unbase64(parts[1])},await key(),unbase64(parts[2])));
    },
  };
}
