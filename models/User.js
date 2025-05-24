const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  full_name: {
    type: String,
    required: true,
    trim: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  phone_number: {
    type: String,
    trim: true
  },
  date_of_birth: {
    type: Date,
    default: null
  },
  gender: {
    value: {
      type: String,
      enum: ['Male', 'Female', 'Other', null]
    },
    custom: {
      type: String,
      default: null
    }
  },
  pronoun: {
    value: {
      type: String,
      enum: ['He/Him', 'She/Her', 'They/Them', 'Other', null]
    },
    custom: {
      type: String,
      default: null
    }
  },
  bio: {
    type: String,
    trim: true
  },
  profile_picture: {
    type: String,
    default: 'assets/images/user/blank-avatar.png'
  },
  resume: {
    type: String,
    default: ''
  },
  password_hash: {
    type: String,
    required: true,
    minlength: 6
  },
  year_of_study: {
    value: {
      type: String,
      enum: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate', 'Post Graduate', null]
    },
    custom: {
      type: String,
      default: null
    }
  },
  major_category: {
    value: {
      type: String,
      enum: ['Engineering', 'Business', 'Arts', 'Science', 'Other', null]
    },
    custom: {
      type: String,
      default: null
    }
  },
  major_sub_category: {
    value: {
      type: String,
      enum: [
        'AERO', 'MECH', 'SOFTWARE', 'ENVIRONMENTAL', 'ARCHITECTURAL', 'CIVIL', 'DESIGN', 'CHEMICAL', 'BIO_MED', 'OTHER_ENGINEERING',
        'COMPUTER_SCIENCE', 'HEALTH_SCIENCE', 'DATA_SCIENCE', 'OTHER_SCIENCE',
        'FINANCE', 'MARKETING', 'MANAGEMENT', 'ACCOUNTING', 'ECONOMICS', 'OTHER_BUSINESS',
        'FINE_ARTS', 'DESIGN', 'MUSIC', 'THEATER', 'OTHER_ARTS',
        'CUSTOM_MAJOR', 'CUSTOM_ENGINEERING', 'CUSTOM_SCIENCE', 'CUSTOM_BUSINESS', 'CUSTOM_ARTS', 'CUSTOM_OTHER',
        null
      ]
    },
    custom: {
      type: String,
      default: null
    }
  },
  major_type: {
    type: String,
    enum: ['technical', 'non-technical']
  },
  institution: {
    value: {
      type: String
    },
    custom: {
      type: String,
      default: null
    }
  },
  platforms: [{
    type: String,
    trim: true
  }],
  urls: [{
    type: String,
    trim: true
  }],
  technical_skills: [{
    type: String,
    trim: true
  }],
  soft_skills: [{
    type: String,
    trim: true
  }],
  my_interests: [{
    type: String,
    trim: true
  }],
  interests_looking_in_others: [{
    type: String,
    trim: true
  }],
  co_founders_count: {
    type: Number,
    default: 0
  },
  zip: {
    value: {
      type: String
    },
    custom: {
      type: String,
      default: null
    }
  },
  state: {
    value: {
      type: String
    },
    custom: {
      type: String,
      default: null
    }
  },
  city: {
    value: {
      type: String
    },
    custom: {
      type: String,
      default: null
    }
  },
  address: {
    type: String,
    trim: true
  },
  user_since: {
    type: Date,
    default: Date.now
  },
  user_type: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user'
  },
  privateMode: {
    type: Boolean,
    default: false
  },
  verification_status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'inactive'
  },
  email_verified: {
    type: Boolean,
    default: false
  },
  verification_token: {
    type: String,
    default: null
  },
  otp: {
    code: {
      type: String,
      default: null
    },
    expires_at: {
      type: Date,
      default: null
    }
  },
  connections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  pendingConnections: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  resetPasswordToken: {
    type: String,
    default: null
  },
  resetPasswordExpires: {
    type: Date,
    default: null
  },
  sessionId: {
    type: String,
    default: null
  },
  preferences: {
    type: Object,
    default: {
      theme: 'light',
      rtl: false,
      boxed: false,
      container: false,
      captionShow: true,
      preset: 'preset-5',
      notifications: {
        email: true,
        inApp: true,
        push: false
      }
    }
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (this.isModified('password_hash')) {
    this.password_hash = await bcrypt.hash(this.password_hash, 8);
  }
  next();
});

// Method to compare password
userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password_hash);
};

const User = mongoose.model('User', userSchema);
module.exports = User; 