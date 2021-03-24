'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const UserSchema = new Schema({
  oauthID: Number,
  email: String,
  name: String,
  picture: String,
  created: Date,
  accessToken: String,
  refreshToken: String
});

module.exports = mongoose.model('User', UserSchema)
