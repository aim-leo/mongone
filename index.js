const mongoose = require('mongoose')
const Emitter = require('emittery')

const { T, ValidateError, object, string, boolean } = require('tegund')

const { searchInterface } = require('@mongone/encodeuri')

class Mongone extends Emitter {
  static mongoose = mongoose
  static throwError = false

  static connection = null
  static connected = false

  static connect(
    url,
    option = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      useFindAndModify: false
    }
  ) {
    string().assert(url)
    object().assert(option)

    if (Mongone.connection) return Mongone.connection

    mongoose.connect(url, option)

    return new Promise((resolve, reject) => {
      mongoose.connection.on('error', e => {
        console.error(`MongoDB: ${url} connect failed!`)

        Mongone.connected = false

        reject(e)
      })
      mongoose.connection.once('open', () => {
        console.log(`MongoDB: ${url} connect success!`)

        Mongone.connected = true

        resolve(mongoose.connection)
      })

      Mongone.connection = mongoose.connection
    })
  }

  static disconnect() {
    mongoose.disconnect()

    Mongone.connected = false
    Mongone.connection = null
  }

  constructor(name, t, option = {}) {
    super()

    // validate
    string().assert(name)
    object().instance(T).assert(t)
    object({ throwError: boolean().optional() }).assert(option)

    this.name = name
    this.t = t
    this.option = option

    this.schema = t.toMongooseSchema()
    this.model = Mongone.mongoose.model(name, this.schema)

    // init computed hooks
    this.t.initSetDefaultHooks(this)
    this.t.initComputedHooks(this)
    this.t.initInputHooks(this)
    this.t.initOutputHooks(this)
    this.t.initRefValidateHooks(this)

    this.on('validate', this._validate.bind(this))

    this._isMongone = true
  }

  _validate({ doc, env }) {
    let err = null

    if (env === 'update') {
      this.t.setContext('env', env)

      err = this.t.testProvided(doc)

      this.t.clearContext('env')
    } else {
      err = this.t.test(doc)
    }

    if (err) throw err
  }

  async _onError(error) {
    if (error.code === 11000) {
      error = new ValidateError({
        message: 'There was a duplicate key error'
      })
    }

    await this.emit('error', error)

    let throwError = Mongone.throwError

    if ('throwError' in this.option) {
      throwError = this.option.throwError
    }

    if (throwError) throw error

    return error
  }

  async insert(docs, ...args) {
    try {
      if (!Array.isArray(docs)) {
        docs = [docs]
      }

      for (const doc of docs) {
        await this.emit('beforeCreate', doc)

        await this.emit('beforeChange', { doc, env: 'create' })

        await this.emit('validate', { doc, env: 'create' })

        doc.createTime = new Date()
        doc.updateTime = new Date()

        await this.emit('beforePostEffect', { doc, env: 'create' })
      }

      const res = await this.model.insertMany(docs, ...args)

      await this.emit('afterCreate', res)

      return res
    } catch (e) {
      return await this._onError(e)
    }
  }

  async update(filter = {}, update, options = {}) {
    if (options.new !== false) options.new = true
    try {
      const result = []
      // get the docs
      const docs = await this.model.find(filter)

      for (const doc of docs) {
        await this.emit('beforeUpdate', update)

        await this.emit('validate', { doc: update, env: 'update' })

        // assign the changes
        Object.assign(doc, update)

        await this.emit('beforeChange', { doc, env: 'update' })

        doc.updateTime = new Date()

        await this.emit('beforePostEffect', { doc, env: 'update' })

        const res = await this.model.findByIdAndUpdate(doc._id, doc, options)

        await this.emit('afterUpdate', res)

        result.push(res)
      }

      return result
    } catch (e) {
      return await this._onError(e)
    }
  }

  async updateOne(filter, update, options = {}) {
    if (options.new !== false) options.new = true
    try {
      // get the docs
      const doc = await this.model.findOne(filter)

      if (!doc) {
        const e = new Error('update fail: can not find this document')
        e.status = 400

        throw e
      }

      await this.emit('beforeUpdate', update)

      await this.emit('validate', { doc: update, env: 'update' })

      // assign the changes
      Object.assign(doc, update)

      await this.emit('beforeChange', { doc, env: 'update' })

      doc.updateTime = new Date()

      await this.emit('beforePostEffect', { doc, env: 'update' })

      const res = await this.model.findByIdAndUpdate(doc._id, doc, options)

      await this.emit('afterUpdate', res)

      return res
    } catch (e) {
      return await this._onError(e)
    }
  }

  updateById(id, ...args) {
    return this.updateOne(
      {
        _id: id
      },
      ...args
    )
  }

  async delete(filter, ...args) {
    try {
      // get the docs
      const docs = await this.model.find(filter)

      for (const doc of docs) {
        await this.emit('beforeDelete', doc)
      }

      const res = await this.model.deleteMany(filter, ...args)

      await this.emit('afterDelete', res)

      return res
    } catch (e) {
      return await this._onError(e)
    }
  }

  async deleteOne(filter, ...args) {
    try {
      // get the docs
      const doc = await this.model.findOne(filter)

      await this.emit('beforeDelete', doc)

      const res = await this.model.deleteOne(filter, ...args)

      await this.emit('afterDelete', res)

      return res
    } catch (e) {
      return await this._onError(e)
    }
  }

  deleteById(id, ...args) {
    return this.deleteOne(
      {
        _id: id
      },
      ...args
    )
  }

  count(...args) {
    return this.model.countDocuments(...args)
  }

  async find(filter, exclude, option = {}, ...args) {
    try {
      await this.emit('beforeQuery', filter)

      exclude = this.t.getExcludeField(exclude).formatString()
      option.populate = this.t.getPopulateField(option.populate)
      option.lean = true

      const method = option.one ? this.model.findOne : this.model.find

      const res = await method.call(
        this.model,
        filter,
        exclude,
        option,
        ...args
      )

      await this.emit('afterQuery', res)

      return res
    } catch (e) {
      return await this._onError(e)
    }
  }

  async findOne(filter, exclude, option = {}, ...args) {
    option.one = true

    return this.find(filter, exclude, option, ...args)
  }

  findById(id, ...args) {
    return this.findOne(
      {
        _id: id
      },
      ...args
    )
  }

  async query(option) {
    try {
      searchInterface.assert(option)

      const { filter = {}, select, sort, populate, id, search } = option

      let { limit = 10, page = 1 } = option

      limit = Number(limit)
      page = Number(page)

      // if define id
      if (id) {
        const doc = await this.findById(id, select, {
          populate
        })
        return {
          count: doc ? 1 : 0,
          docs: doc ? [doc] : []
        }
      }

      // assign search
      if (search) {
        const searchFilters = []
        const reg = {
          $regex: new RegExp(decodeURIComponent(search.value), 'i')
        }

        for (const scope of search.scope) {
          searchFilters.push({
            [scope]: reg
          })
        }

        filter['$or'] = searchFilters
      }

      const count = await this.count(filter)

      const queryOption = {
        limit,
        skip: (page - 1) * limit,
        sort,
        populate
      }

      if (limit === 0 || limit === '0') {
        delete queryOption.limit
      }

      const docs =
        count === 0 ? [] : await this.find(filter, select, queryOption)

      return {
        docs,
        count,
        page,
        limit
      }
    } catch (e) {
      return await this._onError(e)
    }
  }
}

module.exports = Mongone
