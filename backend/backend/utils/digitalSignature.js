const crypto = require('crypto');
const fs = require('fs');
const env = require('../config/env');

const sign = (data) => {
  try {
    const privateKey = fs.readFileSync(env.signature.privateKeyPath, 'utf8');
    const signer = crypto.createSign('SHA256');
    signer.update(JSON.stringify(data));
    return signer.sign(privateKey, 'base64');
  } catch (err) {
    // Fallback for dev without keys
    return crypto.createHmac('sha256', env.jwt.secret).update(JSON.stringify(data)).digest('base64');
  }
};

const verify = (data, signature) => {
  try {
    const publicKey = fs.readFileSync(env.signature.publicKeyPath, 'utf8');
    const verifier = crypto.createVerify('SHA256');
    verifier.update(JSON.stringify(data));
    return verifier.verify(publicKey, signature, 'base64');
  } catch (err) {
    const expected = crypto.createHmac('sha256', env.jwt.secret).update(JSON.stringify(data)).digest('base64');
    return expected === signature;
  }
};

module.exports = { sign, verify };
