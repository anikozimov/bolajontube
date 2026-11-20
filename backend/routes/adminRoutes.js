import express from 'express';
import { DB_PROVIDER, supabase } from '../config/db.js';
import { MongoUser, MongoVideo, MongoReport } from '../models/mongoModels.js';
import { requireAuth, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.use(requireAuth, requireAdmin);

// 1. FOYDALANUVCHINI CREATOR QILISH YOKI FOYDALANUVCHIGA TUSHIRISH (Faqat Admin uchun)
router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['Foydalanuvchi', 'Creator'].includes(role)) {
      return res.status(400).json({ error: 'Faqat Foydalanuvchi yoki Creator roliga o\'zgartirish mumkin!' });
    }

    if (DB_PROVIDER === 'mongodb') {
      const updated = await MongoUser.findByIdAndUpdate(
        req.params.id,
        { role, creator_requested: false },
        { new: true }
      );
      return res.json(updated);
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({ role, creator_requested: false })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 2. FOYDALANUVCHINI BLOKLASH / FAOLLASHTIRISH
router.patch('/users/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!['active', 'blocked'].includes(status)) {
      return res.status(400).json({ error: 'Noto\'g\'ri status!' });
    }

    if (DB_PROVIDER === 'mongodb') {
      const updated = await MongoUser.findByIdAndUpdate(req.params.id, { status }, { new: true });
      return res.json(updated);
    }

    const { data: updated, error } = await supabase
      .from('users')
      .update({ status })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 3. VIDEONI TASDIQLASH YOKI RAD ETISH
router.patch('/videos/:id/moderate', async (req, res) => {
  try {
    const { status } = req.body; // 'approved' | 'rejected'
    if (DB_PROVIDER === 'mongodb') {
      if (status === 'rejected') {
        await MongoVideo.findByIdAndDelete(req.params.id);
        return res.json({ message: 'Video rad etildi va o\'chirildi' });
      }
      const updated = await MongoVideo.findByIdAndUpdate(req.params.id, { status: 'approved' }, { new: true });
      return res.json(updated);
    }

    if (status === 'rejected') {
      await supabase.from('videos').delete().eq('id', req.params.id);
      return res.json({ message: 'Video rad etildi va o\'chirildi' });
    }

    const { data: updated, error } = await supabase
      .from('videos')
      .update({ status: 'approved' })
      .eq('id', req.params.id)
      .select('*')
      .single();

    if (error) throw error;
    return res.json(updated);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 4. IZOHNI O'CHIRISH (Admin moderatsiyasi)
router.delete('/videos/:videoId/comments/:commentId', async (req, res) => {
  try {
    if (DB_PROVIDER === 'mongodb') {
      const video = await MongoVideo.findById(req.params.videoId);
      if (!video) return res.status(404).json({ error: 'Video topilmadi' });
      video.comments = video.comments.filter(c => c.id !== req.params.commentId);
      await video.save();
      return res.json({ message: 'Izoh o\'chirildi' });
    }

    const { error } = await supabase
      .from('comments')
      .delete()
      .eq('id', req.params.commentId);

    if (error) throw error;
    return res.json({ message: 'Izoh o\'chirildi' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// 5. SHIKOYATLARNI KO'RISH VA YOPISH
router.get('/reports', async (req, res) => {
  try {
    if (DB_PROVIDER === 'mongodb') {
      const reports = await MongoReport.find().sort({ created_at: -1 });
      return res.json(reports);
    }
    const { data, error } = await supabase.from('reports').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
