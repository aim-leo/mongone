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
  // the default params should passed the test
  const err = this.test(val)
  if (err) throw err
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

T.prototype.schemaOption = function (val) {
  asset(val, 'Object')

  this._schemaOption = val

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
  const option = this._schemaOption || {}
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
    schemaJson.type = [childSchemaJson]
  }

  return schemaJson
}

ObjectT.prototype.toMongooseSchemaJson = function () {
  if (!this._child) {
    throw new Error('schema is empty')
  }

  const res = toMongooseSchemaJson.call(this)
  res.type = {}
  for (const key in this._child) {
    const item = this._child[key]

    if (item._type === 'Object' && this._child) {
      res.type[key] = ObjectT.prototype.toMongooseSchemaJson.call(item)
      continue
    }
    res.type[key] = toMongooseSchemaJson.call(item)
  }

  return res
}

ObjectT.prototype.loopGetProps = function () {
  return loopGetProps.call(this.toMongooseSchemaJson(), 'type')
}

// ObjectT.prototype.initComputedHooks = function (event) {
//   // get all computed props
//   if (!this._child) return

//   let computedProps = []

//   for (const key in this._child) {
//     if (this._child[key]._computed) {
//       computedProps.push({
//         key,
//         computed: this._child[key]._computed,
//         computedPriority: this._child[key]._computedPriority
//       })
//     }
//   }

//   if (computedProps.length === 0) return

//   // sort
//   computedProps = computedProps.sort(
//     (a, b) => a.computedPriority - b.computedPriority
//   )

//   event.on('beforeChange', async ({ doc }) => {
//     for (const prop of computedProps) {
//       try {
//         const { key, computed } = prop
//         const res = await computed(doc)

//         if (
//           res === undefined ||
//           Number.isNaN(res) ||
//           res === null ||
//           res instanceof Error
//         ) {
//           continue
//         }

//         doc[key] = res
//       } catch {}
//     }
//   })

//   return computedProps
// }

ObjectT.prototype.initComputedHooks = function (event) {
  // get all computed props
  if (!this._child) return

  const computeds = loopGetProps.call(this, '_computed').toReverse()
  const computedPrioritys = loopGetProps.call(this, '_computedPriority').sort((a, b) => {
    const aLevel = a.key.split('.').length
    const bLevel = b.key.split('.').length

    if (aLevel > bLevel) {
      return -1
    } else if (aLevel === bLevel) {
      return a.value - b.value
    }

    return 1
  })

  if (computeds.length === 0) return

  event.on('beforeChange', async ({ doc }) => {
    for (const prop of computedPrioritys) {
      try {
        const { key } = prop
        const { value: computed } = computeds.filter(item => item.key === key)[0]

        const path = key.split('.')

        const parentDoc = path.length < 2 ? doc : get(doc, path.slice(0, -1).join('.'))

        const res = await computed.call(parentDoc, doc, parentDoc)

        if (
          res === undefined ||
          Number.isNaN(res) ||
          res === null ||
          res instanceof Error
        ) {
          continue
        }

        set(doc, key, res)
      } catch {}
    }
  })

  return computeds
}

// get prop and it child's prop, return a array like: [{ key: 'propKey', value: 'propValue' }]
// if call loopGetProp(prop).toReverse(), will return a array orderby it's prop deep, little deep prop will at last
function loopGetProps(prop) {
  const res = []
  for (const key in this._child) {
    if (this._child[key].hasOwnProperty(prop)) {
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

  defineUnEnumerableProperty(res, 'toReverse', function() {
    return this.sort((a, b) => getPropDeep(b.key) - getPropDeep(a.key))
  })

  defineUnEnumerableProperty(res, 'toPositive', function() {
    return this.sort((a, b) => getPropDeep(a.key) - getPropDeep(b.key))
  })

  defineUnEnumerableProperty(res, 'toObject', function() {
    const obj = {}

    for (const item of this) {
      obj[item.key] = item.value
    }

    return obj
  })

  return res
}

// assign default value
ObjectT.prototype.initSetDefaultHooks = function (event) {
  if (!this._child) return

  const defaults = loopGetProps.call(this, '_default').toReverse()

  if (defaults.length === 0) return

  event.on('beforeCreate', doc => {
    for (const item of defaults) {
      // if the field is undefined
      if (doc[item.key] === undefined) {
        set(doc, item.key, item.value)
      }
    }
  })

  return defaults
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
  const refFilterMessages = loopGetProps
    .call(this, '_refFilterMessage')
    .toObject()

  event.on('beforePostEffect', async ({ doc }) => {
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
            refFilterMessages[key] || 'Failed， refFilter validate not pass'
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

  let list = loopGetProps
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

function toMongooseSchema(schemaJson) {
  if (schemaJson.type && typeof schemaJson.type === 'object') {
    for (const key in schemaJson.type) {
      schemaJson.type[key] = toMongooseSchema(schemaJson.type[key])
    }

    schemaJson.type = new mongoose.Schema(schemaJson.type)
  }

  return schemaJson
}

ObjectT.prototype.toMongooseSchema = function () {
  const schemaJson = this.toMongooseSchemaJson()

  // as root schema, auto add createTime and updateTime field
  schemaJson.type.createTime = {
    type: Date,
    default: Date.now
  }

  schemaJson.type.updateTime = {
    type: Date,
    default: Date.now
  }

  return toMongooseSchema(schemaJson).type
}

module.exports = T
