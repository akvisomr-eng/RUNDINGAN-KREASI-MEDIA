-- 20261123_011_rental_production_academy
-- Dedicated Rental, Production and Academy/LMS operational domains.
-- Additive and organization-scoped; no data is seeded or existing table rewritten.

CREATE TABLE IF NOT EXISTS rental_equipment_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_unit_id uuid,
  inventory_item_id uuid,
  asset_tag text NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  manufacturer text,
  model text,
  serial_number text,
  condition text NOT NULL DEFAULT 'good' CHECK (condition IN ('new','good','fair','needs_repair','retired')),
  daily_rate numeric(18,2) NOT NULL DEFAULT 0 CHECK (daily_rate >= 0),
  replacement_value numeric(18,2) NOT NULL DEFAULT 0 CHECK (replacement_value >= 0),
  status text NOT NULL DEFAULT 'available' CHECK (status IN ('available','maintenance','retired')),
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,asset_tag),
  FOREIGN KEY (organization_id,business_unit_id) REFERENCES business_units(organization_id,id),
  FOREIGN KEY (organization_id,inventory_item_id) REFERENCES inventory_items(organization_id,id)
);
CREATE INDEX IF NOT EXISTS rental_equipment_status_idx ON rental_equipment_units(organization_id,status,category);

CREATE TABLE IF NOT EXISTS rental_bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  booking_number text NOT NULL,
  customer_party_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','requested','confirmed','checked_out','returned','cancelled')),
  deposit_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (deposit_amount >= 0),
  notes text,
  business_transaction_id uuid,
  created_by text NOT NULL,
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,booking_number),
  FOREIGN KEY (organization_id,customer_party_id) REFERENCES parties(organization_id,id),
  FOREIGN KEY (organization_id,business_transaction_id) REFERENCES business_transactions(organization_id,id),
  CHECK (end_date >= start_date)
);
CREATE INDEX IF NOT EXISTS rental_bookings_customer_idx ON rental_bookings(organization_id,customer_party_id,start_date DESC);

CREATE TABLE IF NOT EXISTS rental_booking_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  booking_id uuid NOT NULL,
  equipment_unit_id uuid NOT NULL,
  daily_rate numeric(18,2) NOT NULL CHECK (daily_rate >= 0),
  quantity_days integer NOT NULL CHECK (quantity_days > 0),
  line_total numeric(18,2) GENERATED ALWAYS AS (daily_rate * quantity_days) STORED,
  condition_out text,
  condition_in text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,booking_id,equipment_unit_id),
  FOREIGN KEY (organization_id,booking_id) REFERENCES rental_bookings(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,equipment_unit_id) REFERENCES rental_equipment_units(organization_id,id)
);
CREATE INDEX IF NOT EXISTS rental_booking_items_unit_idx ON rental_booking_items(organization_id,equipment_unit_id);

-- Serialize competing bookings per asset. The trigger includes draft/requested holds so
-- two concurrent requests cannot reserve the same physical unit for overlapping dates.
CREATE OR REPLACE FUNCTION rental_guard_booking_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b rental_bookings%ROWTYPE;
BEGIN
  SELECT * INTO b FROM rental_bookings WHERE id=NEW.booking_id AND organization_id=NEW.organization_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Rental booking not found for organization'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':' || NEW.equipment_unit_id::text,0));
  IF EXISTS (
    SELECT 1 FROM rental_booking_items i JOIN rental_bookings x ON x.id=i.booking_id AND x.organization_id=i.organization_id
    WHERE i.organization_id=NEW.organization_id AND i.equipment_unit_id=NEW.equipment_unit_id
      AND i.id<>COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid)
      AND x.status IN ('draft','requested','confirmed','checked_out')
      AND b.status IN ('draft','requested','confirmed','checked_out')
      AND daterange(x.start_date,x.end_date,'[]') && daterange(b.start_date,b.end_date,'[]')
  ) OR EXISTS (
    SELECT 1 FROM production_equipment_allocations a
    WHERE a.organization_id=NEW.organization_id AND a.equipment_unit_id=NEW.equipment_unit_id
      AND a.status IN ('reserved','in_use') AND b.status IN ('draft','requested','confirmed','checked_out')
      AND daterange(a.start_date,a.end_date,'[]') && daterange(b.start_date,b.end_date,'[]')
  ) THEN RAISE EXCEPTION 'Equipment unit is already reserved for overlapping dates' USING ERRCODE='23P01'; END IF;
  IF EXISTS (SELECT 1 FROM rental_equipment_units e WHERE e.id=NEW.equipment_unit_id AND e.organization_id=NEW.organization_id AND e.status<>'available')
    AND b.status IN ('draft','requested','confirmed') THEN RAISE EXCEPTION 'Equipment unit is not available'; END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='rental_booking_overlap_guard' AND tgrelid='public.rental_booking_items'::regclass AND NOT tgisinternal) THEN
    EXECUTE 'CREATE TRIGGER rental_booking_overlap_guard BEFORE INSERT OR UPDATE OF booking_id,equipment_unit_id ON public.rental_booking_items FOR EACH ROW EXECUTE FUNCTION rental_guard_booking_overlap()';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION rental_guard_booking_status() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE unit_id uuid;
