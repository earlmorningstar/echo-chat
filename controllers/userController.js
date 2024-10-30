const userModel = require('../models/userModel');

const createUser = async (req, res) => {
    const { email, password } = req.body;
    
    // Validate input (you can add more checks)
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await userModel.createUser(req.db, { email, password }); // Assuming `req.db` is available
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error });
    }
};

module.exports = { createUser };
