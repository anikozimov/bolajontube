import express from 'express';
import multer from 'multer';
import path from 'path';
import { DB_PROVIDER, supabase } from '../config/db.js';
import { MongoVideo, MongoReport } from '../models/mongoModels.js';
import { requireAuth, requireCreatorOrAdmin } from '../middleware/auth.js';

const router = express.Router();

const BAD_WORDS = ['yomon', 'ahmoq', 'jinni', 'urush', 'spam', 'haqorat'];

// Multer storage for video & thumbnail uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'backend/uploads/'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 100 * 1024 * 1024 } });

// 1. BARCHA TASDIQLANGAN VIDEOLARNI OLISH (Kategoriya, Yosh va Qidiruv filtri bilan)
router.get('/', async (req, res) => {
  try {
    const { category, ageGroup, search } = req.query;

    if (DB_PROVIDER === 'mongodb') {
      const filter = { status: 'approved' };
      if (category && category !== 'Barchasi') filter.category = category;
      if (ageGroup && ageGroup !== 'all') filter.age_group = ageGroup;
      if (search) filter.title = { $regex: search, $options: 'i' };

      const videos = await MongoVideo.find(filter).sort({ created_at: -1 });
      return res.json(videos);
    }

    let query = supabase
      .from('videos')
      .select('*, comments(*)')
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (category && category !== 'Barchasi') query = query.eq('category', category);
    if (ageGroup && ageGroup !== 'all') query = query.eq('age_group', ageGroup);
    if (search) query = query.ilike('title', `%${search}%`);

    const { data, error } = await query;
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. YANGI VIDEO YUKLASH (Faqat Creator va Admin uchun; Creator videosi "pending" bo'ladi)
router.post(
  '/',
  requireAuth,
  requireCreatorOrAdmin,
  upload.fields([{ name: 'videoFile', maxCount: 1 }, { name: 'thumbFile', maxCount: 1 }]),
  async (req, res) => {
    try {
      const { title, category, ageGroup = '3-5', duration = '05:00', description, thumbUrl, videoUrl } = req.body;
      if (!title || !category || !description) {
        return res.status(400).json({ error: 'Sarlavha, kategoriya va tavsif kiritilishi shart!' });
      }

      const uploadedVideo = req.files?.videoFile?.[0] ? `/uploads/${req.files.videoFile[0].filename}` : (videoUrl || '');
      const uploadedThumb = req.files?.thumbFile?.[0] ? `/uploads/${req.files.thumbFile[0].filename}` : (thumbUrl || '');

      const status = req.user.role === 'Admin' ? 'approved' : 'pending';

      if (DB_PROVIDER === 'mongodb') {
        const created = await MongoVideo.create({
          title,
          channel: req.user.name,
          channel_id: req.user.id,
          category,
          age_group: ageGroup,
          duration,
          status,
          thumb_url: uploadedThumb,
          video_url: uploadedVideo,
          description
        });
        return res.status(201).json(created);
      }

      const { data: created, error } = await supabase
        .from('videos')
        .insert([{
          title,
          channel: req.user.name,
          channel_id: req.user.id,
          category,
          age_group: ageGroup,
          duration,
          status,
          thumb_url: uploadedThumb,
          video_url: uploadedVideo,
          description
        }])
        .select('*')
        .single();

      if (error) throw error;
      return res.status(201).json(created);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
);

// 3. XAVFSIZ IZOH QO'SHISH (Avtomatik bolalar filtri bilan)
router.post('/:id/comments', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Izoh matni bo\'sh bo\'lmasligi kerak!' });
    }

    const lower = text.toLowerCase();
    if (BAD_WORDS.some(w => lower.includes(w))) {
      return res.status(400).json({ error: 'Bolalar xavfsizligi filtri: Iltimos, odobli va ijobiy izoh yozing!' });
    }

    if (DB_PROVIDER === 'mongodb') {
      const video = await MongoVideo.findById(req.params.id);
      if (!video) return res.status(404).json({ error: 'Video topilmadi' });
      const comment = {
        id: 'cm_' + Date.now(),
        user_id: req.user.id,
        author: req.user.name,
        text: text.trim()
      };
      video.comments.unshift(comment);
      await video.save();
      return res.status(201).json(comment);
    }

    const { data: comment, error } = await supabase
      .from('comments')
      .insert([{
        video_id: req.params.id,
        user_id: req.user.id,
        author: req.user.name,
        text: text.trim()
      }])
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json(comment);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. VIDEOGA SHIKOYAT YUBORISH (Report)
router.post('/:id/report', requireAuth, async (req, res) => {
  try {
    const { reason, videoTitle = 'Video' } = req.body;
    if (!reason || !reason.trim()) {
      return res.status(400).json({ error: 'Shikoyat sababini kiriting!' });
    }

    if (DB_PROVIDER === 'mongodb') {
      const report = await MongoReport.create({
        video_id: req.params.id,
        video_title: videoTitle,
        reporter_name: req.user.name,
        reason: reason.trim()
      });
      return res.status(201).json(report);
    }

    const { data: report, error } = await supabase
      .from('reports')
      .insert([{
        video_id: req.params.id,
        reporter_name: req.user.name,
        reason: reason.trim()
      }])
      .select('*')
      .single();

    if (error) throw error;
    return res.status(201).json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
