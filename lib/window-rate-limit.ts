interface RateLimitOptions {
  limit: number
  windowMs: number
  cleanupIntervalMs?: number
}

interface RateLimitRecord {
  count: number
  resetTime: number
}

export interface RateLimitCheckResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export class WindowRateLimiter {
  private readonly map = new Map<string, RateLimitRecord>()
  private cleanupTimer: NodeJS.Timeout | null = null
  private readonly cleanupIntervalMs: number

  constructor(private readonly options: RateLimitOptions) {
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? Math.min(options.windowMs, 5 * 60 * 1000)
    this.startCleanup()
  }

  private startCleanup() {
    if (this.cleanupTimer) return
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, record] of this.map.entries()) {
        if (now > record.resetTime) {
          this.map.delete(key)
        }
      }
    }, this.cleanupIntervalMs)

    if (this.cleanupTimer.unref) {
      this.cleanupTimer.unref()
    }
  }

  check(key: string): RateLimitCheckResult {
    const now = Date.now()
    const record = this.map.get(key)

    if (!record || now > record.resetTime) {
      this.map.set(key, { count: 1, resetTime: now + this.options.windowMs })
      return {
        allowed: true,
        remaining: Math.max(this.options.limit - 1, 0),
        retryAfterSeconds: 0,
      }
    }

    if (record.count >= this.options.limit) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(Math.ceil((record.resetTime - now) / 1000), 1),
      }
    }

    record.count += 1
    return {
      allowed: true,
      remaining: Math.max(this.options.limit - record.count, 0),
      retryAfterSeconds: 0,
    }
  }
}
