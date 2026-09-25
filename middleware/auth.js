// middleware/auth.js

function requireAuth(req, res, next) {
  if (req.session && req.session.user) return next();
  return res.redirect('/login');
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect('/login');
    if (roles.includes(req.session.user.role)) return next();
    return res.status(403).render('errors/403', { layout: false, title: 'Akses Ditolak' });
  };
}

// Membuat variabel "currentUser" dan helper "flash" tersedia di semua view
function locals(req, res, next) {
  res.locals.currentUser = (req.session && req.session.user) || null;
  res.locals.flashMsg = req.session.flash || null;
  req.session.flash = null;
  next();
}

function setFlash(req, type, message) {
  req.session.flash = { type, message };
}

module.exports = { requireAuth, requireRole, locals, setFlash };