BEGIN
  IF NEW.status NOT IN ('draft','requested','confirmed','checked_out') THEN RETURN NEW; END IF;
  IF NEW.status IN ('requested','confirmed') AND NOT EXISTS (SELECT 1 FROM rental_booking_items WHERE organization_id=NEW.organization_id AND booking_id=NEW.id) THEN
    RAISE EXCEPTION 'Rental booking must contain at least one equipment unit';
  END IF;
  FOR unit_id IN SELECT equipment_unit_id FROM rental_booking_items WHERE organization_id=NEW.organization_id AND booking_id=NEW.id LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':' || unit_id::text,0));
    IF EXISTS (
      SELECT 1 FROM rental_booking_items i JOIN rental_bookings x ON x.id=i.booking_id AND x.organization_id=i.organization_id
      WHERE i.organization_id=NEW.organization_id AND i.equipment_unit_id=unit_id AND x.id<>NEW.id
        AND x.status IN ('draft','requested','confirmed','checked_out')
        AND daterange(x.start_date,x.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')
    ) OR EXISTS (
      SELECT 1 FROM production_equipment_allocations a
      WHERE a.organization_id=NEW.organization_id AND a.equipment_unit_id=unit_id AND a.status IN ('reserved','in_use')
        AND daterange(a.start_date,a.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')
    ) THEN RAISE EXCEPTION 'Equipment unit is already reserved for overlapping dates' USING ERRCODE='23P01'; END IF;
  END LOOP;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='rental_booking_status_overlap_guard' AND tgrelid='public.rental_bookings'::regclass AND NOT tgisinternal) THEN
    EXECUTE 'CREATE TRIGGER rental_booking_status_overlap_guard BEFORE UPDATE OF status,start_date,end_date ON public.rental_bookings FOR EACH ROW EXECUTE FUNCTION rental_guard_booking_status()';
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS rental_checkouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  booking_id uuid NOT NULL,
  equipment_unit_id uuid NOT NULL,
  checked_out_at timestamptz NOT NULL DEFAULT now(),
  checked_out_by text NOT NULL,
  condition_out text,
  accessories_out jsonb NOT NULL DEFAULT '[]'::jsonb,
  returned_at timestamptz,
  returned_by text,
  condition_in text,
  accessories_in jsonb NOT NULL DEFAULT '[]'::jsonb,
  late_fee numeric(18,2) NOT NULL DEFAULT 0 CHECK (late_fee >= 0),
  notes text,
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,booking_id,equipment_unit_id),
  FOREIGN KEY (organization_id,booking_id,equipment_unit_id) REFERENCES rental_booking_items(organization_id,booking_id,equipment_unit_id)
);
CREATE TABLE IF NOT EXISTS rental_maintenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  equipment_unit_id uuid NOT NULL,
  maintenance_type text NOT NULL CHECK (maintenance_type IN ('preventive','repair','inspection')),
  description text NOT NULL,
  scheduled_date date,
  completed_date date,
  cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (cost >= 0),
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','completed','cancelled')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,equipment_unit_id) REFERENCES rental_equipment_units(organization_id,id)
);
CREATE TABLE IF NOT EXISTS rental_incidents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  booking_id uuid NOT NULL,
  equipment_unit_id uuid NOT NULL,
  incident_type text NOT NULL CHECK (incident_type IN ('damage','loss','late','other')),
  description text NOT NULL,
  assessed_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (assessed_cost >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','assessed','resolved','waived')),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (organization_id,booking_id,equipment_unit_id) REFERENCES rental_booking_items(organization_id,booking_id,equipment_unit_id)
);

