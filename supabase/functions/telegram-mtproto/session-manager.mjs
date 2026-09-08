// One leased MTProto connection per isolate. No account logOut or token rotation.
export class SessionError extends Error {
  constructor(message, status = 503, code = 'session_error', retryAfter = 0) {
    super(message); this.status = status; this.code = code; this.retryAfter = retryAfter;
  }
}
export function floodSeconds(error) {
  const text = [error?.text, error?.errorMessage, error?.message].filter(Boolean).join(' ');
  const m = /(?:^|\b)FLOOD_WAIT_(\d+)(?:$|\b)/.exec(text);
  return m ? Math.min(86400, Number(m[1])) : 0;
}
export function createSessionManager({ state, createClient, botToken, encrypt, decrypt, now = () => Date.now(), setIntervalFn = setInterval, clearIntervalFn = clearInterval, owner = () => crypto.randomUUID(), leaseMs = 600000, renewMs = 60000, idleMs = 0 }) {
  let active = null, pending = null, users = 0, timer = null, idleTimer = null, expiresAt = 0, leaseOwner = null, closing = null;
  const clearIdle = () => { if (idleTimer) clearTimeout(idleTimer); idleTimer = null; };
  const stop = () => { if (timer) clearIntervalFn(timer); timer = null; clearIdle(); };
  const close = async (block = 0) => {
    if (closing) return closing;
    closing = (async () => {
      stop(); const client = active; active = null; const id = leaseOwner; leaseOwner = null; expiresAt = 0;
      if (client) { try { await client.disconnect(); } catch {} try { await client.destroy(); } catch {} }
      if (id) {
        try { if (block) await state('block', id, String(block)); } finally { await state('release', id).catch(() => {}); }
      }
    })().finally(() => { closing = null; });
    return closing;
  };
  const check = () => {
    if (!active || !leaseOwner || now() >= expiresAt) throw new SessionError('A sessão do Telegram precisa ser restabelecida.', 503, 'lease_expired', 5);
  };
  const renew = async () => {
    const id = leaseOwner; if (!id || !active) return;
    try {
      const result = await state('renew', id);
      if (!result.ok) throw new Error('lease_lost');
      expiresAt = now() + leaseMs;
    } catch { await close(); }
  };
  const acquire = async () => {
    if (closing) await closing;
    if (active && now() < expiresAt) return active;
    if (active) await close();
    const id = owner();
    const lease = await state('acquire', id);
    if (!lease.ok) throw new SessionError(lease.reason === 'cooldown' ? 'O Telegram limitou temporariamente a autenticação.' : 'O gateway do Telegram está ocupado.', lease.reason === 'cooldown' ? 429 : 503, `telegram_${lease.reason}`, lease.retryAfter || 2);
    leaseOwner = id; expiresAt = now() + leaseMs;
    let client;
    try {
      client = await createClient();
      const session = lease.session ? await decrypt(lease.session) : null;
      await client.start(session ? { session } : { botToken: typeof botToken === 'function' ? botToken() : botToken });
      const exported = await client.exportSession();
      await state('save', id, await encrypt(exported));
      active = client;
      timer = setIntervalFn(() => { void renew(); }, renewMs);
      return client;
    } catch (error) {
      if (client) { try { await client.disconnect(); } catch {} try { await client.destroy(); } catch {} }
      const seconds = floodSeconds(error);
      await state('block', id, String(seconds || 900)).catch(() => {});
      await state('release', id).catch(() => {});
      leaseOwner = null; expiresAt = 0; active = null;
      if (seconds) throw new SessionError('O Telegram limitou temporariamente a autenticação.', 429, 'telegram_flood_wait', seconds);
      throw error;
    }
  };
  async function open() {
    clearIdle();
    if (!pending) pending = acquire().finally(() => { pending = null; });
    const client = await pending;
    check(); clearIdle(); users++;
    let released = false;
    return {
      client,
      check,
      release: async () => {
        if (released) return;
        released = true; users = Math.max(0, users - 1);
        if (!users && active) {
          clearIdle();
          if (idleMs === 0) await close();
          else idleTimer = setTimeout(() => { if (!users) void close(); }, idleMs);
        }
      },
    };
  }
  async function status() {
    const result = await state('status', owner());
    return { ...result, connected: Boolean(active && now() < expiresAt), storage: 'encrypted-postgres' };
  }
  return { open, close, status, check };
}
