const express = require('express');
const router = express.Router();
const vivaController = require('../controllers/vivaController');

router.post('/start', vivaController.startViva);
router.post('/answer', vivaController.answerQuestion);
router.post('/analysis', vivaController.analyzeViva);

// Token stats endpoints (for testing/monitoring)
router.get('/stats', vivaController.getStats);
router.post('/stats/reset', vivaController.resetStats);

module.exports = router;
