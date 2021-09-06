import type { ApiConfig } from './type'
import { Session } from './session'

export interface FactoryOption {
  fetch: WindowOrWorkerGlobalScope['fetch']
  base: string
  SessionClass?: typeof Session
}

export abstract class SessionFactory {
  protected readonly config: ApiConfig
  protected readonly SessionClass: typeof Session

  constructor(option: FactoryOption) {
    this.config = {
      fetch: option.fetch,
      base: option.base,
    }
    this.SessionClass = option.SessionClass ?? Session
  }
}
