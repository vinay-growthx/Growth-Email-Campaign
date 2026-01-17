require('dotenv').config();
const mongoose = require('mongoose');
const UserRepository = require('./repository/UserRepository');

const userRepository = new UserRepository();

(async () => {
  try {
    const database = process.env.DATABASE;
    console.log('Connecting to database...');
    await mongoose.connect(database, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to database');
    
    const userData = {
      name: 'Vinay Prajapati',
      email: 'vinay.p@growthx.club',
      userPassword: 'vinay.p@growthx.club'
    };
    
    const existingUser = await userRepository.findOne({ email: userData.email });
    
    if (existingUser) {
      console.log('User already exists, updating...');
      await userRepository.updateOne({ email: userData.email }, { $set: userData });
      console.log('✓ User updated successfully');
      console.log('Email: vinay.p@growthx.club');
      console.log('Password: vinay.p@growthx.club');
    } else {
      console.log('Creating new user...');
      await userRepository.create(userData);
      console.log('✓ User created successfully');
      console.log('Email: vinay.p@growthx.club');
      console.log('Password: vinay.p@growthx.club');
    }
    
    await mongoose.connection.close();
    console.log('Connection closed');
  } catch (error) {
    console.error('Error:', error.message);
  }
  process.exit(0);
})();
