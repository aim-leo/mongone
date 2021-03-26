require('reflect-metadata')

const { decode } = require('@mongone/encodeuri')

const Mongone = require('./index')
const { object, array, string } = require('./type')

function getAllRouter(m) {
  return {
    findMany: {
      method: 'get',
      uri: '/',
      callback: async function findMany(req) {
        const query = decode(req.query)
        console.log('find mandy', query)

        const doc = await m.query(query)
        console.log(doc)
        return doc
      }
    },
    findById: {
      method: 'get',
      uri: '/:id',
      callback(req) {
        const query = decode(req.query)

        query.id = req.params.id
        return m.query(query)
      }
    },
    insert: {
      method: 'post',
      uri: '/',
      callback(req) {
        return m.findById(req.body)
      }
    },
    updateById: {
      method: 'put',
      uri: '/:id',
      callback(req) {
        return m.updateById(req.params.id, req.body)
      }
    },
    deleteById: {
      method: 'delete',
      uri: '/:id',
      callback(req) {
        return m.deleteById(req.params.id)
      }
    }
  }
}

const InjectMongone = (m, option = {}) => {
  // if (!(m instanceof Mongone)) {
  //   throw new Error('InjectMongone expected a Mongone obj')
  // }

  const routers = getAllRouter(m)
  const routerKeys = Object.keys(routers)

  const optiont = object({
    forbid: array(string().enum(routerKeys)).optional()
  })

  const validateOptionErr = optiont.test(option)
  if (validateOptionErr) {
    throw validateOptionErr
  }

  return Target => {
    const routeFromDecorator =
      Reflect.getMetadata('routeFromDecorator', Target) || {}

    for (const key in routers) {
      if (option.forbid && option.forbid.includes(key)) continue

      const { method, uri, callback } = routers[key]

      if (!routeFromDecorator[method]) routeFromDecorator[method] = {}

      routeFromDecorator[method][uri] = callback
    }

    Reflect.defineMetadata('routeFromDecorator', routeFromDecorator, Target)

    return class extends Target {
      constructor(...args) {
        super(...args)

        this.model = m
      }
    }
  }
}

module.exports = {
  InjectMongone
}
