import ErrorResponse from './errorResponse.js';

const IS_PROD = process.env.NODE_ENV === 'production';

const assertEnv = () => {
  const expireDays = Number(process.env.COOKIE_EXPIRE);
  if (!Number.isFinite(expireDays) || expireDays <= 0) {
    throw new ErrorResponse('COOKIE_EXPIRE environment variable is not configured', 500);
  }
  return expireDays;
};

const sendToken = (user, statusCode, res) => {
  const expireDays = assertEnv();
  const token      = user.getJwtToken();

  const options = {
    expires:  new Date(Date.now() + expireDays * 24 * 60 * 60 * 1_000),
    httpOnly: true,
    secure:   IS_PROD,
    sameSite: IS_PROD ? 'strict' : 'lax',
    path:     '/',
  };

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      user: {
        _id:           user._id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        avatar:        user.avatar,
        isVerified:    user.isVerified,
        loyaltyPoints: user.loyaltyPoints,
      },
    });
};

export default sendToken;