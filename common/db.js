const mongoose = require('mongoose');

const MONGO_USERNAME = 'fred_mongo';
const MONGO_PASSWORD = 'fred_mongo';
const MONGO_HOSTNAME = '127.0.0.1';
const MONGO_PORT = '27017';
const MONGO_DB = 'fred';

const url = `mongodb://${MONGO_USERNAME}:${MONGO_PASSWORD}@${MONGO_HOSTNAME}:${MONGO_PORT}/${MONGO_DB}?authSource=admin`;

mongoose
  .connect(url, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(console.log(`MongoDB connected ${MONGO_URI}`))
  .catch(err => console.log(err));