CREATE TABLE IF NOT EXISTS production_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  business_unit_id uuid,
  project_number text NOT NULL,
  customer_party_id uuid,
  title text NOT NULL,
  project_type text NOT NULL DEFAULT 'video',
  brief text NOT NULL DEFAULT '',
  location text,
  start_date date,
  due_date date,
  budget_amount numeric(18,2) NOT NULL DEFAULT 0 CHECK (budget_amount >= 0),
  actual_cost numeric(18,2) NOT NULL DEFAULT 0 CHECK (actual_cost >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','briefing','scheduled','in_progress','review','approved','delivered','cancelled')),
  approved_by text,
  approved_at timestamptz,
  delivered_at timestamptz,
  business_transaction_id uuid,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  UNIQUE (organization_id,project_number),
  FOREIGN KEY (organization_id,business_unit_id) REFERENCES business_units(organization_id,id),
  FOREIGN KEY (organization_id,customer_party_id) REFERENCES parties(organization_id,id),
  FOREIGN KEY (organization_id,business_transaction_id) REFERENCES business_transactions(organization_id,id),
  CHECK (due_date IS NULL OR start_date IS NULL OR due_date>=start_date)
);
CREATE INDEX IF NOT EXISTS production_projects_status_idx ON production_projects(organization_id,status,due_date);
CREATE TABLE IF NOT EXISTS production_crew_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  employee_id uuid,
  full_name text NOT NULL,
  email text,
  specialty text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,employee_id) REFERENCES hr_employees(organization_id,id)
);
CREATE TABLE IF NOT EXISTS production_crew_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL,
  crew_member_id uuid NOT NULL,
  role_name text NOT NULL,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','confirmed','completed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,project_id,crew_member_id,role_name),
  FOREIGN KEY (organization_id,project_id) REFERENCES production_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,crew_member_id) REFERENCES production_crew_members(organization_id,id),
  CHECK (end_date IS NULL OR start_date IS NULL OR end_date>=start_date)
);
CREATE TABLE IF NOT EXISTS production_equipment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id),
  project_id uuid NOT NULL,
  equipment_unit_id uuid NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status text NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','in_use','released','cancelled')),
  notes text,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id,id),
  FOREIGN KEY (organization_id,project_id) REFERENCES production_projects(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY (organization_id,equipment_unit_id) REFERENCES rental_equipment_units(organization_id,id),
  CHECK (end_date>=start_date)
);
CREATE OR REPLACE FUNCTION production_guard_equipment_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':' || NEW.equipment_unit_id::text,0));
  IF EXISTS (SELECT 1 FROM production_equipment_allocations a WHERE a.organization_id=NEW.organization_id AND a.equipment_unit_id=NEW.equipment_unit_id AND a.id<>COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid) AND a.status IN ('reserved','in_use') AND NEW.status IN ('reserved','in_use') AND daterange(a.start_date,a.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]'))
  OR EXISTS (SELECT 1 FROM rental_booking_items i JOIN rental_bookings b ON b.id=i.booking_id AND b.organization_id=i.organization_id WHERE i.organization_id=NEW.organization_id AND i.equipment_unit_id=NEW.equipment_unit_id AND b.status IN ('draft','requested','confirmed','checked_out') AND NEW.status IN ('reserved','in_use') AND daterange(b.start_date,b.end_date,'[]') && daterange(NEW.start_date,NEW.end_date,'[]')) THEN
    RAISE EXCEPTION 'Equipment unit conflicts with a rental booking or production allocation' USING ERRCODE='23P01';
  END IF;
  IF EXISTS (SELECT 1 FROM rental_equipment_units e WHERE e.id=NEW.equipment_unit_id AND e.organization_id=NEW.organization_id AND e.status<>'available') AND NEW.status IN ('reserved','in_use') THEN RAISE EXCEPTION 'Equipment unit is not available'; END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='production_equipment_overlap_guard' AND tgrelid='public.production_equipment_allocations'::regclass AND NOT tgisinternal) THEN
    EXECUTE 'CREATE TRIGGER production_equipment_overlap_guard BEFORE INSERT OR UPDATE OF equipment_unit_id,start_date,end_date,status ON public.production_equipment_allocations FOR EACH ROW EXECUTE FUNCTION production_guard_equipment_overlap()';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS production_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), project_id uuid NOT NULL,
  title text NOT NULL, due_date date, status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','in_progress','complete','blocked')),
  completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,project_id) REFERENCES production_projects(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS production_deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), project_id uuid NOT NULL,
  title text NOT NULL, description text, file_url text, due_date date, status text NOT NULL DEFAULT 'planned' CHECK(status IN ('planned','in_progress','review','approved','delivered')),
  delivered_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,project_id) REFERENCES production_projects(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS production_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), deliverable_id uuid NOT NULL,
  revision_number integer NOT NULL CHECK(revision_number>0), feedback text NOT NULL, requested_by text NOT NULL, status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','in_progress','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,deliverable_id,revision_number),
  FOREIGN KEY(organization_id,deliverable_id) REFERENCES production_deliverables(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS production_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), project_id uuid NOT NULL,
  description text NOT NULL, amount numeric(18,2) NOT NULL CHECK(amount>=0), incurred_on date NOT NULL DEFAULT CURRENT_DATE,
  approval_status text NOT NULL DEFAULT 'pending' CHECK(approval_status IN ('pending','approved','rejected')), created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(organization_id,project_id) REFERENCES production_projects(organization_id,id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS academy_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
  course_code text NOT NULL, title text NOT NULL, description text NOT NULL DEFAULT '', level text NOT NULL DEFAULT 'beginner',
  learning_hours numeric(6,2) NOT NULL DEFAULT 0 CHECK(learning_hours>=0), fee numeric(18,2) NOT NULL DEFAULT 0 CHECK(fee>=0),
  status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')), created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id,id), UNIQUE(organization_id,course_code)
);
CREATE TABLE IF NOT EXISTS academy_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), course_id uuid NOT NULL,
  title text NOT NULL, content text NOT NULL DEFAULT '', sequence_no integer NOT NULL CHECK(sequence_no>0), duration_minutes integer NOT NULL DEFAULT 0 CHECK(duration_minutes>=0),
  UNIQUE(organization_id,course_id,sequence_no), FOREIGN KEY(organization_id,course_id) REFERENCES academy_courses(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS academy_instructors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), employee_id uuid,
  full_name text NOT NULL, email text, specialty text, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
  UNIQUE(organization_id,id), FOREIGN KEY(organization_id,employee_id) REFERENCES hr_employees(organization_id,id)
);
CREATE TABLE IF NOT EXISTS academy_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), course_id uuid NOT NULL, instructor_id uuid,
  class_code text NOT NULL, title text NOT NULL, delivery_mode text NOT NULL DEFAULT 'onsite' CHECK(delivery_mode IN ('onsite','online','hybrid')),
  venue text, starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL, capacity integer NOT NULL CHECK(capacity>0),
  fee numeric(18,2) NOT NULL DEFAULT 0 CHECK(fee>=0), status text NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','in_progress','completed','cancelled')),
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), UNIQUE(organization_id,class_code),
  FOREIGN KEY(organization_id,course_id) REFERENCES academy_courses(organization_id,id),
  FOREIGN KEY(organization_id,instructor_id) REFERENCES academy_instructors(organization_id,id), CHECK(ends_at>starts_at)
);
CREATE TABLE IF NOT EXISTS academy_students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id),
  student_number text NOT NULL, full_name text NOT NULL, email text, phone text, status text NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive','archived')),
  created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), UNIQUE(organization_id,student_number)
);
CREATE TABLE IF NOT EXISTS academy_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), class_id uuid NOT NULL, student_id uuid NOT NULL,
  enrolled_at timestamptz NOT NULL DEFAULT now(), status text NOT NULL DEFAULT 'enrolled' CHECK(status IN ('enrolled','completed','withdrawn','failed')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid','pending','paid','waived','refunded')),
  amount_paid numeric(18,2) NOT NULL DEFAULT 0 CHECK(amount_paid>=0), UNIQUE(organization_id,class_id,student_id), UNIQUE(organization_id,id),
  FOREIGN KEY(organization_id,class_id) REFERENCES academy_classes(organization_id,id), FOREIGN KEY(organization_id,student_id) REFERENCES academy_students(organization_id,id)
);
CREATE OR REPLACE FUNCTION academy_guard_class_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap integer;
BEGIN
  IF NEW.status<>'enrolled' THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.organization_id::text || ':' || NEW.class_id::text,0));
  SELECT capacity INTO cap FROM academy_classes WHERE organization_id=NEW.organization_id AND id=NEW.class_id;
  IF cap IS NULL THEN RAISE EXCEPTION 'Academy class not found for organization'; END IF;
  IF (SELECT count(*) FROM academy_enrollments e WHERE e.organization_id=NEW.organization_id AND e.class_id=NEW.class_id AND e.status='enrolled' AND e.id<>COALESCE(NEW.id,'00000000-0000-0000-0000-000000000000'::uuid))>=cap
  THEN RAISE EXCEPTION 'Academy class is at capacity' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname='academy_enrollment_capacity_guard' AND tgrelid='public.academy_enrollments'::regclass AND NOT tgisinternal) THEN
    EXECUTE 'CREATE TRIGGER academy_enrollment_capacity_guard BEFORE INSERT OR UPDATE OF class_id,status ON public.academy_enrollments FOR EACH ROW EXECUTE FUNCTION academy_guard_class_capacity()';
  END IF;
