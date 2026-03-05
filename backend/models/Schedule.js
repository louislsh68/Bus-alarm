const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  routeNumber: {
    type: String,
    required: true
  },
  stopName: {
    type: String,
    required: true
  },
  direction: {
    type: String,
    required: true
  },
  companyId: {
    type: String,
    required: true
  },
  scheduledTimes: [{
    dayOfWeek: Number, // 0 = Sunday, 1 = Monday, etc.
    hour: Number,
    minute: Number
  }],
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Schedule', scheduleSchema);