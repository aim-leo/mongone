const mongoose = require('mongoose')
const { has, get, set } = require('dot-prop')

const {
  T,
  ArrayT,
  ObjectT,
  any,
  object,
  array,
  at,
  string,
  asset,
  defineUnEnumerableProperty,
  removeEmpty
} = require('tegund')

T.prototype.unique = function (val = true) {
  asset(val, 'Boolean')

  this._unique = val

  return this
}

T.prototype.exclude = function (val = true) {
  asset(val, 'Boolean')

  if (this._outputTransform) {
    throw new Error('There is no point in setting set for an excluded property')
  }

  this._exclude = val

  return this
}

T.prototype.forbidUpdate = function (val = true) {
  asset(val, 'Boolean')

  this._forbidUpdate = val

  // add a validator
  this.addValidator({
    name: 'forbidUpdate',
    validator: function () {
      if (this._context.env === 'update') return false
    },
    message: 'field can not update'
  })

  return this
}

T.prototype.default = function (val) {
  this._default = val

  return this
}

T.prototype.ref = function (val) {
  asset(val, 'String')

  // this ref field can not override
  if (this._ref) {
    throw new Error('The ref field is defined, can not override it')
  }

  this._ref = val

  defineUnEnumerableProperty(this, 'refFilter', function (refFilter, message) {
    asset(refFilter, 'Function')

    this._refFilter = refFilter
    this._refFilterMessage = message

    return this
  })

  return this
}

T.prototype.autoJoin = function (val = true) {
  asset(val, ['Boolean', 'String'])

  this._autoJoin = val

  return this
}

T.prototype.option = function (val) {
  asset(val, 'Object')

  this._option = val

  return this
}

T.prototype.schemaType = function (val) {
  asset(val, 'String')

  this._schemaType = val

  return this
}

T.prototype.computed = function (val, priority = 0) {
  asset(val, 'Function')
  asset(priority, 'Integer')

  // set the val to forbid
  this.optional()

  this._computed = val
  this._computedPriority = priority

  return this
}

T.prototype.input = function (val) {
  asset(val, 'Function')

  this._inputTransform = val

  return this
}

T.prototype.output = function (val) {
  asset(val, 'Function')

  if (this._exclude) {
    throw new Error('There is no point in setting set for an excluded property')
  }

  this._outputTransform = val

  return this
}

function toMongooseSchemaJson() {
  if (this._type === 'Object' && this._child) {
    const res = {}

    defineUnEnumerableProperty(res, '__isSubSchemaJson__', true)

    for (const key in this._child) {
      res[key] = toMongooseSchemaJson.call(this._child[key])
    }

    return res
  }

  const option = this._option || {}
  return removeEmpty(
    {
      type: this._schemaType || this._type,
      unique: this._unique,
      ref: this._ref,

      ...option
    },
    {
      removeFalse: true
    }
  )
}

T.prototype.toMongooseSchemaJson = toMongooseSchemaJson

ArrayT.prototype.toMongooseSchemaJson = function () {
  const schemaJson = toMongooseSchemaJson.call(this)
  const childSchemaJson = toMongooseSchemaJson.call(this._childCate)
  if (this._childCate) {
    schemaJson.type = [childSchemaJson.type]
  }

  return schemaJson
}

ObjectT.prototype.toMongooseSchemaJson = function () {
  if (!this._child) {
    throw new Error('schema is empty')
  }

  const res = {}
  for (const key in this._child) {
    res[key] = toMongooseSchemaJson.call(this._child[key])
  }

  return res
}

ObjectT.prototype.initComputedHooks = function (event) {
  // get all computed props
  if (!this._child) return

  let computedProps = []
  for (const key in this._child) {
    if (this._child[key]._computed) {
      computedProps.push({
        key,
        computed: this._child[key]._computed,
        computedPriority: this._child[key]._computedPriority
      })
    }
  }

  if (computedProps.length === 0) return

  // sort
  computedProps = computedProps.sort(
    (a, b) => a.computedPriority - b.computedPriority
  )

  event.on('beforeChange', async ({ doc }) => {
    for (const prop of computedProps) {
      try {
        const { key, computed } = prop
        const res = await computed(doc)

        if (
          res === undefined ||
          Number.isNaN(res) ||
          res === null ||
          res instanceof Error
        ) {
          continue
        }

        doc[key] = res
      } catch {}
    }
  })

  return computedProps
}
// get prop and it child's prop, return a array like: [{ key: 'propKey', value: 'propValue' }]
// if call loopGetProp(prop).toReverse(), will return a array orderby it's prop deep, little deep prop will at last
function loopGetProps(prop) {
  const res = []
  for (const key in this._child) {
    if (this._child[key][prop]) {
      res.push({
        key,
        value: this._child[key][prop]
      })
    }

    // if child is a objectT
    if (this._child[key] instanceof ObjectT) {
      res.push(
        ...loopGetProps.call(this._child[key], prop).map(item => {
          item.key = key + '.' + item.key

          return item
        })
      )
    }
  }

  function getPropDeep(prop) {
    return prop.split('.').length
  }

  defineUnEnumerableProperty(res, 'toReverse', () =>
    res.sort((a, b) => getPropDeep(b.key) - getPropDeep(a.key))
  )

  defineUnEnumerableProperty(res, 'toPositive', () =>
    res.sort((a, b) => getPropDeep(a.key) - getPropDeep(b.key))
  )

  defineUnEnumerableProperty(res, 'toObject', () => {
    const obj = {}

    for (const item of res) {
      obj[item.key] = item.value
    }

    return obj
  })

  return res
}

