# RUNDINGAN ACADEMY — Application Blueprint

## Mission
Manage training, education, professional development, and learning services for individuals and organizations.

## Owned data
- programs, courses, curriculum versions, learning outcomes;
- cohorts, schedules, classrooms/online sessions, enrollment;
- attendance, assignments, assessments, grades, feedback;
- instructor assignments and teaching availability;
- certificates, completion evidence, learning materials;
- corporate training orders and learner support cases;
- tuition, registration, and course billing requests.

Learner, corporate client, instructor employee, and supplier identities reference Core master records. Academy owns enrollment and academic progress, not group HR employment records or payroll.

## Module map
1. Program and course catalog
2. Curriculum and learning materials
3. Cohort and class scheduling
4. Enrollment and admissions
5. Learner portal and progress
6. Instructor workspace
7. Attendance and assessments
8. Certificate issuance and verification
9. Corporate training / B2B CRM activity
10. Tuition and billing request
11. Academic analytics and reporting
12. Academy AI tutor with approved course-source grounding

## Main workflows
Program design -> course approval -> cohort creation -> registration -> payment/billing status -> learning delivery -> attendance/assessment -> completion -> certificate -> alumni follow-up.

## Database table families
`programs`, `courses`, `curriculum_versions`, `learning_modules`, `cohorts`, `class_sessions`, `enrollments`, `learner_profiles`, `attendance_records`, `assessments`, `assessment_results`, `certificates`, `instructor_assignments`, `training_orders`, `billing_requests`, `integration_outbox`, `integration_inbox`, `app_audit_events`.

## Integration
Consume Core organization, party, employee, entitlement, and finance posting status events. Send approved enrollment/course billing requests to Core. Core remains the system of record for journals and consolidated finance.

## Acceptance
Enrollment capacity is enforced; attendance and grades have change history; certificate identifiers are unique and verifiable; learner data access is scoped; refunds and billing reversals reconcile to Core.
