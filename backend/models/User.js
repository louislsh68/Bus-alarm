const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  googleId: {
    type: String,
    required: true
  },
  displayName: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true
  },
  avatar: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  schedules: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Schedule'
  }]
});

module.exports = mongoose.model('User', userSchema);