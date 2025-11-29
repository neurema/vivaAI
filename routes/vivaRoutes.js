const express = require('express');
const router = express.Router();
const vivaController = require('../controllers/vivaController');

router.post('/start', vivaController.startViva);
router.post('/answer', vivaController.answerQuestion);
router.post('/analysis', vivaController.analyzeViva);

module.exports = router;
