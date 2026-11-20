import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password_hash: { type: String, required: true },
  role: {
    type: String,
    enum: ['Foydalanuvchi', 'Creator', 'Admin'],
    default: 'Foydalanuvchi'
  },
  status: {
    type: String,
    enum: ['active', 'blocked'],
    default: 'active'
  },
  age_group: { type: String, default: 'all' },
  avatar: { type: String, default: '🦊' },
  creator_requested: { type: Boolean, default: false },
  parental_pin: { type: String, default: '1234' },
  daily_limit_mins: { type: Number, default: 45 },
  watched_minutes_today: { type: Number, default: 0 },
  liked_video_ids: [{ type: String }],
  saved_video_ids: [{ type: String }],
  subscribed_channels: [{ type: String }],
  history_video_ids: [{ type: String }]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const CommentSubSchema = new mongoose.Schema({
  id: { type: String, required: true },
  user_id: { type: String },
  author: { type: String, required: true },
  text: { type: String, required: true },
  created_at: { type: Date, default: Date.now }
});

const VideoSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  channel: { type: String, required: true },
  channel_id: { type: String, required: true },
  category: { type: String, required: true },
  age_group: { type: String, default: '3-5' },
  duration: { type: String, default: '05:00' },
  views: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  thumb_url: { type: String, required: true },
  video_url: { type: String, default: '' },
  description: { type: String, required: true },
  comments: [CommentSubSchema]
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

const ReportSchema = new mongoose.Schema({
  video_id: { type: String, required: true },
  video_title: { type: String, required: true },
  reporter_name: { type: String, required: true },
  reason: { type: String, required: true },
  status: { type: String, enum: ['open', 'resolved'], default: 'open' }
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

export const MongoUser = mongoose.models.User || mongoose.model('User', UserSchema);
export const MongoVideo = mongoose.models.Video || mongoose.model('Video', VideoSchema);
export const MongoReport = mongoose.models.Report || mongoose.model('Report', ReportSchema);
