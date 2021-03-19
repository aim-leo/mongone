const addedMethods = [
  'unique',
  'exclude',
  'forbidUpdate',
  'default',
  'ref',
  'autoJoin',
  'schemaOption',
  'schemaType',
  'computed',
  'input',
  'output',
  'toMongooseSchemaJson'
]

const booleanSetMethods = ['unique', 'exclude', 'forbidUpdate', 'autoJoin']
const stringSetMethods = ['ref', 'schemaType']

test(`the origin tegund should not have those method`, () => {
  const { string } = require('tegund')

  for (const item of addedMethods) {
    expect(string()[item]).toBe(undefined)
  }
})

test(`the new tegund should have those method`, () => {
  const { T } = require('tegund')
  const { string } = require('../src/type')

  for (const item of addedMethods) {
    expect(string()[item]).toBeDefined()
  }

  // the new tegund should instance of T
  expect(string()).toBeInstanceOf(T)
})

test(`set boolean params`, () => {
  const { string } = require('../src/type')

  const t = string()

  for (const item of booleanSetMethods) {
    expect(t[`_${item}`]).toBe(undefined)

    t[item]()

    expect(t[`_${item}`]).toBe(true)

    t[item](false)

    expect(t[`_${item}`]).toBe(false)

    // if set number type
    expect(() => {
      t[item](1)
    }).toThrow()

    // autoJoin can get a string params
    if (item !== 'autoJoin') {
      expect(() => {
        t[item]('')
      }).toThrow()
    }
  }
})

test(`autoJoin can set a string params`, () => {
  const { string } = require('../src/type')

  const t = string()

  expect(t._autoJoin).toBe(undefined)

  t.autoJoin('name')

  expect(t._autoJoin).toBe('name')
})


test(`set string params`, () => {
  const { string } = require('../src/type')

  const t = string()

  for (const item of stringSetMethods) {
    expect(t[`_${item}`]).toBe(undefined)

    t[item]('string')

    expect(t[`_${item}`]).toBe('string')

    // if set other type
    expect(() => {
      t[item](1)
    }).toThrow()
  }
})

test(`set computed params`, () => {
  const { string } = require('../src/type')

  const t = string()
  const func = () => {}

  expect(t._computed).toBe(undefined)
  expect(t._computedPriority).toBe(undefined)

  t.computed(func)

  expect(t._computed).toBe(func)
  expect(t._computedPriority).toBe(0)

  t.computed(func, 1)

  expect(t._computed).toBe(func)
  expect(t._computedPriority).toBe(1)
})

test(`set input params`, () => {
  const { string } = require('../src/type')

  const t = string()
  const func = () => {}

  expect(t._inputTransform).toBe(undefined)

  t.input(func)

  expect(t._inputTransform).toBe(func)
})

test(`set output params`, () => {
  const { string } = require('../src/type')

  const t = string()
  const func = () => {}

  expect(t._outputTransform).toBe(undefined)

  t.output(func)

  expect(t._outputTransform).toBe(func)
})

test(`set default params`, () => {
  const { string } = require('../src/type')

  const t = string()

  expect(t._default).toBe(undefined)

  expect(() => {
    t.default(1)
  }).toThrow()

  t.default('1')

  expect(t._default).toBe('1')
})

test(`set addtional mongoose schema options`, () => {
  const { string } = require('../src/type')

  const t = string()

  expect(t._schemaOption).toBe(undefined)

  expect(() => {
    t.schemaOption(1)
  }).toThrow()

  const option = {
    lowercase: true
  }

  t.schemaOption(option)

  expect(t._schemaOption).toBe(option)
})