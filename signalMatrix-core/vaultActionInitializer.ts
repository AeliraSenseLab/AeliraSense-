/**
 * Initialize and execute a vault action:
 * - Validates rawPayload against actionCore.input.safeParse()
 * - Loads the execute() function dynamically if missing
 * - Returns the execution result promise
 */

function loadActionModule(actionId) {
  return require('./moduleRegistry').loadActionModule(actionId)
}

export async function initVaultAction(actionCore, rawPayload, context) {
  // Validate payload
  const parsed = actionCore.input.safeParse(rawPayload)
  if (!parsed.success) {
    const msgs = parsed.error.errors.map(e => e.message).join('; ')
    throw new Error(`Invalid payload: ${msgs}`)
  }

  // Lazy-load execute() if absent
  if (typeof actionCore.execute !== 'function') {
    const mod = loadActionModule(actionCore.id)
    actionCore.execute = mod.execute.bind(mod)
  }

  // Execute and return its promise
  return actionCore.execute({ payload: parsed.data, context })
}
