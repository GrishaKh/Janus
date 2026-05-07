import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  hashDeviceToken,
  isValidDeviceId,
  parseDeviceBearer,
  verifyDeviceToken,
} from "../../features/attendance/lib/device-token.ts"

describe("device-auth: device_id validation", () => {
  it("accepts well-formed ids", () => {
    assert.equal(isValidDeviceId("lab-arapi-door-1"), true)
    assert.equal(isValidDeviceId("ESP32_Beta_07"), true)
    assert.equal(isValidDeviceId("dev123"), true)
  })

  it("rejects malformed ids", () => {
    assert.equal(isValidDeviceId(""), false)
    assert.equal(isValidDeviceId("ab"), false) // too short
    assert.equal(isValidDeviceId("has space"), false)
    assert.equal(isValidDeviceId("has.dot"), false) // dot is the separator
    assert.equal(isValidDeviceId("-leading-dash"), false)
    assert.equal(isValidDeviceId("a".repeat(65)), false)
  })
})

describe("device-auth: bearer header parsing", () => {
  it("parses 'Bearer <device_id>.<token>' with the first dot as separator", () => {
    const parsed = parseDeviceBearer("Bearer lab-arapi-door-1.abcdefghijklmnop")
    assert.notEqual(parsed, null)
    assert.equal(parsed?.deviceId, "lab-arapi-door-1")
    assert.equal(parsed?.rawToken, "abcdefghijklmnop")
  })

  it("preserves dots inside the token portion", () => {
    const parsed = parseDeviceBearer("Bearer dev123.aaaaaaaaaaaa.bbbb.cccc")
    assert.equal(parsed?.deviceId, "dev123")
    assert.equal(parsed?.rawToken, "aaaaaaaaaaaa.bbbb.cccc")
  })

  it("rejects null / empty / non-Bearer headers", () => {
    assert.equal(parseDeviceBearer(null), null)
    assert.equal(parseDeviceBearer(""), null)
    assert.equal(parseDeviceBearer("Token foo.bar"), null)
    assert.equal(parseDeviceBearer("Basic dXNlcjpwYXNz"), null)
  })

  it("rejects payloads without a dot", () => {
    assert.equal(parseDeviceBearer("Bearer onlyonepiece"), null)
  })

  it("rejects tokens shorter than 16 chars", () => {
    assert.equal(parseDeviceBearer("Bearer dev123.short"), null)
  })

  it("rejects an invalid device_id portion", () => {
    assert.equal(parseDeviceBearer("Bearer ab.aaaaaaaaaaaaaaaa"), null)
  })
})

describe("device-auth: bcrypt round-trip", () => {
  it("verifies a token against its own hash", async () => {
    const raw = "supersecrettoken-32-bytes-base64url"
    const hash = await hashDeviceToken(raw)
    assert.equal(await verifyDeviceToken(raw, hash), true)
  })

  it("rejects a different token", async () => {
    const hash = await hashDeviceToken("token-A-padding-padding-padding")
    assert.equal(await verifyDeviceToken("token-B-padding-padding-padding", hash), false)
  })
})
