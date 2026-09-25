const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');

router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/');
  res.render('auth/login', { title: 'Login', currentUser: null, flashMsg: null, error: null });
});

router.post('/login', (req, res) => {
  const { username, password } = req.body;
  const user = db.getAll('users').find((u) => u.username === username);
  if (!user || !bcrypt.compareSync(password || '', user.password_hash)) {
    return res.render('auth/login', {
      title: 'Login', currentUser: null, flashMsg: null,
      error: 'Username atau password salah.'
    });
  }
  req.session.user = { id: user.id, username: user.username, nama: user.nama, role: user.role };
  db.log(user.id, 'login', 'users', user.id, `${user.username} login`);
  res.redirect('/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
