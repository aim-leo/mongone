const mongoose = require('mongoose')

const { createModel } = require('./mongo-server')
const { ValidateError } = require('tegund')
const { integer, string, object } = require('../type')

test(`test search`, async () => {
  let result = null

  const model = createModel(
    object({
      name: string(),
      index: integer()
    })
  )
  
  // insert 20 doc
  for (let i = 0; i < 20; i++) {
    await model.insert({
      name: 'name' + i,
      index: 20 - i
    })
  }

  // query
  const docNum = await model.count()
  expect(docNum).toBe(20)

  // search page 1
  result = await model.search({})

  expect(result.count).toBe(20)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(10)

  // page 2
  result = await model.search({
    page: 2
  })

  expect(result.count).toBe(20)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(2)
  expect(result.docs.length).toBe(10)

  // page 3
  result = await model.search({
    page: 3
  })

  expect(result.count).toBe(20)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(3)
  expect(result.docs.length).toBe(0)

  // limit 1
  result = await model.search({
    limit: 1
  })

  expect(result.count).toBe(20)
  expect(result.limit).toBe(1)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(1)

  // limit 100
  result = await model.search({
    limit: 100
  })

  expect(result.count).toBe(20)
  expect(result.limit).toBe(100)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(20)

  // limit 0
  result = await model.search({
    limit: 0
  })

  expect(result.count).toBe(20)
  expect(result.limit).toBe(0)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(20)

  // query by id, invalid id
  result = await model.search({
    id: 0
  })

  expect(result).toBeInstanceOf(ValidateError)

  // query by id, exsist id
  const doc = await model.queryOne()
  result = await model.search({
    id: doc._id
  })

  expect(result.count).toBe(1)
  expect(result.docs.length).toBe(1)

  // query by id, not exsist id
  result = await model.search({
    id: new mongoose.Types.ObjectId()
  })

  expect(result.count).toBe(0)
  expect(result.docs.length).toBe(0)

  // query name = name1
  result = await model.search({
    filter: {
      name: 'name1'
    }
  })

  expect(result.count).toBe(1)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(1)

  // query index >= 5
  result = await model.search({
    filter: {
      index: {
        $gte: 5
      }
    }
  })

  expect(result.count).toBe(16)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(10)

  // query name includes '1'
  result = await model.search({
    search: {
      value: '1',
      scope: ['name']
    }
  })

  expect(result.count).toBe(11)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(10)

  // query index >= 5, and name includes '1'
  result = await model.search({
    filter: {
      index: {
        $gte: 5
      }
    },
    search: {
      value: '1',
      scope: ['name']
    }
  })

  expect(result.count).toBe(7)
  expect(result.limit).toBe(10)
  expect(result.page).toBe(1)
  expect(result.docs.length).toBe(7)
})
