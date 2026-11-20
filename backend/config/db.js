import { createClient } from '@supabase/supabase-js';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

export const DB_PROVIDER = (process.env.DB_PROVIDER || 'supabase').toLowerCase();

export let supabase = null;

export async function connectDB() {
  if (DB_PROVIDER === 'mongodb') {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI .env faylida ko\'rsatilmagan!');
    }
    await mongoose.connect(uri);
    console.log('✅ MongoDB Atlas ma\'lumotlar bazasiga muvaffaqiyatli ulandi');
    return { provider: 'mongodb', client: mongoose.connection };
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL va SUPABASE_SERVICE_ROLE_KEY .env faylida ko\'rsatilmagan!');
  }
  supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false }
  });
  console.log('✅ Supabase PostgreSQL ma\'lumotlar bazasiga muvaffaqiyatli ulandi');
  return { provider: 'supabase', client: supabase };
}
