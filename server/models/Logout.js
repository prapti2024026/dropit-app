import mongoose from 'mongoose';

const logoutSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },

  username: { 
    type: String, 
    required: true 
  },

  email: { 
    type: String, 
    required: true 
  },

  logoutTime: { 
    type: Date, 
    default: Date.now 
  },

  deviceInfo: { 
    type: String 
  }
});

export default mongoose.model('Logout', logoutSchema);
