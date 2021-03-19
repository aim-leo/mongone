const mongoose = require('mongoose')
const { MongoMemoryServer } = require('mongodb-memory-server')
const M = require('../src/index')

// May require additional time for downloading MongoDB binaries
jasmine.DEFAULT_TIMEOUT_INTERVAL = 600000

let mongoServer
beforeAll(async () => {
  mongoServer = new MongoMemoryServer()
  const mongoUri = await mongoServer.getUri()
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true, useFindAndModify: false }, err => {
    if (err) console.error(err)
  })
})

afterAll(async () => {
  await mongoose.disconnect()
  await mongoServer.stop()
})

M.mongoose = mongoose

function createModel(t, name = mongoose.Types.ObjectId().toString()) {
  return new M(name, t)
}

module.exports = {
  mongoose,
  M,
  createModel
}
