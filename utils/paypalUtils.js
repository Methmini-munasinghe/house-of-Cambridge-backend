import axios from 'axios';
import ErrorResponse from './errorResponse.js';

const ALLOWED_CURRENCIES = Object.freeze(['USD', 'EUR', 'GBP', 'CAD', 'AUD']);
const PAYPAL_ORDER_ID_RE = /^[A-Z0-9]{17}$/;
const TOKEN_EXPIRY_BUFFER_MS = 60_000;
const MAX_AMOUNT = 99_999.99;

const PAYPAL_BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

const assertEnv = () => {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    throw new ErrorResponse('PayPal credentials are not configured', 500);
  }
};

let _token       = null;
let _tokenExpiry = 0;

const getAccessToken = async () => {
  assertEnv();

  if (_token && Date.now() < _tokenExpiry) return _token;

  let res;
  try {
    res = await axios.post(
      `${PAYPAL_BASE}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: {
          username: process.env.PAYPAL_CLIENT_ID,
          password: process.env.PAYPAL_CLIENT_SECRET,
        },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10_000,
      },
    );
  } catch (err) {
    _token       = null;
    _tokenExpiry = 0;
    throw new ErrorResponse('Failed to authenticate with PayPal', 502);
  }

  const { access_token, expires_in } = res.data;

  if (!access_token || typeof expires_in !== 'number') {
    _token       = null;
    _tokenExpiry = 0;
    throw new ErrorResponse('Invalid token response from PayPal', 502);
  }

  _token       = access_token;
  _tokenExpiry = Date.now() + expires_in * 1_000 - TOKEN_EXPIRY_BUFFER_MS;

  return _token;
};

const paypalHeaders = (token) => ({
  Authorization:  `Bearer ${token}`,
  'Content-Type': 'application/json',
});

export const createPayPalOrder = async (total, currency = 'USD') => {
  if (!Number.isFinite(total) || total <= 0 || total > MAX_AMOUNT) {
    throw new ErrorResponse(`Amount must be a positive number up to ${MAX_AMOUNT}`, 400);
  }

  if (!ALLOWED_CURRENCIES.includes(currency)) {
    throw new ErrorResponse(`Currency must be one of: ${ALLOWED_CURRENCIES.join(', ')}`, 400);
  }

  const token      = await getAccessToken();
  const formattedTotal = total.toFixed(2);

  let res;
  try {
    res = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders`,
      {
        intent:         'CAPTURE',
        purchase_units: [{ amount: { currency_code: currency, value: formattedTotal } }],
      },
      { headers: paypalHeaders(token), timeout: 15_000 },
    );
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message ?? 'Failed to create PayPal order';
    throw new ErrorResponse(message, status ?? 502);
  }

  if (!res.data?.id) {
    throw new ErrorResponse('PayPal did not return an order ID', 502);
  }

  return res.data;
};

export const capturePayPalOrder = async (paypalOrderId) => {
  if (!paypalOrderId || !PAYPAL_ORDER_ID_RE.test(paypalOrderId)) {
    throw new ErrorResponse('Invalid PayPal order ID', 400);
  }

  const token = await getAccessToken();

  let res;
  try {
    res = await axios.post(
      `${PAYPAL_BASE}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`,
      {},
      { headers: paypalHeaders(token), timeout: 15_000 },
    );
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message ?? 'Failed to capture PayPal order';
    throw new ErrorResponse(message, status ?? 502);
  }

  if (!res.data?.status) {
    throw new ErrorResponse('PayPal did not return a capture status', 502);
  }

  return res.data;
};