const { createModel } = require('./mongo-server')
const { ValidateError } = require('tegund')

test(`rest methods`, async () => {
  const { object, string } = require('../src/type')

  const user = createModel(
    object({
      name: string().min(3).max(5)
    })
  )

  let docs = await user.find({})

  expect(docs.length).toEqual(0)

  // insert a user
  const newUser = {
    name: 'name'
  }
  const res = await user.insert(newUser)
  expect(res).not.toBeInstanceOf(ValidateError)

  docs = await user.find({})

  expect(docs.length).toEqual(1)
  expect(docs).toMatchObject([newUser])

  // update user
  const updateRes = await user.updateById(res[0]._id, {
    name: 'name1'
  })

  expect(updateRes).not.toBeInstanceOf(ValidateError)

  let doc = await user.findById(res[0]._id)
  expect(doc.name).toBe('name1')

  // delete user
  const deleteRes = await user.deleteById(res[0]._id)
  expect(deleteRes).not.toBeInstanceOf(ValidateError)

  doc = await user.findById(res[0]._id)
  expect(doc).toBe(null)
})


test(`validate string type, min max`, async () => {
  const { object, string } = require('../src/type')

  const user = createModel(
    object({
      name: string().min(3).max(5)
    })
  )

  // if input a empty
  let err = await user.insert({})
  expect(err).toBeInstanceOf(ValidateError)

  err = await user.insert({
    name: 1
  })
  expect(err).toBeInstanceOf(ValidateError)

  err = await user.insert({
    name: '12'
  })
  expect(err).toBeInstanceOf(ValidateError)

  err = await user.insert({
    name: '123456'
  })
  expect(err).toBeInstanceOf(ValidateError)
})

test(`validate unique = false`, async () => {
  const { object, string } = require('../src/type')

  let res = null

  const foo = createModel(
    object({
      name: string()
    })
  )

  const docs = [
    {
      name: 'name'
    },
    {
      name: 'name'
    }
  ]

  // insert duplicate items
  res = await foo.insert(docs)

  expect(res).not.toBeInstanceOf(ValidateError)

  // query
  res = await foo.query()

  expect(res).toMatchObject(docs)
})

test(`validate unique = true`, async () => {
  const { object, string } = require('../src/type')

  let res = null

  const foo = createModel(
    object({
      name: string().unique()
    })
  )

  // insert duplicate items
  res = await foo.insert({
    name: 'name'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  res = await foo.insert({
    name: 'name'
  })

  expect(res).toBeInstanceOf(ValidateError)
})

test(`exclude test`, async () => {
  const { object, string, integer } = require('../src/type')

  let res = null
  let docs = null

  const foo = createModel(
    object({
      name: string(),
      age: integer().exclude()
    })
  )

  // insert duplicate items
  res = await foo.insert({
    name: 'name',
    age: 10
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  docs = await foo.queryById(res[0]._id)

  expect(docs).not.toHaveProperty('age')

  // override select
  docs = await foo.queryById(res[0]._id, { override: "name age" })

  expect(docs).toHaveProperty('age', 10)

  // or include it
  docs = await foo.queryById(res[0]._id, { include: ["age"] })

  expect(docs).toHaveProperty('age', 10)

  // or exclude more
  docs = await foo.queryById(res[0]._id, { exclude: ["name"] })

  expect(docs).not.toHaveProperty('name')
})

test(`forbid test`, async () => {
  const { object, string, integer } = require('../src/type')

  let res = null
  let updateRes = null

  const foo = createModel(
    object({
      name: string(),
      age: integer().forbid()
    })
  )

  // insert duplicate items
  res = await foo.insert({
    name: 'name',
    age: 10
  })

  expect(res).toBeInstanceOf(ValidateError)

  // insert duplicate items
  res = await foo.insert({
    name: 'name'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // and try to update it
  updateRes = await foo.updateById(res[0]._id, {
    age: 10
  })

  expect(updateRes).toBeInstanceOf(ValidateError)

  // update else, but wrong input
  updateRes = await foo.updateById(res[0]._id, {
    name: 10
  })

  expect(updateRes).toBeInstanceOf(ValidateError)

  updateRes = await foo.updateById(res[0]._id, {
    name: 'name2'
  })

  expect(updateRes).not.toBeInstanceOf(ValidateError)
})

test(`forbidUpdate test`, async () => {
  const { object, string, integer } = require('../src/type')

  let res = null
  let updateRes = null

  const foo = createModel(
    object({
      name: string(),
      age: integer().forbidUpdate()
    })
  )

  // insert duplicate items
  res = await foo.insert({
    name: 'name',
    age: 10
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // and try to update it
  updateRes = await foo.updateById(res[0]._id, {
    age: 11
  })

  expect(updateRes).toBeInstanceOf(ValidateError)

  updateRes = await foo.updateById(res[0]._id, {
    name: 'name2'
  })

  expect(updateRes).not.toBeInstanceOf(ValidateError)
})

test(`default test`, async () => {
  const { object, string, integer } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      name: string(),
      age: integer().default(10)
    })
  )

  res = await foo.insert({
    name: 'name'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // and try to update it
  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('age', 10)

  // insert a new one
  res = await foo.insert({
    name: 'name2',
    age: 11
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // and try to update it
  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('age', 11)
})