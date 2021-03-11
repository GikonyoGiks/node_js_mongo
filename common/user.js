// import the necessary modules
'use strict';

const mongoose = require('mongoose');
const Schema = mongoose.Schema;

// create an export function to encapsulate the model creation
module.exports = function() {
  // define schema
  const UserSchema = new Schema({
    oauthID: Number,
    email: String,
    name: String,
    picture: String,
    created: Date,
    accessToken: String,
    refreshToken: String
  });
  mongoose.model('User', UserSchema);
};
