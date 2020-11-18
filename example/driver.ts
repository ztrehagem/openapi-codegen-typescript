import * as api from './dest/function'

api.getUsersId({ id: 123 }, null).then(async (response) => {
  switch (response.status) {
    case 200: {
      const payload = await response.json()
      console.log(payload.user.id, payload.user.name)
      return
    }

    default:
      console.log(response)
      return
  }
})

api.postUsers(null, { name: 'John Doe' }).then(async (response) => {
  switch (response.status) {
    case 201: {
      const payload = await response.json()
      console.log('user created', payload.user.id, payload.user.name)
      return
    }

    case 400: {
      const payload = await response.json()
      for (const error of payload.errors) {
        console.log('error:', error.key, error.message)
      }
      return
    }

    default:
      console.log(response)
      return
  }
})