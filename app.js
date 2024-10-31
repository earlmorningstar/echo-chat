const express = require('express');
const cors = require('cors');
const { connectToDatabase } = require('./config/database'); 
const userRoutes = require('./routes/userRoutes'); 
require('dotenv').config(); 

const app = express();
app.use(cors({ origin: 'http://localhost:3001' }));
app.use(express.json()); 


connectToDatabase()
    .then((db) => {
        console.log("Database connected and ready to use.");

        
        app.use((req, res, next) => {
            req.db = db; 
            next();
        });

        
        app.use('/api', userRoutes); 

        const PORT = process.env.PORT || 3000;
        app.listen(PORT, () => {
            console.log(`Server is running on port ${PORT}`);
        });
    })
    .catch((err) => {
        console.error("Database connection error:", err);
        process.exit(1); 
    });

module.exports = app;
