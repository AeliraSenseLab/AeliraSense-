import { EventEmitter } from 'events'

/**
 * Abstract base for any AeliraSense action.
 * Subclasses implement `execute()` to perform their work.
 */
export abstract class BaseAeliraAction extends EventEmitter {
  constructor(public readonly name: string) {
    super()
  }

  /** Kick off the action, emitting start/progress/done/error events */
  public async run(...args: any[]): Promise<void> {
    this.emit('start', { action: this.name, args })
    try {
      await this.execute(...args)
      this.emit('done', { action: this.name })
    } catch (err) {
      this.emit('error', { action: this.name, error: err })
      throw err
    }
  }

  /** Subclasses override to implement the actual logic */
  protected abstract execute(...args: any[]): Promise<void>
}
