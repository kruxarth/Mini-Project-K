import express from 'express';
import { all, run, getDB } from '../db.js';

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.user) return res.redirect('/login');
  next();
}

export default router;
