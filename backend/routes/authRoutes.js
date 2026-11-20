import express from 'express';
import bcrypt from 'bcryptjs';
import { DB_PROVIDER, supabase } from '../config/db.js';
import { MongoUser } from '../models/mongoModels.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = express.Router();

// 1. RO'YXATDAN O'TISH — Hamma qat'iy oddiy "Foydalanuvchi" sifatida ro'yxatdan o'tadi
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, ageGroup = 'all', avatar = '🦊' } = req.body;
    if (!name || !email || !password || password.length < 4) {
      return res.status(400).json({ error: 'Ism, email va kamida 4 belgili parol kiritilishi shart!' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const password_hash = await bcrypt.hash(password, 10);

    if (DB_PROVIDER === 'mongodb') {
      const exists = await MongoUser.findOne({ email: cleanEmail });
      if (exists) {
        return res.status(409).json({ error: 'Bu elektron pochta allaqachon ro\'yxatdan o\'tgan!' });
      }
      const created = await MongoUser.create({
        name: name.trim(),
        email: cleanEmail,
        password_hash,
        role: 'Foydalanuvchi', // Qat'iy oddiy foydalanuvchi
        status: 'active',
        age_group: ageGroup,
        avatar
      });
      const token = signToken(created);
      return res.status(201).json({
        token,
        user: {
          id: created._id,
          name: created.name,
          email: created.email,
          role: created.role,
          status: created.status,
          ageGroup: created.age_group,
          avatar: created.avatar,
          creatorRequested: created.creator_requested,
          dailyLimitMins: created.daily_limit_mins
        }
      });
    }

    // Supabase
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (existing) {
      return res.status(409).json({ error: 'Bu elektron pochta allaqachon ro\'yxatdan o\'tgan!' });
    }

    const { data: created, error } = await supabase
      .from('users')
      .insert([{
        name: name.trim(),
        email: cleanEmail,
        password_hash,
        role: 'Foydalanuvchi', // Qat'iy oddiy foydalanuvchi
        status: 'active',
        age_group: ageGroup,
        avatar
      }])
      .select('*')
      .single();

    if (error) throw error;

    await supabase.from('user_activity').insert([{ user_id: created.id }]);

    const token = signToken(created);
    return res.status(201).json({
      token,
      user: {
        id: created.id,
        name: created.name,
        email: created.email,
        role: created.role,
        status: created.status,
        ageGroup: created.age_group,
        avatar: created.avatar,
        creatorRequested: created.creator_requested,
        dailyLimitMins: created.daily_limit_mins
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. TIZIMGA KIRISH (Parol va Status tekshiruvi bilan)
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email va parolni kiriting!' });
    }

    const cleanEmail = email.trim().toLowerCase();

    if (DB_PROVIDER === 'mongodb') {
      const user = await MongoUser.findOne({ email: cleanEmail });
      if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi!' });
      if (user.status === 'blocked') return res.status(403).json({ error: 'Hisobingiz Admin tomonidan bloklangan!' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return res.status(401).json({ error: 'Parol noto\'g\'ri!' });

      const token = signToken(user);
      return res.json({
        token,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
          ageGroup: user.age_group,
          avatar: user.avatar,
          creatorRequested: user.creator_requested,
          dailyLimitMins: user.daily_limit_mins
        }
      });
    }

    // Supabase
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();

    if (error) throw error;
    if (!user) return res.status(404).json({ error: 'Foydalanuvchi topilmadi!' });
    if (user.status === 'blocked') return res.status(403).json({ error: 'Hisobingiz Admin tomonidan bloklangan!' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Parol noto\'g\'ri!' });

    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        ageGroup: user.age_group,
        avatar: user.avatar,
        creatorRequested: user.creator_requested,
        dailyLimitMins: user.daily_limit_mins
      }
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. PROFILNI OLISH VA TAHRIRLASH (Ism, Avatar, Yosh guruhi, Ota-ona PIN kodi va Vaqt limiti)
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, ageGroup, avatar, parentalPin, dailyLimitMins } = req.body;

    if (DB_PROVIDER === 'mongodb') {
      const updated = await MongoUser.findByIdAndUpdate(
        req.user.id,
        {
          ...(name && { name: name.trim() }),
          ...(ageGroup && { age_group: ageGroup }),
          ...(avatar && { avatar }),
          ...(parentalPin && { parental_pin: parentalPin }),
          ...(dailyLimitMins !== undefined && { daily_limit_mins: Number(dailyLimitMins) })
        },
        { new: true }
      );
      return res.json({ message: 'Profil yangilandi', user: updated });
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({
        ...(name && { name: name.trim() }),
        ...(ageGroup && { age_group: ageGroup }),
        ...(avatar && { avatar }),
        ...(parentalPin && { parental_pin: parentalPin }),
        ...(dailyLimitMins !== undefined && { daily_limit_mins: Number(dailyLimitMins) })
      })
      .eq('id', req.user.id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json({ message: 'Profil yangilandi', user: updated });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. CREATOR BO'LISH UCHUN SO'ROV YUBORISH (Faqat Admin tasdiqlaydi)
router.post('/request-creator', requireAuth, async (req, res) => {
  try {
    if (DB_PROVIDER === 'mongodb') {
      await MongoUser.findByIdAndUpdate(req.user.id, { creator_requested: true });
      return res.json({ message: 'Creator bo\'lish so\'rovi Adminga yuborildi!' });
    }

    const { error } = await supabase
      .from('users')
      .update({ creator_requested: true })
      .eq('id', req.user.id);

    if (error) throw error;
    return res.json({ message: 'Creator bo\'lish so\'rovi Adminga yuborildi!' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
