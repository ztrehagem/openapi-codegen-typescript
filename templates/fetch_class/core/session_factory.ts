import type { ApiConfig } from './type'

export interface FactoryOption {
  fetch: WindowOrWorkerGlobalScope['fetch']
  base: string
}

export abstract class SessionFactory {
  protected readonly config: ApiConfig

  constructor(option: FactoryOption) {
    this.config = {
      fetch: option.fetch,
      base: option.base,
    }
  }
}
