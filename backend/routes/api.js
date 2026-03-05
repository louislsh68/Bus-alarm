const express = require('express');
const router = express.Router();
const Schedule = require('../models/Schedule');
const { ensureAuthenticated } = require('../middleware/auth');
const { stopMap, destinationsMap } = require('../data/loader'); // <-- CORRECT: Use new loader structure
const TransportChecker = require('../services/transportChecker');

// --- API to Fetch Routes for a Company ---
router.get('/routes/:company', (req, res) => {
  const { company } = req.params;
  const companyRoutes = stopMap[company.toUpperCase()]; // Use stopMap as the source of truth for routes

  if (companyRoutes) {
    res.json(Object.keys(companyRoutes).sort());
  } else {
    res.status(404).json({ error: 'Company not found or no routes available.' });
  }
});

// --- API to Fetch Stops for a Route ---
router.get('/stops/:company/:route', (req, res) => {
  const { company, route } = req.params;
  const routeStops = stopMap[company.toUpperCase()]?.[route.toUpperCase()];

  console.log('Fetching stops for company: ' + company + ', route: ' + route);
  console.log('Resolved routeStops: ' + JSON.stringify(routeStops));

  if (routeStops) {
    res.json(Object.keys(routeStops).sort());
  } else {
    res.status(404).json({ error: 'Route not found or no stops available.' });
  }
});

// --- NEW: API to Fetch Destinations for a Route ---
router.get('/destinations/:company/:route', (req, res) => {
  const { company, route } = req.params;
  const routeDestinations = destinationsMap[company.toUpperCase()]?.[route.toUpperCase()];

  if (routeDestinations) {
    res.json(routeDestinations.sort());
  } else {
    res.status(404).json({ error: 'Route not found or no destinations available.' });
  }
});


// --- API to get ETA ---
router.get('/eta/:companyId/:routeNumber/:stopName', async (req, res) => {
  try {
    const { companyId, routeNumber, stopName } = req.params;
    
    const arrivalData = await TransportChecker.getBusArrival(companyId.toUpperCase(), routeNumber.toUpperCase(), stopName);

    if (arrivalData && arrivalData.data) {
      res.json(arrivalData.data);
    } else {
      res.status(404).json({ error: 'No arrival data found for the provided details.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// --- APIs for User Schedule Management (CRUD) ---

router.get('/schedules', ensureAuthenticated, async (req, res) => {
  try {
    const schedules = await Schedule.find({ userId: req.user.id, isActive: true });
    res.json(schedules);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/schedules', ensureAuthenticated, async (req, res) => {
  try {
    const newSchedule = new Schedule({ ...req.body, userId: req.user.id });
    const schedule = await newSchedule.save();
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/schedules/:id', ensureAuthenticated, async (req, res) => {
  try {
    const schedule = await Schedule.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(schedule);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/schedules/:id', ensureAuthenticated, async (req, res) => {
  try {
    await Schedule.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
