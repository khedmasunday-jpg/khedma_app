const express = require('express');
const mongoose = require('mongoose');

const app = express();

mongoose.connect(undefined).catch(e => console.log('caught mongoose error', e.message));

app.get('/api/auth/login', (req, res) => {
  res.status(200).json({ ok: true });
});

module.exports = app;
