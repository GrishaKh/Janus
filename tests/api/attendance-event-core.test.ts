import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  evaluateAttendanceEvent,
  parseAttendanceEvent,
  type AttendanceEventInput,
  type DeviceContext,
} from "../../lib/api/attendance-event-core.ts"

const NOW = "2026-04-26T09:00:00.000Z"

const DEVICE: DeviceContext = {
  device_id: "lab-arapi-door-1",
  mode: "attendance",
}

const STUDENT = { id: "11111111-2222-3333-4444-555555555555" }

describe("parseAttendanceEvent", () => {
  it("parses a valid RFID auth event", () => {
    const result = parseAttendanceEvent({
      type: "auth",
      auth_method: "rfid",
      rfid_uid: "04A1B2C3D4E5",
      occurred_at: NOW,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.event.type, "auth")
    if (result.event.type !== "auth") return
    assert.equal(result.event.auth_method, "rfid")
    assert.equal(result.event.rfid_uid, "04A1B2C3D4E5")
  })

  it("parses a fingerprint auth event with numeric id", () => {
    const result = parseAttendanceEvent({
      type: "auth",
      auth_method: "fingerprint",
      fingerprint_id: 42,
      occurred_at: NOW,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    if (result.event.type !== "auth") return
    assert.equal(result.event.fingerprint_id, 42)
  })

  it("rejects a fingerprint id outside 1..1000", () => {
    const result = parseAttendanceEvent({
      type: "auth",
      auth_method: "fingerprint",
      fingerprint_id: 5000,
      occurred_at: NOW,
    })
    assert.equal(result.ok, false)
  })

  it("rejects an auth event with no identifier at all", () => {
    const result = parseAttendanceEvent({
      type: "auth",
      auth_method: "rfid",
      occurred_at: NOW,
    })
    assert.equal(result.ok, false)
  })

  it("rejects auth_method outside the allowed set", () => {
    const result = parseAttendanceEvent({
      type: "auth",
      auth_method: "face",
      rfid_uid: "X",
      occurred_at: NOW,
    })
    assert.equal(result.ok, false)
  })

  it("parses a no_auth breach event", () => {
    const result = parseAttendanceEvent({
      type: "breach",
      reason: "no_auth",
      occurred_at: NOW,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    if (result.event.type !== "breach") return
    assert.equal(result.event.reason, "no_auth")
  })

  it("parses a rejected_auth breach with attempted_source/id", () => {
    const result = parseAttendanceEvent({
      type: "breach",
      reason: "rejected_auth",
      attempted_source: "fingerprint",
      attempted_id: "999",
      occurred_at: NOW,
      event_id: "evt-001",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    if (result.event.type !== "breach") return
    assert.equal(result.event.attempted_source, "fingerprint")
    assert.equal(result.event.attempted_id, "999")
    assert.equal(result.event.event_id, "evt-001")
  })

  it("rejects an invalid breach reason", () => {
    const result = parseAttendanceEvent({
      type: "breach",
      reason: "phone_phreaked",
      occurred_at: NOW,
    })
    assert.equal(result.ok, false)
  })

  it("rejects a non-ISO occurred_at", () => {
    const result = parseAttendanceEvent({
      type: "auth",
      auth_method: "rfid",
      rfid_uid: "X",
      occurred_at: "yesterday",
    })
    assert.equal(result.ok, false)
  })

  it("rejects a non-object body", () => {
    const result = parseAttendanceEvent("hello")
    assert.equal(result.ok, false)
  })

  it("rejects an unknown type field", () => {
    const result = parseAttendanceEvent({ type: "ping", occurred_at: NOW })
    assert.equal(result.ok, false)
  })
})

describe("evaluateAttendanceEvent", () => {
  it("logs an authorized entry when student resolves", () => {
    const event: AttendanceEventInput = {
      type: "auth",
      auth_method: "rfid",
      rfid_uid: "04A1B2C3",
      occurred_at: NOW,
      event_id: "evt-1",
    }
    const result = evaluateAttendanceEvent({ event, device: DEVICE, student: STUDENT })
    assert.equal(result.kind, "log")
    if (result.kind !== "log") return
    assert.equal(result.status, 201)
    assert.equal(result.insert.device_id, DEVICE.device_id)
    assert.equal(result.insert.student_id, STUDENT.id)
    assert.equal(result.insert.auth_method, "rfid")
    assert.equal(result.insert.entered_at, NOW)
    assert.equal(result.insert.session_mode, "attendance")
    assert.equal(result.insert.event_id, "evt-1")
    assert.equal(result.insert.raw_identifier, "04A1B2C3")
  })

  it("converts an auth event with unknown identifier to a rejected_auth breach", () => {
    const event: AttendanceEventInput = {
      type: "auth",
      auth_method: "fingerprint",
      fingerprint_id: 7,
      occurred_at: NOW,
    }
    const result = evaluateAttendanceEvent({ event, device: DEVICE, student: null })
    assert.equal(result.kind, "rejected_unknown_identifier")
    if (result.kind !== "rejected_unknown_identifier") return
    assert.equal(result.insert.reason, "rejected_auth")
    assert.equal(result.insert.attempted_source, "fingerprint")
    assert.equal(result.insert.attempted_id, "7")
    assert.equal(result.insert.mode, "attendance")
  })

  it("inserts a no_auth breach as-is", () => {
    const event: AttendanceEventInput = {
      type: "breach",
      reason: "no_auth",
      occurred_at: NOW,
      event_id: "evt-breach",
    }
    const result = evaluateAttendanceEvent({ event, device: DEVICE, student: null })
    assert.equal(result.kind, "breach")
    if (result.kind !== "breach") return
    assert.equal(result.insert.reason, "no_auth")
    assert.equal(result.insert.device_id, DEVICE.device_id)
    assert.equal(result.insert.event_id, "evt-breach")
    assert.equal(result.insert.mode, "attendance")
  })

  it("preserves attempted_source/id on rejected_auth breach", () => {
    const event: AttendanceEventInput = {
      type: "breach",
      reason: "rejected_auth",
      attempted_source: "rfid",
      attempted_id: "DEADBEEF",
      occurred_at: NOW,
    }
    const result = evaluateAttendanceEvent({ event, device: DEVICE, student: null })
    assert.equal(result.kind, "breach")
    if (result.kind !== "breach") return
    assert.equal(result.insert.attempted_source, "rfid")
    assert.equal(result.insert.attempted_id, "DEADBEEF")
  })

  it("drops events when device is in maintenance mode", () => {
    const event: AttendanceEventInput = {
      type: "auth",
      auth_method: "rfid",
      rfid_uid: "X",
      occurred_at: NOW,
    }
    const result = evaluateAttendanceEvent({
      event,
      device: { ...DEVICE, mode: "maintenance" },
      student: STUDENT,
    })
    assert.equal(result.kind, "maintenance_dropped")
    assert.equal(result.status, 200)
  })

  it("captures the device session_mode at time of event (silent mode)", () => {
    const event: AttendanceEventInput = {
      type: "auth",
      auth_method: "rfid",
      rfid_uid: "X",
      occurred_at: NOW,
    }
    const result = evaluateAttendanceEvent({
      event,
      device: { ...DEVICE, mode: "silent" },
      student: STUDENT,
    })
    assert.equal(result.kind, "log")
    if (result.kind !== "log") return
    assert.equal(result.insert.session_mode, "silent")
  })

  it("falls back to rfid_uid for raw_identifier when not explicitly provided", () => {
    const event: AttendanceEventInput = {
      type: "auth",
      auth_method: "rfid",
      rfid_uid: "AABBCC",
      occurred_at: NOW,
    }
    const result = evaluateAttendanceEvent({ event, device: DEVICE, student: STUDENT })
    assert.equal(result.kind, "log")
    if (result.kind !== "log") return
    assert.equal(result.insert.raw_identifier, "AABBCC")
  })
})
