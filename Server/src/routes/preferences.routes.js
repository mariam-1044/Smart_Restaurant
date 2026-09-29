const express = require('express');
const router = express.Router();
const { protect } = require('../middlewares/auth.middleware');
const preferencesController = require('../interfaces/controllers/preferences.controller');

router.use(protect);
router.get('/schema', preferencesController.schema);
router.get('/me', preferencesController.getMine);
router.put('/me', preferencesController.upsert);

module.exports = router;
