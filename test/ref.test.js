const { createModel } = require('./mongo-server')
const { ValidateError } = require('tegund')

test(`test ref`, async () => {
  const { object, string, integer, id } = require('../src/type')

  let res = null
  let queryRes = null

  const userCategory = createModel(
    object({
      name: string()
    }),
    'userCategory'
  )

  const user = createModel(
    object({
      name: string(),
      cate: id().ref('userCategory')
    }),
    'user'
  )

  // insert a category
  const insertCategoryRes = await userCategory.insert({
    name: 'cate1'
  })

  expect(insertCategoryRes).not.toBeInstanceOf(ValidateError)

  // insert a user

  // insert a user without id
  res = await user.insert({
    name: 'user1'
  })

  expect(res).toBeInstanceOf(ValidateError)

  // insert a user with a wrong id
  res = await user.insert({
    name: 'user1',
    cate: '123'
  })

  expect(res).toBeInstanceOf(ValidateError)

  // insert a user with a wrong id
  res = await user.insert({
    name: 'user1',
    cate: insertCategoryRes[0]._id
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // query
  res = await user.queryById(res[0]._id)

  expect(res).toMatchObject({
    name: 'user1',
    cate: insertCategoryRes[0]._id
  })
})


test(`test ref filter`, async () => {
  const { object, string, integer, id } = require('../src/type')

  let res = null
  let queryRes = null

  const postCategory = createModel(
    object({
      name: string()
    }),
    'postCategory'
  )

  const refFilterMessage = 'this is the ref filter message'

  const post = createModel(
    object({
      name: string(),
      cate: id().ref('postCategory').refFilter(val => val.name === 'cate2', refFilterMessage)
    }),
    'post'
  )

  // insert some categories
  const insertCate1Res = await postCategory.insert({
    name: 'cate1'
  })

  expect(insertCate1Res).not.toBeInstanceOf(ValidateError)

  const insertCate2Res = await postCategory.insert({
    name: 'cate2'
  })

  expect(insertCate2Res).not.toBeInstanceOf(ValidateError)

  // insert a post

  // can not pass
  res = await post.insert({
    name: 'post1',
    cate: insertCate1Res[0]._id
  })

  expect(res).toBeInstanceOf(ValidateError)
  expect(res.message).toBe(refFilterMessage)
  // can pass
  res = await post.insert({
    name: 'post1',
    cate: insertCate2Res[0]._id
  })

  expect(res).not.toBeInstanceOf(ValidateError)
})