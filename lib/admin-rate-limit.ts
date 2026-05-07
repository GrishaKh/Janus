import { WindowRateLimiter } from "@/lib/window-rate-limit"

export const adminLoginRateLimiter = new WindowRateLimiter({
  limit: 5,
  windowMs: 15 * 60 * 1000,
})

export const adminApiRateLimiter = new WindowRateLimiter({
  limit: 120,
  windowMs: 60 * 60 * 1000,
})
