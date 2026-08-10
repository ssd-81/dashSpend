// Domain constants mirrored from the backend (app/models/constants.py).

export const CATEGORIES = [
  "Travel",
  "Meals",
  "Lodging",
  "Office Supplies",
  "Software",
  "Transport",
  "Entertainment",
  "Other",
] as const;

// Common ISO 4217 codes accepted by the backend validation layer.
const REST = [
  "AED", "ARS", "AUD", "BDT", "BGN", "BHD", "BRL", "CAD", "CHF", "CLP",
  "CNY", "COP", "CZK", "DKK", "EGP", "HKD", "HUF", "IDR", "ILS", "INR",
  "JOD", "JPY", "KES", "KRW", "KWD", "LKR", "MXN", "MYR", "NGN", "NOK",
  "NZD", "OMR", "PEN", "PHP", "PKR", "PLN", "QAR", "RON", "SAR", "SEK",
  "SGD", "THB", "TRY", "TWD", "UAH", "VND", "ZAR",
].sort();

export const CURRENCIES = ["USD", "EUR", "GBP", ...REST];
