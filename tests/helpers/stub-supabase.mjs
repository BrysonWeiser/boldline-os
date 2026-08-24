// A Supabase client that records instead of storing.
//
// It answers the exact shapes the functions use: an auth check, a single-row read, and an
// update. Every update is pushed onto `__STUB.writes`, so a test asserts on what the code
// TRIED to save rather than on the code that saves it.

const S = () => globalThis.__STUB;

export function createClient() {
  return {
    auth: {
      getUser: async () => S().auth || { data: { user: { id: "owner" } }, error: null },
    },
    from(table) {
      const q = {
        select: () => q,
        eq: () => q,
        limit: () => q,
        order: () => q,
        update(patch) {
          S().writes.push({ table, patch });
          // Behave like a real row: the next read sees the last write. Without this a
          // read-merge-write bug would be invisible, because every read would return the
          // pristine record no matter what had already been saved.
          if (patch && patch.data) S().row = { ...(S().row || {}), data: patch.data };
          return q;
        },
        maybeSingle: async () => ({ data: S().row, error: null }),
        // Awaiting the chain itself (an update, or a select with no .maybeSingle) lands here.
        then(onOk, onErr) {
          return Promise.resolve({ data: S().rows || null, error: S().error || null }).then(onOk, onErr);
        },
      };
      return q;
    },
  };
}

export default { createClient };
