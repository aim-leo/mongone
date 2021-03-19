const { createModel } = require('./mongo-server')
const { ValidateError } = require('tegund')

test(`test output`, async () => {
  const { object, string, integer } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      name: string(),
      sex: integer()
        .enum([0, 1])
        .default(0)
        .output(val => (val === 0 ? 'man' : 'woman'))
    })
  )

  res = await foo.insert({
    name: 'name'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // and try to update it
  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toMatchObject({
    name: 'name',
    sex: 'man'
  })
})


test(`test input`, async () => {
  const { object, string } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      name: string().input(val => val.trim().toLowerCase())
    })
  )

  res = await foo.insert({
    name: ' NAME   '
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // and try to update it
  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toMatchObject({
    name: 'name',
  })
})

test(`test computed`, async () => {
  const { object, string } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      firstName: string(),
      lastName: string(),
      fullName: string().computed(doc => doc.firstName + ' ' + doc.lastName)
    })
  )

  res = await foo.insert({
    firstName: 'Tim',
    lastName: 'Cook'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('fullName', 'Tim Cook')

  // update
  const updateRes = await foo.updateById(res[0]._id, {
    firstName: 'Stefen'
  })

  expect(updateRes).not.toBeInstanceOf(ValidateError)

  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('fullName', 'Stefen Cook')
})

test(`test relative computed, default set priority by define order`, async () => {
  const { object, string } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      firstName: string(),
      lastName: string(),
      fullName: string().computed(doc => doc.firstName + ' ' + doc.lastName),
      address: string(),
      nameWithAddress: string().computed(doc => {  // related to another computed
        return `${doc.address} ${doc.fullName}`
      })
    })
  )

  res = await foo.insert({
    firstName: 'Tim',
    lastName: 'Cook',
    address: 'American'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('fullName', 'Tim Cook')
  expect(queryRes).toHaveProperty('nameWithAddress', 'American Tim Cook')
})

test(`test relative computed, set priority by manual`, async () => {
  const { object, string } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      firstName: string(),
      lastName: string(),
      fullName: string().computed(doc => doc.firstName + ' ' + doc.lastName, 1),
      address: string(),
      nameWithAddress: string().computed(doc => {  // related to another computed
        return `${doc.address} ${doc.fullName}`
      }, 0)
    })
  )

  res = await foo.insert({
    firstName: 'Tim',
    lastName: 'Cook',
    address: 'American'
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('fullName', 'Tim Cook')
  expect(queryRes).toHaveProperty('nameWithAddress', 'American undefined')
})

test(`test relative computed, defaullt call sub computed at first`, async () => {
  const { object, string } = require('../src/type')

  let res = null
  let queryRes = null

  const foo = createModel(
    object({
      firstName: string(),
      lastName: string(),
      fullName: string().computed(doc => doc.firstName + ' ' + doc.lastName),
      address: {
        country: string(),
        city: string(),
        fullAddress: string().computed(function() {
          return this.country + ' ' + this.city
        })
      },
      nameWithAddress: string().computed(doc => {  // related to another computed
        return `${doc.address.fullAddress} ${doc.fullName}`
      })
    })
  )

  res = await foo.insert({
    firstName: 'Tim',
    lastName: 'Cook',
    address: {
      country: "American",
      city: "Alabama"
    }
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  queryRes = await foo.queryById(res[0]._id)

  expect(queryRes).toHaveProperty('fullName', 'Tim Cook')
  expect(queryRes).toHaveProperty('nameWithAddress', 'American Alabama Tim Cook')
})