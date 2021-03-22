const { createModel } = require('./mongo-server')
const { ValidateError } = require('tegund')

test(`test ref`, async () => {
  const { object, string, id } = require('../type')

  let res = null

  const userCategory = createModel(
    object({
      name: string(),
      alias: string()
    }),
    'userCategory'
  )

  const user = createModel(
    object({
      name: string(),
      cate: id().ref('userCategory').autoJoin()
    }),
    'user'
  )

  const cateDoc = {
    name: 'cate1',
    alias: 'cate1_alias'
  }

  // insert a category
  const insertCategoryRes = await userCategory.insert(cateDoc)

  expect(insertCategoryRes).not.toBeInstanceOf(ValidateError)

  // insert a user

  // insert a user with a wrong id
  const insertRes = await user.insert({
    name: 'user1',
    cate: insertCategoryRes[0]._id
  })

  expect(res).not.toBeInstanceOf(ValidateError)

  // query
  res = await user.queryById(insertRes[0]._id)

  expect(res.cate.alias).toBe('cate1_alias')

  // override populate
  res = await user.queryById(insertRes[0]._id, undefined, {
    populate: {
      override: [
        {
          path: 'cate',
          select: '-alias'
        }
      ]
    }
  })

  expect(res.cate.alias).toBe(undefined)
})
