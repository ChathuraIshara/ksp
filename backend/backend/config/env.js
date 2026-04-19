require('dotenv').config();

const nodeEnv = process.env.NODE_ENV || 'development';

// In production, critical secrets must be explicitly set — no silent fallbacks.
const requireSecret = (key, fallback) => {
  const value = process.env[key];
  if (!value) {
    if (nodeEnv === 'production') {
      throw new Error(`[env] Missing required environment variable: ${key}`);
    }
    return fallback;
  }
  return value;
};

module.exports = {
  port: process.env.PORT || 5000,
  nodeEnv,

  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    name: process.env.DB_NAME || 'pradeshiya_sabha_1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
  },

  jwt: {
    secret: requireSecret('JWT_SECRET', 'dev_jwt_secret_change_in_production'),
  },

  email: {
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@pradeshiyasabha.lk',
  },

  sms: {
    apiKey:   process.env.SMS_API_KEY,
    apiUrl:   process.env.SMS_API_URL,
    sender:   process.env.SMS_SENDER  || 'PSABHA',
    userId:   process.env.SMS_USER_ID,   // required for Notify.lk provider
    clientId: process.env.SMS_CLIENT_ID, // required for Dialog provider
  },

  payhere: {
    merchantId: process.env.PAYHERE_MERCHANT_ID,
    secret: process.env.PAYHERE_SECRET,
    url: process.env.PAYHERE_URL,
  },

  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,  // Google OAuth 2.0 client ID
  },
  signature: {
    privateKeyPath: process.env.SIGNATURE_PRIVATE_KEY_PATH || './keys/private.pem',
    publicKeyPath: process.env.SIGNATURE_PUBLIC_KEY_PATH || './keys/public.pem',
  },

  upload: {
    maxFileSizeMB: parseInt(process.env.MAX_FILE_SIZE_MB) || 10,
    path: process.env.UPLOAD_PATH || './uploads',
  },
};
