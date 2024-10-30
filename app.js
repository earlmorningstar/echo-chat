// app.js
const express = require('express');
const { connectToDatabase } = require('./config/database');
const userRoutes = require('./routes/userRoutes'); // Import user routes

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

connectToDatabase()
    .then((db) => {
        console.log("Database connected and ready to use.");

        // Set up routes
        app.use((req, res, next) => {
            req.db = db; // Make the db instance available to all routes
            next();
        });

        app.use('/api', userRoutes); // Use the user routes under '/api'

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Database connection error:", err);
        process.exit(1);
    });
