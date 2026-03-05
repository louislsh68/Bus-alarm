const express = require('express');
const router = express.Router();
const passport = require('passport');

// Google Auth Routes
router.get('/google', 
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback', 
  passport.authenticate('google', { failureRedirect: '/login' }),
  (req, res) => {
    // Successful authentication
    // Redirect to frontend with user info or JWT token
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/dashboard`);
  }
);

// Logout route
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      console.error('Error during logout:', err);
    }
    res.redirect('/');
  });
});

// Get current user
router.get('/current_user', (req, res) => {
  res.send(req.user);
});

module.exports = router;