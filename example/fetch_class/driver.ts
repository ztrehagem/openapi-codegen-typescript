import { Factory } from './dest/factory'
import { Session } from './dest/core/session'
import * as schema from './dest/schema'
import { blockParams } from 'handlebars'

const factory = new Factory({
  base: 'http://localhost:5000/api/',
  fetch: window.fetch,
})

namespace model {
  export class User {
    readonly id: number
    readonly name: string
    readonly birthday?: Date

    constructor(raw: schema.UserReadable) {
      this.id = raw.id
      this.name = raw.name
      if (raw.birthday) {
        this.birthday = new Date(raw.birthday)
      }
    }
  }
}

namespace api {
  // a wrapper class to capsulate AbortController
  export abstract class SessionBase<Params, Result> {
    protected abstract readonly session: Session
    protected abortController?: AbortController

    protected abstract call(params: Params): Promise<Result>

    async exec(params: Params) {
      this.abort()
      this.abortController = new AbortController()
      this.session.setRequestInit({
        signal: this.abortController.signal,
      })
      return await this.call(params)
    }

    abort() {
      this.abortController?.abort()
    }
  }

  export namespace getUser {
    export interface Params {
      id: number
    }

    export interface Result {
      user?: model.User
    }

    // concrete api session classes for each endpoint
    // you can transform data before/after calling api
    export class Session extends SessionBase<Params, Result> {
      protected readonly session = factory.getUser()

      protected async call(params: Params) {
        const res = await this.session.call({
          params: {
            user_id: params.id
          },
        })

        switch (res.status) {
          case 200: {
            const { user } = await res.json()
            return { user: new model.User(user) }
          }

          case 404:
            return {}

          default:
            console.error(res)
            throw new Error('ApiResponseError')
        }
      }
    }
  }

  export namespace createUser {
    export interface Params {
      name: string
      birthday: Date | null
    }

    export interface Result {
      user?: model.User
    }

    export class Session extends SessionBase<Params, Result> {
      protected readonly session = factory.createUser()

      protected async call(params: Params) {
        const res = await this.session.call({
          body: {
            user: {
              name: params.name,
              birthday: params.birthday?.toISOString() ?? null,
              imagePost: null,
              password: 'password'
            }
          }
        })

        switch (res.status) {
          case 201: {
            const { user } = await res.json()
            return { user: new model.User(user) }
          }

          case 400:
            return {}

          default:
            console.error(res)
            throw new Error('ApiResponseError')
        }
      }
    }
  }
}

async function main() {
  const session = new api.getUser.Session()

  try {
    const { user } = await session.exec({ id: 1 })
    if (user) {
      console.log(`${user.name} was born in ${user.birthday?.getFullYear() ?? 'XXXX'}.`)
    } else {
      console.log('not found')
    }
  } catch (error) {
    console.error(error)
  }
}

async function main2() {
  const session = new api.createUser.Session()

  try {
    const { user } = await session.exec({
      name: 'John Doe',
      birthday: null,
    })
    if (user) {
      console.log('created')
    } else {
      console.log('validation error')
    }
  } catch (error) {
    console.error(error)
  }
}
