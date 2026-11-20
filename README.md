# BolajonTube — Full-Stack Bolalar Video Platformasi

**Ranglar:** Olovrang (`#FF6B00`), Och olovrang / Peach (`#FFF3EB`, `#FFE0C7`) va Oq (`#FFFFFF`)  
**Backend:** Node.js `24.21.0` + Express.js  
**Ma'lumotlar bazasi:** Supabase (PostgreSQL) yoki MongoDB Atlas (`DB_PROVIDER` orqali tanlanadi)

## Toifalar va Qoidalar
1. **Foydalanuvchi:** Ro'yxatdan o'tgan har bir yangi inson avtomatik ravishda oddiy `Foydalanuvchi` toifasiga tushadi.
2. **Creator:** Faqat `Admin` tomonidan Admin Panel orqali tayinlanadi (foydalanuvchi o'z profilidan so'rov yuborishi mumkin).
3. **Admin:** Supabase/MongoDB bazasiga maxsus `npm run seed:admin` kodi orqali kiritiladi.

## Ishga tushirish (Local / Render / Koyeb)
1. Paketlarni o'rnating:
   ```bash
   npm install
   ```
2. `.env.example` faylini `.env` deb nusxalang va Supabase yoki MongoDB kalitlarini kiriting:
   ```bash
   cp .env.example .env
   ```
3. Agar Supabase ishlatsangiz, `backend/config/supabase_schema.sql` ichidagi SQL kodni Supabase SQL Editor'da ishga tushiring.
4. Bosh Adminni kod orqali bazaga kiriting:
   ```bash
   npm run seed:admin
   ```
5. Serverni ishga tushiring:
   ```bash
   npm start
   ```
