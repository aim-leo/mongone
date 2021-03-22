const mongoose = require('mongoose')

const {
  string,
  number,
  integer,
  float,
  date,
  boolean,
  array,
  object,
  never,
  at,

  defineType
} = require('tegund')

require('./proto')

const id = defineType('id', () =>
  at(string(), object())
    .schemaType('ObjectId')
    .addValidator({
      name: 'validateMongoObjectId',
      validator: val => mongoose.Types.ObjectId.isValid(val),
      message: 'Expected a valid mongodb ObjectId'
    })
)

const ids = defineType('ids', () => array(id()))

module.exports = {
  string,
  number,
  integer: (...args) => integer(...args).schemaType('Number'),
  float: (...args) => float(...args).schemaType('Number'),
  date,
  boolean,
  array,
  object,
  id,
  ids,
  never
}
