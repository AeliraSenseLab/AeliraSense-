// Vault action initializer/executor with strict validation, lazy loading, caching, and timeouts

export interface SafeParseResult<T> {
  success: boolean
  data?: T
  error?: { errors: Array<{ path?: (string | number)[]; message: string }> }
}

export interface InputSchema<T> {
  safeParse: (v: unknown) => SafeParseResult<T>
}

export interface ActionContext {
  [key: string]: unknown
}

export interface ActionModule<P = unknown, R = unknown> {
  execute: (args: { payload: P; context: ActionContext }) => Promise<R> | R
}

export interface ActionCore<P = unknown, R = unknown> {
  id: string
  input: InputSchema<P>
  execute?: ActionModule<P, R>["execute"]
}

export interface InitOptions {
  /** Abort if not resolved within timeoutMs */
  timeoutMs?: number
  /** Optional AbortSignal to cancel execution */
  signal?: AbortSignal
}

type AnyAction = ActionModule<any, any>

// Simple in-memory module cache to avoid re-importing the same action
const moduleCache = new Map<string, AnyAction>()

/**
 * Dynamically loads an action module by id using ./moduleRegistry
 * Supports both ESM default export and named export shapes
 */
async function loadActionModule(actionId: string): Promise<AnyAction> {
  if (moduleCache.has(actionId)) return moduleCache.get(actionId)!
  const mod = await import("./moduleRegistry")
  const loader: (id: string) => Promise<AnyAction> | AnyAction =
    (mod as any).loadActionModule ?? (mod as any).default?.loadActionModule

  if (typeof loader !== "function") {
    throw new Error("moduleRegistry.loadActionModule is not a function")
  }
  const action = await loader(actionId)
  if (!action || typeof (action as AnyAction).execute !== "function") {
    throw new Error(`Loaded module for '${actionId}' has no valid execute()`)
  }
  moduleCache.set(actionId, action as AnyAction)
  return action as AnyAction
}

/**
 * Wrap a promise with timeout and optional AbortSignal support
 */
function withTimeout<T>(p: Promise<T>, timeoutMs?: number, signal?: AbortSignal): Promise<T> {
  if (!timeoutMs && !signal) return p

  return new Promise<T>((resolve, reject) => {
    let settled = false
    let t: any

    const onSettle = (fn: (v?: any) => void) => (val: any) => {
      if (settled) return
      settled = true
      if (t) clearTimeout(t)
      if (signal) signal.removeEventListener("abort", onAbort)
      fn(val)
    }

    const onAbort = () => onSettle(reject)(signal?.reason ?? new DOMException("Aborted", "AbortError"))

    if (timeoutMs) {
      t = setTimeout(() => onSettle(reject)(new Error("Action execution timed out")), timeoutMs)
    }
    if (signal) {
      if (signal.aborted) return onAbort()
      signal.addEventListener("abort", onAbort)
    }

    p.then(onSettle(resolve), onSettle(reject))
  })
}

/**
 * Initialize and execute a vault action:
 * - Validates rawPayload against actionCore.input.safeParse()
 * - Lazy-loads execute() from moduleRegistry if absent
 * - Executes with optional timeout/abort
 * - Returns the execution result promise
 */
export async function initVaultAction<P = unknown, R = unknown>(
  actionCore: ActionCore<P, R>,
  rawPayload: unknown,
  context: ActionContext,
  opts: InitOptions = {}
): Promise<R> {
  if (!actionCore?.id) throw new Error("actionCore.id is required")
  if (!actionCore?.input?.safeParse || typeof actionCore.input.safeParse !== "function") {
    throw new Error("actionCore.input.safeParse must be a function")
  }

  const parsed = actionCore.input.safeParse(rawPayload) as SafeParseResult<P>
  if (!parsed.success) {
    const msgs =
      parsed.error?.errors?.map(e => (e.path && e.path.length ? `[${e.path.join(".")}] ` : "") + e.message).join("; ") ||
      "Invalid payload"
    throw new Error(`Invalid payload: ${msgs}`)
  }

  // Ensure execute is present (lazy-load if needed)
  let execute = actionCore.execute as ActionModule<P, R>["execute"] | undefined
  if (typeof execute !== "function") {
    const mod = await loadActionModule(actionCore.id)
    execute = mod.execute.bind(mod) as ActionModule<P, R>["execute"]
    // attach for subsequent calls
    actionCore.execute = execute
  }

  const resultPromise = Promise.resolve(execute({ payload: parsed.data as P, context }))
  return withTimeout<R>(resultPromise, opts.timeoutMs, opts.signal)
}
