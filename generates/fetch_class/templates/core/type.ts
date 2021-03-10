export interface RequestData {
  params?: Record<string, Object> | null
  query?: Record<string, Object> | null
  body?: any
}

export interface TypedResponse<Status extends number, Body> extends Response {
  readonly status: Status
  json(): Promise<Body>
}

export interface ApiConfig {
  readonly fetch: WindowOrWorkerGlobalScope['fetch']
  readonly base: string
}