END $$;
CREATE TABLE IF NOT EXISTS academy_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), enrollment_id uuid NOT NULL,
  session_date date NOT NULL, attendance_status text NOT NULL CHECK(attendance_status IN ('present','late','absent','excused')),
  notes text, recorded_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,enrollment_id,session_date),
  FOREIGN KEY(organization_id,enrollment_id) REFERENCES academy_enrollments(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS academy_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), class_id uuid NOT NULL,
  title text NOT NULL, assessment_type text NOT NULL DEFAULT 'assignment', max_score numeric(8,2) NOT NULL DEFAULT 100 CHECK(max_score>0), due_date date,
  created_by text NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,id), FOREIGN KEY(organization_id,class_id) REFERENCES academy_classes(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS academy_assessment_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), assessment_id uuid NOT NULL, enrollment_id uuid NOT NULL,
  score numeric(8,2) NOT NULL CHECK(score>=0), feedback text, graded_by text NOT NULL, graded_at timestamptz NOT NULL DEFAULT now(), UNIQUE(organization_id,assessment_id,enrollment_id),
  FOREIGN KEY(organization_id,assessment_id) REFERENCES academy_assessments(organization_id,id) ON DELETE CASCADE,
  FOREIGN KEY(organization_id,enrollment_id) REFERENCES academy_enrollments(organization_id,id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS academy_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id), enrollment_id uuid NOT NULL,
  certificate_number text NOT NULL, issued_at timestamptz NOT NULL DEFAULT now(), issued_by text NOT NULL, revoked_at timestamptz,
  UNIQUE(organization_id,certificate_number), UNIQUE(organization_id,enrollment_id),
  FOREIGN KEY(organization_id,enrollment_id) REFERENCES academy_enrollments(organization_id,id)
);

