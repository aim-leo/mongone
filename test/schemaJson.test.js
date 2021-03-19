const typeNames = ['String', 'Number', 'Boolean', 'Date']

test(`basic type transform to mongoose schema type`, () => {
  const types = require('../src/type')

  for (const item of typeNames) {
    const t = types[item.toLowerCase()]()

    expect(t.toMongooseSchemaJson()).toEqual({
      type: item
    })
  }
})

test(`array transform to mongoose schema type`, () => {
  const { array } = require('../src/type')

  const t = array()

  expect(t.toMongooseSchemaJson()).toMatchObject({
    type: 'Array'
  })

  const t2 = array('string')

  expect(t2.toMongooseSchemaJson()).toMatchObject({
    type: [
      {
        type: 'String'
      }
    ]
  })
})

test(`object transform to mongoose schema type`, () => {
  const { object, string } = require('../src/type')

  const t = object({
    a: string(),
    b: object({
      c: string()
    })
  })

  const mongoose = require('mongoose')

  expect(t.toMongooseSchema()).toBeInstanceOf(mongoose.Schema)

  const schema = new mongoose.Schema({
    a: {
      type: 'String'
    },
    b: {
      type: new mongoose.Schema({
        c: {
          type: 'String'
        }
      })
    }
  })

  expect(JSON.stringify(t.toMongooseSchema()).length).toEqual(
    JSON.stringify(schema).length
  )
})
