import { WindowRateLimiter } from "@/lib/window-rate-limit"

// Each authorized device tap or breach POST. ESP32 idle traffic is heartbeat
// every ~30s + occasional events. Burst headroom for bulk resync after
// network outage.
export const deviceEventRateLimiter = new WindowRateLimiter({
  limit: 600,
  windowMs: 5 * 60 * 1000,
})

// Heartbeat is supposed to be cheap and frequent.
export const deviceHeartbeatRateLimiter = new WindowRateLimiter({
  limit: 600,
  windowMs: 60 * 60 * 1000,
})

// Config is pulled lazily; very low limit.
export const deviceConfigRateLimiter = new WindowRateLimiter({
  limit: 60,
  windowMs: 60 * 60 * 1000,
})

// Resync is rare (post-outage bulk import); strict so a misbehaving device
// can't replay its entire flash log every minute.
export const deviceResyncRateLimiter = new WindowRateLimiter({
  limit: 6,
  windowMs: 60 * 60 * 1000,
})
