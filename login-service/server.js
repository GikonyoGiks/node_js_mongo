// server.js

const express = require('express');
const session = require('express-session');
const app = express();
const port = process.env.PORT || 3000;

const db = require('./common/db');
const User = require('./common/models/user');

const passport = require('passport');
const { ensureLoggedIn } = require('connect-ensure-login');
const fs = require('fs');

const GoogleStrategy = require('passport-google-oauth').OAuth2Strategy;

const { google } = require('googleapis');


/*  EXPRESS */

app.set('view engine', 'ejs');

app.use(session({
  resave: false,
  saveUninitialized: true,
  secret: 'SECRET'
}));

app.get('/login', function (req, res) {
  res.render('pages/auth');
});

app.get('/logout', function (req, res) {
  req.session.destroy(function (err) {
    res.redirect('/');
  });
});

app.listen(port, () => console.log(`App listening on port ${port}`));

/* Passport */

app.use(passport.initialize());
app.use(passport.session());

app.get('/',
  ensureLoggedIn('/login'),
  function (req, res) {
    res.render('pages/home', { user: req.user });
  });

app.get('/error', (req, res) => res.send("error logging in"));

passport.serializeUser(function (user, done) {
  done(null, user._id);
});

passport.deserializeUser(function (id, done) {
  User.findById(id, function (err, user) {
    if (!err) done(null, user);
    else done(err, null);
  });
});

/*  Google AUTH  */

fs.readFile('./common/credentials.json', (err, content) => {
  if (err) return console.log('Error loading credentials file:', err);
  initPassport(JSON.parse(content));
});

function initPassport(credentials) {
  const { client_secret, client_id, redirect_uris } = credentials.installed;
  passport.use(new GoogleStrategy({
    clientID: client_id,
    clientSecret: client_secret,
    callbackURL: redirect_uris[0]
  },
    function (accessToken, refreshToken, profile, done) {
      User.findOne({ oauthID: profile.id }, function (err, user) {
        if (err) {
          console.log(err);  // handle errors!
        }
        if (!err && user !== null) {
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;
        } else {
          user = new User({
            oauthID: profile.id,
            name: profile.displayName,
            email: profile.emails[0].value,
            picture: profile.photos[0].value,
            created: Date.now(),
            accessToken: accessToken,
            refreshToken: refreshToken
          });
        }
        user.save(function (err) {
          if (err) {
            console.log(err);  // handle errors!
          } else {
            done(null, user);
          }
        });
      });
    }
  ));
}

app.get('/auth/google', (req, res, next) => {
  passport.authenticate("google", {
      accessType: 'offline',
      prompt: 'consent',
      session: false,
      state: req.params.id,
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/gmail.readonly']
  })(req, res, next);
});

app.get('/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/login' }),
  function (req, res) {
    res.redirect('/');
  });