// transform value before doc insert or update to db, it will transform deeper prop first
ObjectT.prototype.initInputHooks = function (event) {
  if (!this._child) return

  const inputTransforms = loopGetProps.call(this, '_inputTransform').toReverse()

  if (inputTransforms.length === 0) return

  async function onChange(doc) {
    for (const item of inputTransforms) {
      if (has(doc, item.key)) {
        const oldValue = get(doc, item.key)
        const newValue = await item.value(oldValue)

        set(doc, item.key, newValue)
      }
    }
  }

  event.on('beforeCreate', onChange)
  event.on('beforeUpdate', onChange)

  return inputTransforms
}

ObjectT.prototype.initOutputHooks = function (event) {
  if (!this._child) return

  const outputTransforms = loopGetProps
    .call(this, '_outputTransform')
    .toReverse()

  if (outputTransforms.length === 0) return

  async function onChange(doc) {
    for (const item of outputTransforms) {
      if (has(doc, item.key)) {
        const oldValue = get(doc, item.key)
        const newValue = await item.value(oldValue)

        set(doc, item.key, newValue)
      }
    }
  }

  event.on('afterQuery', async res => {
    if (Array.isArray(res)) {
      for (const item of res) {
        await onChange(item)
      }
    } else {
      await onChange(res)
    }
  })

  return outputTransforms
}

ObjectT.prototype.initRefValidateHooks = function (event) {
  if (!this._child) return

  const refs = loopGetProps.call(this, '_ref').toObject()
  const refFilters = loopGetProps.call(this, '_refFilter').toObject()
  const refFilterMessages = loopGetProps.call(this, '_refFilterMessage').toObject()

  event.on('afterValidate', async ({ doc }) => {
    for (const key in refs) {
      const value = refs[key]

      const model = mongoose.models[value]

      if (!model) {
        throw new Error(`Failed， The Table: ${value} is not exsist`)
      }
      const id = get(doc, key)
      const queryedDoc = await model.findById(id)

      if (!queryedDoc) {
        throw new Error(
          `Failed， The Id: ${id} is not exsist at Table: ${value}`
        )
      }

      const refFilter = refFilters[key]

      // additional ref filter validate
      if (refFilter) {
        const res = await refFilter(queryedDoc)

        if (res !== true) {
          throw new Error(
            refFilterMessages[key] || `Failed， refFilter validate not pass`
          )
        }
      }
    }
  })
}

ObjectT.prototype.getExcludeField = function (addtionalSelect = {}) {
  const t = object({
    override: any().optional(),
    exclude: array('String').optional(),
    include: array('String').optional()
  })

  const err = t.test(addtionalSelect)

  if (err) {
    throw err
  }

  const { override, exclude = [], include = [] } = addtionalSelect

  if (override) {
    const res = {}
    defineUnEnumerableProperty(res, 'formatString', () => override)

    return res
  }

  // get all computed props
  if (!this._child) return

  const list = loopGetProps
    .call(this, '_exclude')
    .filter(item => item.value)
    .map(item => item.key)
    .concat(exclude)

  // rm include field
  if (include.length > 0) list = list.filter(item => !include.includes(item))

  defineUnEnumerableProperty(list, 'formatString', () =>
    list.map(item => '-' + item).join(' ')
  )

  return list
}

ObjectT.prototype.getPopulateField = function (addtionalPopulate = {}) {
  const t = object({
    override: any().optional(),
    exclude: array('String').optional(),
    include: at(
      array(object({ path: string(), select: string().optional() })),
      array('String')
    ).optional()
  })

  const err = t.test(addtionalPopulate)

  if (err) {
    throw err
  }

  const { override, exclude = [], include = [] } = addtionalPopulate

  if (override) {
    return override
  }

  if (!this._child) return

  let list = [...include]
  for (const key in this._child) {
    if (this._child[key]._autoJoin) {
      list.push(
        removeEmpty({
          path: key,
          select:
            typeof this._child[key]._autoJoin === 'string'
              ? this._child[key]._autoJoin
              : undefined
        })
      )

      continue
    }
  }

  // rm exclude field
  if (exclude.length > 0) {
    for (const prop in list) {
      const item = list[prop]
      const key = typeof item === 'object' ? item.path : item
      if (exclude.includes(key)) {
        list[key] = null
      }
    }

    list = list.filter(item => !!item)
  }

  return list
}

function toMongooseSchema() {
  const schemaJson = toMongooseSchemaJson.call(this)

  for (const key in schemaJson) {
    let value = schemaJson[key]

    if (value.__isSubSchemaJson__) {
      value = new mongoose.Schema(value)
    }
  }

  return new mongoose.Schema(schemaJson)
}

ObjectT.prototype.toMongooseSchema = toMongooseSchema

module.exports = T
