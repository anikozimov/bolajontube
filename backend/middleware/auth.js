import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bolajontube_super_secret_jwt_key_2026';

export function signToken(user) {
  return jwt.sign(
    { id: user.id || user._id, email: user.email, role: user.role, name: user.name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Avtorizatsiya talab qilinadi (Token topilmadi)' });
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Yaroqsiz yoki muddati o\'tgan token' });
  }
}

export function requireCreatorOrAdmin(req, res, next) {
  if (!req.user || (req.user.role !== 'Creator' && req.user.role !== 'Admin')) {
    return res.status(403).json({ error: 'Faqat Creator yoki Admin video yuklashi mumkin!' });
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'Admin') {
    return res.status(403).json({ error: 'Ushbu amal faqat Admin uchun ruxsat etilgan!' });
  }
  next();
}
