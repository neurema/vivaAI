const express = require('express');
const cors = require('cors');
require('dotenv').config();

const vivaRoutes = require('./routes/vivaRoutes');
const vivaController = require('./controllers/vivaController');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/viva', vivaRoutes);
app.post('/api/summarize', vivaController.summarizeTeachSession);

const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

app.post('/api/transcribe', upload.single('audio'), vivaController.transcribe);

// Health check
app.get('/', (req, res) => {
  res.send('Viva Chat Server is running');
});

// Start server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
