import type { ApiConfig, RequestData, TypedResponse } from './type'

export interface SessionOption {
  readonly path: string
  readonly method: string
}

export class Session<Req extends RequestData = RequestData, Res extends TypedResponse<number, any> = TypedResponse<number, unknown>> {
  protected readonly config: ApiConfig
  protected readonly path: string
  protected readonly method: string
  protected requestInit?: RequestInit

  constructor(config: ApiConfig, option: SessionOption) {
    this.config = config
    this.path = option.path
    this.method = option.method
  }

  call(option: Req, requestInit?: RequestInit) {
    const uri = this.path
      .replace(/\{([^}]*)\}/g, (_, name) => (option.params ?? {})[name].toString())
      .replace(/^\//, '')
    const url = new URL(uri, this.config.base.replace(/([^/])$/, '$1/'))

    for (const [key, value] of Object.entries(option.query ?? {})) {
      url.searchParams.set(key, value.toString())
    }

    return this.config.fetch(url.toString(), {
      method: this.method,
      body: option.body,
      ...this.requestInit,
      ...requestInit,
    }) as Promise<Res>
  }

  setRequestInit(requestInit: RequestInit) {
    this.requestInit = requestInit
  }
}
