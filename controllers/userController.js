const userModel = require('../models/userModel');

const createUser = async (req, res) => {
    const { email, password } = req.body;
    
    
    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const user = await userModel.createUser(req.db, { email, password }); 
        res.status(201).json({ message: "User created successfully", user });
    } catch (error) {
        res.status(500).json({ message: 'Error creating user', error });
    }
};

module.exports = { createUser };
