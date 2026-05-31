import crypto from 'crypto';
import ErrorResponse from './errorResponse.js';

const REQUIRED_NOTIFY_FIELDS = Object.freeze([
  'merchant_id', 'order_id', 'payhere_amount',
  'payhere_currency', 'status_code', 'md5sig',
]);

const ALLOWED_CURRENCIES = Object.freeze(['LKR', 'USD', 'EUR', 'GBP']);

const hashSecret = (secret) =>
  crypto.createHash('md5').update(secret).digest('hex').toUpperCase();

const assertEnv = () => {
  if (!process.env.PAYHERE_MERCHANT_SECRET) {
    throw new ErrorResponse('PayHere merchant secret is not configured', 500);
  }
};

export const generatePayHereHash = (merchantId, orderId, amount, currency) => {
  assertEnv();

  if (!merchantId || !orderId) {
    throw new ErrorResponse('merchantId and orderId are required', 400);
  }

  const parsedAmount = parseFloat(amount);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new ErrorResponse('Amount must be a positive number', 400);
  }

  if (!ALLOWED_CURRENCIES.includes(currency)) {
    throw new ErrorResponse(`Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`, 400);
  }

  const formattedAmount = parsedAmount.toFixed(2);
  const hashed          = hashSecret(process.env.PAYHERE_MERCHANT_SECRET);
  const raw             = `${merchantId}${orderId}${formattedAmount}${currency}${hashed}`;

  return crypto.createHash('md5').update(raw).digest('hex').toUpperCase();
};

export const verifyPayHereNotification = (data) => {
  assertEnv();

  if (!data || typeof data !== 'object') return false;

  for (const field of REQUIRED_NOTIFY_FIELDS) {
    if (!data[field] && data[field] !== 0) return false;
  }

  if (typeof data.md5sig !== 'string' || !/^[A-F0-9]{32}$/.test(data.md5sig)) return false;

  const hashed = hashSecret(process.env.PAYHERE_MERCHANT_SECRET);
  const raw    = `${data.merchant_id}${data.order_id}${data.payhere_amount}${data.payhere_currency}${data.status_code}${hashed}`;
  const local  = crypto.createHash('md5').update(raw).digest('hex').toUpperCase();

  return crypto.timingSafeEqual(Buffer.from(local), Buffer.from(data.md5sig.toUpperCase()));
};