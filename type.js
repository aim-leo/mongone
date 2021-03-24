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
  id: idType,

  defineType
} = require('tegund')

require('./proto')

// override
const id = defineType('id', () =>
  idType()
    .clone()
    .schemaType('ObjectId')
    .addValidator({
      name: 'MongoObjectIdValidator',
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