-- Rental was previously catalogued as an optional inactive plugin. Enable it for the
-- organization's newly delivered operations workspace without changing the catalog.
INSERT INTO organization_modules(organization_id,module_code,status)
SELECT o.id,'RENTAL','active' FROM organizations o WHERE o.slug='rundingan-kreasi-media'
ON CONFLICT(organization_id,module_code) DO UPDATE SET status='active',updated_at=now();

INSERT INTO permissions(code,module,description) VALUES
('rental.read','rental','View equipment, booking, checkout and maintenance operations'),
('rental.manage','rental','Manage equipment, reservations, check-in/out and maintenance'),
('production.read','production','View production projects, crew and delivery operations'),
('production.manage','production','Manage production projects, crew, costs and equipment allocations'),
('academy.lms.read','academy','View courses, classes, students and learning records'),
('academy.lms.manage','academy','Manage courses, classes, enrollments and learning records')
ON CONFLICT(code) DO UPDATE SET module=EXCLUDED.module,description=EXCLUDED.description;
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id JOIN permissions p ON p.code IN ('rental.read','rental.manage','production.read','production.manage','academy.lms.read','academy.lms.manage')
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('owner','administrator','unit_manager') ON CONFLICT(role_id,permission_id) DO NOTHING;
INSERT INTO role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM roles r JOIN organizations o ON o.id=r.organization_id JOIN permissions p ON p.code IN ('rental.read','production.read','academy.lms.read')
WHERE o.slug='rundingan-kreasi-media' AND r.code IN ('staff','viewer') ON CONFLICT(role_id,permission_id) DO NOTHING;

GRANT SELECT,INSERT,UPDATE ON TABLE rental_equipment_units,rental_bookings,rental_booking_items,rental_checkouts,rental_maintenance,rental_incidents,
production_projects,production_crew_members,production_crew_assignments,production_equipment_allocations,production_milestones,production_deliverables,production_revisions,production_expenses,
academy_courses,academy_lessons,academy_instructors,academy_classes,academy_students,academy_enrollments,academy_attendance,academy_assessments,academy_assessment_results,academy_certificates TO rundingan_app_limited;
GRANT EXECUTE ON FUNCTION rental_guard_booking_overlap(),rental_guard_booking_status(),production_guard_equipment_overlap(),academy_guard_class_capacity() TO rundingan_app_limited;
INSERT INTO schema_migrations(version,description,applied_at)
VALUES ('20261123_011_rental_production_academy','Add dedicated Rental, Production and Academy LMS domains and workflows',now())
ON CONFLICT(version) DO NOTHING;
