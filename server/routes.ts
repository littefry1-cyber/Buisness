// server/routes.ts

import express from 'express';

const router = express.Router();

// Endpoint to get a random event
router.get('/api/random-event', (req, res) => {
    const randomEvent = {
        id: Math.floor(Math.random() * 1000),
        name: 'Random Event',
        description: 'A randomly generated event.'
    };
    res.json(randomEvent);
});

// Endpoint to process an event
router.post('/api/process-event', (req, res) => {
    const { event } = req.body;
    if (!event) {
        return res.status(400).json({ error: 'Event data is required.' });
    }
    // Process the event (logic can be added here)
    res.json({ message: 'Event processed successfully', event });
});

export default router;