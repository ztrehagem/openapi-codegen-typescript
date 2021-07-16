import * as api from './dest/function'

api.getUser({ user_id: 123 }, null).then(async (response) => {
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

api.createUser(null, {
  user: {
    name: 'John Doe',
    birthday: null,
    imagePost: null,
    password: 'password'
  },
}).then(async (response) => {
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
