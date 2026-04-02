const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET;

function getCookieToken(cookieHeader) {
  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(';');

  for (const cookie of cookies) {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name === 'token') {
      return decodeURIComponent(valueParts.join('='));
    }
  }

  return null;
}

module.exports = function (req, res, next) {
  const token = req.header('x-auth-token') || getCookieToken(req.headers.cookie);
  if (!token) {
    req.user = null;
    return next();
  }

  if (!JWT_SECRET) {
    return res.status(500).json({ error: 'Server authentication is not configured' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Token is not valid' });
  }
};
