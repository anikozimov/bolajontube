/**
 * BolajonTube — Kod orqali Bosh Adminni Supabase yoki MongoDB bazasiga kiritish skripti
 * Ishga tushirish: npm run seed:admin
 */
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { connectDB, DB_PROVIDER, supabase } from '../config/db.js';
import { MongoUser } from '../models/mongoModels.js';

dotenv.config();

async function seedAdmin() {
  try {
    await connectDB();

    const name = process.env.ADMIN_NAME || 'Bosh Moderator';
    const email = (process.env.ADMIN_EMAIL || 'admin@bolajontube.uz').toLowerCase();
    const rawPassword = process.env.ADMIN_PASSWORD || 'AdminBolajon2026!';
    const password_hash = await bcrypt.hash(rawPassword, 10);

    if (DB_PROVIDER === 'mongodb') {
      const existing = await MongoUser.findOne({ email });
      if (existing) {
        existing.role = 'Admin';
        existing.password_hash = password_hash;
        existing.status = 'active';
        await existing.save();
        console.log(`🛡️ [MongoDB] Mavjud hisob Admin sifatida yangilandi: ${email}`);
      } else {
        await MongoUser.create({
          name,
          email,
          password_hash,
          role: 'Admin',
          status: 'active',
          age_group: 'all',
          avatar: '🛡️'
        });
        console.log(`🛡️ [MongoDB] Yangi Admin muvaffaqiyatli yaratildi: ${email}`);
      }
      process.exit(0);
    }

    // Supabase orqali kiritish
    const { data: existing } = await supabase
      .from('users')
      .select('id, email')
      .eq('email', email)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from('users')
        .update({ role: 'Admin', password_hash, status: 'active', avatar: '🛡️' })
        .eq('id', existing.id);
      if (error) throw error;
      console.log(`🛡️ [Supabase] Mavjud hisob Admin sifatida yangilandi: ${email}`);
    } else {
      const { error } = await supabase
        .from('users')
        .insert([{
          name,
          email,
          password_hash,
          role: 'Admin',
          status: 'active',
          age_group: 'all',
          avatar: '🛡️'
        }]);
      if (error) throw error;
      console.log(`🛡️ [Supabase] Yangi Admin muvaffaqiyatli kiritildi: ${email}`);
    }

    process.exit(0);
  } catch (err) {
    console.error('❌ Admin kiritishda xatolik:', err.message);
    process.exit(1);
  }
}

seedAdmin();
