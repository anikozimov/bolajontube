import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { connectDB, DB_PROVIDER } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import videoRoutes from './routes/videoRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true }));

// Statik fayllar (Frontend va Yuklangan videolar)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// Healthcheck (Render / Koyeb / UptimeRobot uchun)
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'BolajonTube API',
    nodeVersion: process.version,
    dbProvider: DB_PROVIDER,
    timestamp: new Date().toISOString()
  });
});

// API Marshrutlari
app.use('/api/auth', authRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/admin', adminRoutes);

// SPA Fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 BolajonTube Server (Node ${process.version}) http://localhost:${PORT} portida ishga tushdi`);
    });
  })
  .catch((err) => {
    console.warn(`⚠️ DB ulanish xatosi (${err.message}). Server lokal rejimda ishga tushmoqda...`);
    app.listen(PORT, () => {
      console.log(`🚀 BolajonTube Server http://localhost:${PORT} portida ishga tushdi`);
    });
  });
