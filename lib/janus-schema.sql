-- ==============================================
-- JANUS — Standalone schema (run once, top-to-bottom, in Supabase SQL Editor)
-- ==============================================
-- This bundles a minimal `students` table plus the full attendance schema.
-- When Janus is later folded back into the main Armath site, drop the
-- `students` block (the main repo already has a richer one with the same
-- column names) and run only the attendance block.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Generic updated_at trigger helper used by attendance_devices.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==============================================
-- Students (minimal stub for the standalone build)
-- ==============================================

CREATE TABLE IF NOT EXISTS students (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username        VARCHAR(50)  UNIQUE NOT NULL,
  full_name       VARCHAR(150) NOT NULL,
  status          VARCHAR(20)  NOT NULL DEFAULT 'active',
  rfid_uid        VARCHAR(64)  UNIQUE,
  fingerprint_id  SMALLINT     UNIQUE CHECK (fingerprint_id BETWEEN 1 AND 1000),
  student_code    VARCHAR(32)  UNIQUE,
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_students_rfid_uid       ON students(rfid_uid);
CREATE INDEX IF NOT EXISTS idx_students_fingerprint_id ON students(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_students_student_code   ON students(student_code);

CREATE TRIGGER update_students_updated_at
  BEFORE UPDATE ON students
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================
-- Attendance devices (one row per physical ESP32 installation)
-- ==============================================

CREATE TABLE IF NOT EXISTS attendance_devices (
  device_id             VARCHAR(64) PRIMARY KEY,
  display_name          VARCHAR(100) NOT NULL,
  token_hash            VARCHAR(255) NOT NULL,
  last_seen_at          TIMESTAMP WITH TIME ZONE,
  last_battery_percent  SMALLINT CHECK (last_battery_percent BETWEEN 0 AND 100),
  mode                  VARCHAR(20) DEFAULT 'attendance' CHECK (mode IN ('attendance', 'silent', 'exam', 'maintenance')),
  silent_from           TIME,
  silent_to             TIME,
  two_factor            BOOLEAN DEFAULT FALSE,
  alarm_silenced_until  TIMESTAMP WITH TIME ZONE,
  admin_phones          TEXT[] DEFAULT '{}',
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- Class sessions + enrollments (drives the P/L/A ledger view)
-- ==============================================

CREATE TABLE IF NOT EXISTS attendance_sessions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject       VARCHAR(100) NOT NULL,
  group_code    VARCHAR(50)  NOT NULL,
  scheduled_at  TIMESTAMP WITH TIME ZONE NOT NULL,
  duration_min  SMALLINT DEFAULT 60 CHECK (duration_min > 0),
  grace_min     SMALLINT DEFAULT 10 CHECK (grace_min >= 0),
  created_at    TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_enrollments (
  student_id  UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  group_code  VARCHAR(50) NOT NULL,
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  PRIMARY KEY (student_id, group_code)
);

-- ==============================================
-- Logs (authorized entries) and breaches (unauthorized attempts)
-- ==============================================

CREATE TABLE IF NOT EXISTS attendance_logs (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id      UUID REFERENCES students(id) ON DELETE SET NULL,
  device_id       VARCHAR(64) NOT NULL REFERENCES attendance_devices(device_id) ON DELETE CASCADE,
  auth_method     VARCHAR(20) NOT NULL CHECK (auth_method IN ('rfid', 'fingerprint', '2fa')),
  entered_at      TIMESTAMP WITH TIME ZONE NOT NULL,
  session_id      UUID REFERENCES attendance_sessions(id) ON DELETE SET NULL,
  session_mode    VARCHAR(20) CHECK (session_mode IN ('attendance', 'silent', 'exam', 'maintenance')),
  event_id        VARCHAR(64) UNIQUE,
  raw_identifier  VARCHAR(128),
  created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attendance_breaches (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id         VARCHAR(64) NOT NULL REFERENCES attendance_devices(device_id) ON DELETE CASCADE,
  detected_at       TIMESTAMP WITH TIME ZONE NOT NULL,
  reason            VARCHAR(20) NOT NULL CHECK (reason IN ('no_auth', 'rejected_auth', 'tamper')),
  attempted_source  VARCHAR(20) CHECK (attempted_source IN ('rfid', 'fingerprint')),
  attempted_id      VARCHAR(128),
  mode              VARCHAR(20) CHECK (mode IN ('attendance', 'silent', 'exam', 'maintenance')),
  event_id          VARCHAR(64) UNIQUE,
  acknowledged      BOOLEAN DEFAULT FALSE,
  ack_by            VARCHAR(100),
  ack_at            TIMESTAMP WITH TIME ZONE,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==============================================
-- Indexes
-- ==============================================

CREATE INDEX IF NOT EXISTS idx_attendance_devices_last_seen ON attendance_devices(last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_scheduled ON attendance_sessions(scheduled_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_group     ON attendance_sessions(group_code);

CREATE INDEX IF NOT EXISTS idx_attendance_enrollments_group  ON attendance_enrollments(group_code);

CREATE INDEX IF NOT EXISTS idx_attendance_logs_entered_at       ON attendance_logs(entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_student_entered  ON attendance_logs(student_id, entered_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_device           ON attendance_logs(device_id, entered_at DESC);

CREATE INDEX IF NOT EXISTS idx_attendance_breaches_detected     ON attendance_breaches(detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_breaches_unack        ON attendance_breaches(acknowledged, detected_at DESC);

-- ==============================================
-- Ledger view (derived P/L/A from logs and sessions)
-- ==============================================

CREATE OR REPLACE VIEW attendance_ledger AS
SELECT
  s.id         AS student_id,
  s.full_name,
  s.username,
  s.student_code,
  cs.id        AS session_id,
  cs.subject,
  cs.group_code,
  cs.scheduled_at,
  CASE
    WHEN al.entered_at IS NULL THEN 'absent'
    WHEN al.entered_at <= cs.scheduled_at + (cs.grace_min || ' min')::interval THEN 'present'
    ELSE 'late'
  END AS status,
  al.entered_at,
  al.auth_method
FROM attendance_sessions cs
JOIN attendance_enrollments e ON e.group_code = cs.group_code
JOIN students s               ON s.id = e.student_id
LEFT JOIN attendance_logs al
  ON al.student_id = s.id
 AND al.entered_at BETWEEN cs.scheduled_at - interval '15 min'
                        AND cs.scheduled_at + (cs.duration_min || ' min')::interval;

-- ==============================================
-- Row-level security (service-role only; the app uses the service-role key)
-- ==============================================

ALTER TABLE students               ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_devices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs        ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_breaches    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow service role full access" ON students               FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON attendance_devices     FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON attendance_sessions    FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON attendance_enrollments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON attendance_logs        FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Allow service role full access" ON attendance_breaches    FOR ALL USING (auth.role() = 'service_role');

-- ==============================================
-- Realtime publication (drives the live admin feed)
-- ==============================================

ALTER PUBLICATION supabase_realtime ADD TABLE attendance_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance_breaches;

-- ==============================================
-- Triggers
-- ==============================================

CREATE TRIGGER update_attendance_devices_updated_at
  BEFORE UPDATE ON attendance_devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
