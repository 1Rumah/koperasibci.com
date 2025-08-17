import 'dotenv/config';
import express from 'express';
import session from 'express-session';
import passport from 'passport';
import GoogleStrategy from 'passport-google-oauth20';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import { fileURLToPath } from 'url';
import { stringify } from 'csv-stringify';

const prisma = new PrismaClient();
const app = express();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Middleware ---
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'devdevdev',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true }
}));
app.use(passport.initialize());
app.use(passport.session());

// --- Passport Google OAuth ---
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '')
  .split(',')
  .map(s => s.trim().toLowerCase())
  .filter(Boolean);

passport.use(new GoogleStrategy.Strategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/auth/google/callback'
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(null, false);
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          email,
          name: profile.displayName || '',
          googleId: profile.id,
          role: isAdmin ? 'ADMIN' : 'MEMBER'
        }
      });
    } else {
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          googleId: profile.id,
          role: isAdmin ? 'ADMIN' : user.role
        }
      });
    }
    return done(null, { id: user.id });
  } catch (e) {
    return done(e);
  }
}));

passport.serializeUser((user, done) => done(null, user.id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return done(null, false);
    done(null, { id: user.id, role: user.role, email: user.email, name: user.name, memberCode: user.memberCode });
  } catch (e) { done(e); }
});

// --- Auth routes ---
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/google/callback', passport.authenticate('google', {
  failureRedirect: '/anggota.html'
}), async (req, res) => {
  // Redirect berdasarkan role
  const user = req.user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
  if (dbUser?.role === 'ADMIN') return res.redirect('/admin.html');
  return res.redirect('/anggota.html');
});
app.post('/auth/logout', (req, res) => {
  req.logout(() => {
    req.session.destroy(() => res.json({ ok: true }));
  });
});

// --- Guards ---
const ensureAuth = (req, res, next) => req.isAuthenticated() ? next() : res.status(401).json({ error: 'Unauthenticated' });
const ensureAdmin = (req, res, next) => (req.isAuthenticated() && req.user.role === 'ADMIN') ? next() : res.status(403).json({ error: 'Forbidden' });

// --- Helpers mapping ---
const toDbStatus = (s) => ({
  'Dalam Pemeriksaan': 'DALAM_PEMERIKSAAN',
  'Disetujui': 'DISETUJUI',
  'Ditolak': 'DITOLAK'
}[s] || 'DALAM_PEMERIKSAAN');
const fromDbStatus = (s) => ({
  'DALAM_PEMERIKSAAN': 'Dalam Pemeriksaan',
  'DISETUJUI': 'Disetujui',
  'DITOLAK': 'Ditolak'
}[s] || 'Dalam Pemeriksaan');

const toSavType = (t) => ({ pokok: 'POKOK', wajib: 'WAJIB', sukarela: 'SUKARELA' }[t] || 'POKOK');
const fromSavType = (t) => ({ POKOK: 'pokok', WAJIB: 'wajib', SUKARELA: 'sukarela' }[t] || 'pokok');

// --- SSE (Notifikasi real-time) ---
const clients = new Map(); // userId -> res
function pushEvent(userId, type, payload) {
  const res = clients.get(userId);
  if (res) {
    res.write(`event: ${type}\n`);
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}
app.get('/api/events', ensureAuth, (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  clients.set(req.user.id, res);
  req.on('close', () => clients.delete(req.user.id));
});

// --- Me ---
app.get('/api/me', ensureAuth, (req, res) => {
  res.json({ id: req.user.id, email: req.user.email, name: req.user.name, role: req.user.role, memberCode: req.user.memberCode });
});

// --- KPI ---
app.get('/api/kpi/mine', ensureAuth, async (req, res) => {
  const [loans, saves] = await Promise.all([
    prisma.loan.count({ where: { userId: req.user.id } }),
    prisma.saving.count({ where: { userId: req.user.id } })
  ]);
  const approved = await prisma.loan.count({ where: { userId: req.user.id, status: 'DISETUJUI' } });
  res.json({ loans, saves, approved });
});
app.get('/api/kpi/all', ensureAdmin, async (req, res) => {
  const [loans, saves, approved] = await Promise.all([
    prisma.loan.count(),
    prisma.saving.count(),
    prisma.loan.count({ where: { status: 'DISETUJUI' } })
  ]);
  res.json({ loans, saves, approved });
});

// --- Loans ---
app.post('/api/loans', ensureAuth, async (req, res) => {
  const {
    memberId, fullName, ktp, phone, address,
    amount, tenor, purpose, desc,
    signName, signDate, signature
  } = req.body;
  if (!fullName || !ktp || !phone || !address || !amount || !tenor || !purpose) {
    return res.status(400).json({ error: 'Data tidak lengkap' });
  }
  const data = await prisma.loan.create({
    data: {
      userId: req.user.id,
      memberCode: memberId || null,
      fullName, ktp, phone, address,
      amount: Number(amount), tenor: Number(tenor), purpose, desc: desc || null,
      signName: signName || null,
      signDate: signDate ? new Date(signDate) : null,
      signature: signature || null,
      status: 'DALAM_PEMERIKSAAN'
    }
  });
  res.json({ id: data.id, createdAt: data.createdAt });
});

app.get('/api/loans/mine', ensureAuth, async (req, res) => {
  const rows = await prisma.loan.findMany({ where: { userId: req.user.id }, orderBy: { id: 'desc' } });
  res.json(rows.map(r => ({
    id: r.id,
    createdAt: r.createdAt,
    memberId: r.memberCode,
    fullName: r.fullName,
    amount: r.amount,
    tenor: r.tenor,
    purpose: r.purpose,
    desc: r.desc,
    status: fromDbStatus(r.status)
  })));
});

app.get('/api/loans', ensureAdmin, async (req, res) => {
  const rows = await prisma.loan.findMany({ orderBy: { id: 'desc' } });
  res.json(rows.map(r => ({
    id: r.id,
    createdAt: r.createdAt,
    userId: r.userId,
    memberId: r.memberCode,
    fullName: r.fullName,
    amount: r.amount,
    tenor: r.tenor,
    purpose: r.purpose,
    desc: r.desc,
    status: fromDbStatus(r.status)
  })));
});

app.get('/api/loans/:id', ensureAuth, async (req, res) => {
  const id = Number(req.
