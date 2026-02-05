# Undici Timeout Configuration

## Problem
Chain and ensemble workflows were failing with `HeadersTimeoutError` after ~5 minutes, even though we tried to configure timeouts per-request.

## Root Cause
- Next.js uses `undici` as its fetch implementation
- Undici has a **default 300 second (5 minute) headers timeout**
- You **cannot** override undici timeouts by passing options to individual `fetch()` calls
- Custom environment variables like `UNDICI_HEADERS_TIMEOUT` are **not recognized** by Node.js/undici

## Solution
We use Next.js's `instrumentation.ts` hook to configure undici **globally at server startup**:

### Files Changed

1. **`package.json`** (added dependency)
   - Added `undici` as a dependency
   - While bundled with Node.js, Next.js's bundler needs explicit install

2. **`instrumentation.ts`** (new file at root)
   - Runs once when Next.js server starts
   - Configures undici's global dispatcher with no timeouts
   - Uses `setGlobalDispatcher()` from the `undici` package

3. **Fetch calls simplified**
   - Removed invalid per-request timeout options
   - Now rely on global undici configuration
   - Cleaner, more maintainable code

4. **`.env.local`** (updated)
   - Removed non-functional custom `UNDICI_*` env vars
   - Documented that timeouts are configured in `instrumentation.ts`

### How It Works

```typescript
// instrumentation.ts runs ONCE at server startup
export async function register() {
  const { setGlobalDispatcher, Agent } = await import('undici');

  setGlobalDispatcher(
    new Agent({
      headersTimeout: 0,  // 0 = no timeout
      bodyTimeout: 0,     // 0 = no timeout
      connectTimeout: 0   // 0 = no timeout
    })
  );
}
```

All subsequent `fetch()` calls in the application now use this configuration automatically.

### Benefits

1. **Single source of truth** - Timeout config in one place
2. **No repetition** - Don't need to configure timeouts on every fetch call
3. **Works correctly** - Uses undici's official API instead of invalid options
4. **Maintainable** - Easy to adjust timeouts for entire app

### Testing

Restart your dev server after these changes:
```bash
npm run dev
```

The chain workflow should now complete all steps without timeout errors.

## References
- [Next.js Instrumentation](https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation)
- [Undici Agent Options](https://undici.nodejs.org/#/docs/api/Agent)
- [Undici setGlobalDispatcher](https://undici.nodejs.org/#/docs/api/Dispatcher?id=setglobaldispatcher)
