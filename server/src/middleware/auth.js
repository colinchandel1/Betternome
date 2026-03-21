const { expressjwt: jwt } = require('express-jwt');
const jwksRsa = require('jwks-rsa');

/**
 * Middleware that validates Auth0-issued JWTs.
 * Attaches the decoded payload to req.auth.
 */
const checkJwt = jwt({
  secret: jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: `https://${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`,
  }),
  audience: process.env.AUTH0_AUDIENCE,
  issuer: `https://${process.env.AUTH0_DOMAIN}/`,
  algorithms: ['RS256'],
});

/**
 * Middleware that ensures the authenticated user has a specific role.
 * Must be used AFTER checkJwt and requireUser.
 */
function requireRole(role) {
  return (req, res, next) => {
    if (!req.dbUser) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (req.dbUser.role !== role) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
}

module.exports = { checkJwt, requireRole };
