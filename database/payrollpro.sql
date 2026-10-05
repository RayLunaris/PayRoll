--
-- PayrollPro - database dump (PostgreSQL 16)
--
-- Isi: skema lengkap (hasil semua migrasi Drizzle) + data awal dari seed
-- (super admin, departemen, jabatan, lokasi kerja, shift, BPJS, PPh 21, tarif lembur).
-- Tabel drizzle.__drizzle_migrations ikut disertakan, jadi `pnpm db:migrate`
-- setelah import tidak akan menjalankan ulang migrasi yang sudah ada.
--
-- Login default: admin@payrollpro.com / admin123  (segera ganti setelah login)
--
-- Import ke database kosong:
--   createdb -U postgres payrollpro
--   psql -U postgres -d payrollpro -f database/payrollpro.sql
--
-- Import ke container Docker:
--   docker exec -i payrollpro-postgres psql -U postgres -d payrollpro < database/payrollpro.sql
--
-- PostgreSQL database dump
--


-- Dumped from database version 16.15
-- Dumped by pg_dump version 16.15

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: drizzle; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA drizzle;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: __drizzle_migrations; Type: TABLE; Schema: drizzle; Owner: -
--

CREATE TABLE drizzle.__drizzle_migrations (
    id integer NOT NULL,
    hash text NOT NULL,
    created_at bigint
);


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE; Schema: drizzle; Owner: -
--

CREATE SEQUENCE drizzle.__drizzle_migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: drizzle; Owner: -
--

ALTER SEQUENCE drizzle.__drizzle_migrations_id_seq OWNED BY drizzle.__drizzle_migrations.id;


--
-- Name: abuse_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.abuse_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    abuse_type character varying(50) NOT NULL,
    description text,
    severity character varying(20),
    detected_at timestamp without time zone DEFAULT now(),
    is_resolved boolean DEFAULT false,
    resolved_by uuid,
    resolved_at timestamp without time zone
);


--
-- Name: announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title character varying(200) NOT NULL,
    content text NOT NULL,
    priority character varying(20) DEFAULT 'normal'::character varying,
    attachment_url text,
    created_by uuid,
    target_audience character varying(20) DEFAULT 'all'::character varying,
    target_id uuid,
    is_published boolean DEFAULT false,
    published_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: attendances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.attendances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    location_id uuid,
    date date NOT NULL,
    check_in timestamp without time zone,
    check_out timestamp without time zone,
    check_in_lat numeric(10,8),
    check_in_lng numeric(11,8),
    check_out_lat numeric(10,8),
    check_out_lng numeric(11,8),
    status character varying(20) DEFAULT 'present'::character varying,
    overtime_hours numeric(4,2) DEFAULT '0'::numeric,
    notes text,
    created_at timestamp without time zone DEFAULT now(),
    check_in_photo_url text
);


--
-- Name: bpjs_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bpjs_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    component character varying(50) NOT NULL,
    employee_rate numeric(5,2) NOT NULL,
    employer_rate numeric(5,2) NOT NULL,
    max_salary_cap numeric(15,2),
    is_active boolean DEFAULT true,
    effective_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: budgets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(150) NOT NULL,
    period_year integer NOT NULL,
    period_month integer,
    category character varying(30) NOT NULL,
    department_id uuid,
    allocated_amount numeric(15,2) NOT NULL,
    spent_amount numeric(15,2) DEFAULT 0.00 NOT NULL,
    notes text,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: cash_advances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cash_advances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    amount numeric(15,2) NOT NULL,
    reason text,
    month integer NOT NULL,
    year integer NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by uuid,
    approved_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    manager_id uuid,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: employee_shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    shift_id uuid,
    date date NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nip character varying(50) NOT NULL,
    full_name character varying(150) NOT NULL,
    department_id uuid,
    position_id uuid,
    location_id uuid,
    phone character varying(20),
    address text,
    birth_date date,
    join_date date NOT NULL,
    base_salary numeric(15,2) NOT NULL,
    npwp character varying(50),
    bank_name character varying(50),
    bank_account character varying(50),
    photo_url text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    marital_status character varying(20) DEFAULT 'TK/0'::character varying,
    dependents integer DEFAULT 0
);


--
-- Name: leave_quotas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leave_quotas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    leave_type character varying(30) NOT NULL,
    year integer NOT NULL,
    total_quota integer NOT NULL,
    used_quota integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: leaves; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leaves (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    leave_type character varying(30) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    reason text,
    attachment_url text,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by uuid,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: messages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.messages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sender_id uuid,
    receiver_id uuid,
    content text NOT NULL,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    title character varying(200) NOT NULL,
    message text NOT NULL,
    type character varying(30),
    reference_id uuid,
    is_read boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT now(),
    action_url character varying(255)
);


--
-- Name: overtime_rates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_rates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    multiplier numeric(3,2) NOT NULL,
    day_type character varying(20),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: overtime_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.overtime_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    date date NOT NULL,
    hours numeric(4,2) NOT NULL,
    reason text NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    approved_by uuid,
    approved_at timestamp without time zone,
    notes text,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(255) NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    used_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: payrolls; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payrolls (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    employee_id uuid,
    period_month integer NOT NULL,
    period_year integer NOT NULL,
    base_salary numeric(15,2) NOT NULL,
    overtime_pay numeric(15,2) DEFAULT '0'::numeric,
    allowances numeric(15,2) DEFAULT '0'::numeric,
    bpjs_employee numeric(15,2) DEFAULT '0'::numeric,
    bpjs_employer numeric(15,2) DEFAULT '0'::numeric,
    tax_deduction numeric(15,2) DEFAULT '0'::numeric,
    cash_advance numeric(15,2) DEFAULT '0'::numeric,
    other_deductions numeric(15,2) DEFAULT '0'::numeric,
    net_salary numeric(15,2) NOT NULL,
    status character varying(20) DEFAULT 'draft'::character varying,
    slip_url text,
    paid_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: position_salary_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.position_salary_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    position_id uuid NOT NULL,
    changed_by_user_id uuid NOT NULL,
    old_base_salary numeric(15,2) NOT NULL,
    new_base_salary numeric(15,2) NOT NULL,
    old_allowance numeric(15,2),
    new_allowance numeric(15,2),
    reason text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: positions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.positions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    base_salary numeric(15,2) NOT NULL,
    grade character varying(10),
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    code character varying(20),
    level_rank integer DEFAULT 1,
    min_salary numeric(15,2),
    max_salary numeric(15,2),
    position_allowance numeric(15,2) DEFAULT 0.00
);


--
-- Name: project_expenses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_expenses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    expense_title character varying(200) NOT NULL,
    category character varying(50) NOT NULL,
    amount numeric(15,2) NOT NULL,
    expense_date date NOT NULL,
    receipt_url text,
    submitted_by_user_id uuid NOT NULL,
    status character varying(20) DEFAULT 'approved'::character varying,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: project_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.project_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    employee_id uuid NOT NULL,
    role_in_project character varying(100) NOT NULL,
    allocation_percentage numeric(5,2) DEFAULT 100.00,
    assigned_monthly_cost numeric(15,2) NOT NULL,
    start_date date NOT NULL,
    end_date date,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(200) NOT NULL,
    client_name character varying(150),
    manager_user_id uuid,
    total_budget numeric(15,2) NOT NULL,
    labor_budget numeric(15,2) DEFAULT 0.00,
    operational_budget numeric(15,2) DEFAULT 0.00,
    spent_labor numeric(15,2) DEFAULT 0.00,
    spent_operational numeric(15,2) DEFAULT 0.00,
    start_date date NOT NULL,
    end_date date,
    status character varying(20) DEFAULT 'active'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: shift_swaps; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shift_swaps (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    requester_id uuid,
    target_id uuid,
    date date NOT NULL,
    status character varying(20) DEFAULT 'pending'::character varying,
    decided_by uuid,
    decided_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: shifts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.shifts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(50) NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: social_comments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid,
    user_id uuid,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: social_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid,
    user_id uuid,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: social_posts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.social_posts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    content text NOT NULL,
    attachment_url text,
    post_type character varying(20) DEFAULT 'feed'::character varying,
    forum_category character varying(50),
    likes_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: tax_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tax_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    bracket_from numeric(15,2) NOT NULL,
    bracket_to numeric(15,2),
    rate numeric(5,2) NOT NULL,
    fixed_amount numeric(15,2) DEFAULT '0'::numeric,
    is_active boolean DEFAULT true,
    effective_date date NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    role character varying(20) NOT NULL,
    employee_id uuid,
    is_active boolean DEFAULT true,
    last_login timestamp without time zone,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: work_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.work_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    address text,
    latitude numeric(10,8) NOT NULL,
    longitude numeric(11,8) NOT NULL,
    radius_meters integer DEFAULT 100,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now()
);


--
-- Name: __drizzle_migrations id; Type: DEFAULT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations ALTER COLUMN id SET DEFAULT nextval('drizzle.__drizzle_migrations_id_seq'::regclass);


--
-- Data for Name: __drizzle_migrations; Type: TABLE DATA; Schema: drizzle; Owner: -
--

COPY drizzle.__drizzle_migrations (id, hash, created_at) FROM stdin;
1	e357550595f443f9b63befac9f28f1bf590684e0f185381b1773547c0f8910fe	1789488613929
2	a2c3a9a781d25b67dc38b134db6a2704b47b4c93b513005497d72441f0e7983e	1789558508678
3	3fb93eee054c156be13ccdd8e5d4409a17c813a447151a9bbd4a643562d6f9d5	1789998223214
4	497ee33ddc079e21e6b607a1fcf5dd6306fb71fbe4d07e4c9763dc6bf12f0494	1790170282160
5	a526dc61e624206c68d865d6a2f6ceacc131a34a6c44bbf2086feedb77127b05	1790941365750
\.


--
-- Data for Name: abuse_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.abuse_logs (id, employee_id, abuse_type, description, severity, detected_at, is_resolved, resolved_by, resolved_at) FROM stdin;
\.


--
-- Data for Name: announcements; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.announcements (id, title, content, priority, attachment_url, created_by, target_audience, target_id, is_published, published_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: attendances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.attendances (id, employee_id, location_id, date, check_in, check_out, check_in_lat, check_in_lng, check_out_lat, check_out_lng, status, overtime_hours, notes, created_at, check_in_photo_url) FROM stdin;
\.


--
-- Data for Name: bpjs_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bpjs_config (id, component, employee_rate, employer_rate, max_salary_cap, is_active, effective_date, created_at) FROM stdin;
95b3f3bd-351e-4339-afd4-4434da07bfdd	JKK	0.00	0.24	\N	t	2024-01-01	2026-10-05 13:00:44.376863
b4d3a2b0-16c9-4a8e-be43-fc5afb969d06	JKM	0.00	0.30	\N	t	2024-01-01	2026-10-05 13:00:44.376863
44204006-fe1c-4bd9-b2b8-4ad8db1ff50b	JP	2.00	3.70	12000000.00	t	2024-01-01	2026-10-05 13:00:44.376863
0ae3473a-491f-4d9e-80ed-45fb505646cf	JHT	2.00	3.70	\N	t	2024-01-01	2026-10-05 13:00:44.376863
6deba24a-26e8-4905-b1ca-18f52d6fc948	BPJS_KES	1.00	4.00	\N	t	2024-01-01	2026-10-05 13:00:44.376863
\.


--
-- Data for Name: budgets; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.budgets (id, name, period_year, period_month, category, department_id, allocated_amount, spent_amount, notes, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: cash_advances; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cash_advances (id, employee_id, amount, reason, month, year, status, approved_by, approved_at, created_at) FROM stdin;
\.


--
-- Data for Name: departments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.departments (id, name, description, manager_id, created_at, updated_at) FROM stdin;
173c1169-860c-4c0a-885e-c5b9f513903b	Human Resources	HR Department	\N	2026-10-05 13:00:44.301923	2026-10-05 13:00:44.301923
c586093b-8890-44a0-96e1-930580043f92	Information Technology	IT Department	\N	2026-10-05 13:00:44.308709	2026-10-05 13:00:44.308709
504a0ed2-1006-4cda-9761-c057c1842542	Finance	Finance Department	\N	2026-10-05 13:00:44.315163	2026-10-05 13:00:44.315163
\.


--
-- Data for Name: employee_shifts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employee_shifts (id, employee_id, shift_id, date, created_at) FROM stdin;
\.


--
-- Data for Name: employees; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.employees (id, user_id, nip, full_name, department_id, position_id, location_id, phone, address, birth_date, join_date, base_salary, npwp, bank_name, bank_account, photo_url, is_active, created_at, updated_at, marital_status, dependents) FROM stdin;
2df82a4a-cc86-4d67-859f-7f47a5e6a860	6d1460d8-d84e-425d-8ccd-228718bee636	EMP001	Administrator	173c1169-860c-4c0a-885e-c5b9f513903b	3cb4a0b3-e391-4056-a016-89eaec674f7e	9a55a27d-7a5d-42c5-9ecc-8b501eff8fc6	\N	\N	\N	2024-01-01	15000000.00	\N	\N	\N	\N	t	2026-10-05 13:00:44.355324	2026-10-05 13:00:44.355324	TK/0	0
\.


--
-- Data for Name: leave_quotas; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leave_quotas (id, employee_id, leave_type, year, total_quota, used_quota, created_at) FROM stdin;
\.


--
-- Data for Name: leaves; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.leaves (id, employee_id, leave_type, start_date, end_date, reason, attachment_url, status, approved_by, approved_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.messages (id, sender_id, receiver_id, content, is_read, created_at) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, title, message, type, reference_id, is_read, created_at, action_url) FROM stdin;
\.


--
-- Data for Name: overtime_rates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.overtime_rates (id, name, multiplier, day_type, is_active, created_at) FROM stdin;
2c945c6a-85b0-43ca-a069-fb1502f3779d	Weekday	1.50	weekday	t	2026-10-05 13:00:44.39158
16466189-bfd5-40bf-9aae-6470e5e30f09	Weekend	2.00	weekend	t	2026-10-05 13:00:44.39158
0d40aef2-6092-488f-8f5a-63de46b94858	Holiday	3.00	holiday	t	2026-10-05 13:00:44.39158
\.


--
-- Data for Name: overtime_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.overtime_requests (id, employee_id, date, hours, reason, status, approved_by, approved_at, notes, created_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: payrolls; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payrolls (id, employee_id, period_month, period_year, base_salary, overtime_pay, allowances, bpjs_employee, bpjs_employer, tax_deduction, cash_advance, other_deductions, net_salary, status, slip_url, paid_at, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: position_salary_audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.position_salary_audit_logs (id, position_id, changed_by_user_id, old_base_salary, new_base_salary, old_allowance, new_allowance, reason, created_at) FROM stdin;
\.


--
-- Data for Name: positions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.positions (id, name, description, base_salary, grade, created_at, updated_at, code, level_rank, min_salary, max_salary, position_allowance) FROM stdin;
3cb4a0b3-e391-4056-a016-89eaec674f7e	Manager	Department Manager	15000000.00	Grade 4	2026-10-05 13:00:44.319299	2026-10-05 13:00:44.319299	MGR-01	4	12000000.00	20000000.00	2000000.00
bf83703d-4f55-475a-a215-f3792e70db84	Staff	Regular Staff	8000000.00	Grade 1	2026-10-05 13:00:44.319299	2026-10-05 13:00:44.319299	STF-01	1	6000000.00	10000000.00	500000.00
1b7160b2-a759-4675-9c62-f2b886693397	Admin	Administrative Staff	6000000.00	Grade 1	2026-10-05 13:00:44.319299	2026-10-05 13:00:44.319299	ADM-01	1	5000000.00	7500000.00	300000.00
\.


--
-- Data for Name: project_expenses; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_expenses (id, project_id, expense_title, category, amount, expense_date, receipt_url, submitted_by_user_id, status, created_at) FROM stdin;
\.


--
-- Data for Name: project_members; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.project_members (id, project_id, employee_id, role_in_project, allocation_percentage, assigned_monthly_cost, start_date, end_date, created_at) FROM stdin;
\.


--
-- Data for Name: projects; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.projects (id, code, name, client_name, manager_user_id, total_budget, labor_budget, operational_budget, spent_labor, spent_operational, start_date, end_date, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: shift_swaps; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shift_swaps (id, requester_id, target_id, date, status, decided_by, decided_at, created_at) FROM stdin;
\.


--
-- Data for Name: shifts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.shifts (id, name, start_time, end_time, created_at) FROM stdin;
702661c3-8a24-4ef6-8883-4b9b927dd531	Pagi	08:00:00	16:00:00	2026-10-05 13:00:44.368532
0eb86826-1593-4178-961c-d60b5f24ef8a	Siang	12:00:00	20:00:00	2026-10-05 13:00:44.368532
dc3c1f1c-96be-42b0-8ec7-7a9a167e506c	Malam	20:00:00	04:00:00	2026-10-05 13:00:44.368532
\.


--
-- Data for Name: social_comments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.social_comments (id, post_id, user_id, content, created_at) FROM stdin;
\.


--
-- Data for Name: social_likes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.social_likes (id, post_id, user_id, created_at) FROM stdin;
\.


--
-- Data for Name: social_posts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.social_posts (id, user_id, content, attachment_url, post_type, forum_category, likes_count, comments_count, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: tax_config; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.tax_config (id, bracket_from, bracket_to, rate, fixed_amount, is_active, effective_date, created_at) FROM stdin;
8e4fd7c1-b1b1-4fc7-a359-7ada89f4321b	0.00	60000000.00	5.00	0.00	t	2024-01-01	2026-10-05 13:00:44.384585
32ae84d4-95e5-4dca-9ae4-0a4e54baed72	60000000.00	250000000.00	15.00	3000000.00	t	2024-01-01	2026-10-05 13:00:44.384585
58d529be-c0b6-4003-a3af-e83c517ae27c	250000000.00	500000000.00	25.00	31500000.00	t	2024-01-01	2026-10-05 13:00:44.384585
6371b9b6-5ebb-4535-a27c-2aa4505bd4a4	500000000.00	5000000000.00	30.00	106500000.00	t	2024-01-01	2026-10-05 13:00:44.384585
88fa137e-839b-4583-9806-0b355b2e73b4	5000000000.00	\N	35.00	1606500000.00	t	2024-01-01	2026-10-05 13:00:44.384585
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, role, employee_id, is_active, last_login, created_at, updated_at) FROM stdin;
6d1460d8-d84e-425d-8ccd-228718bee636	admin@payrollpro.com	$2b$12$LtSgOcyEfT3n8ynUwWzGKuJR8kG9m5LaCE/bDGuvzID5e4varxuJa	super_admin	2df82a4a-cc86-4d67-859f-7f47a5e6a860	t	\N	2026-10-05 13:00:44.284066	2026-10-05 13:00:44.284066
\.


--
-- Data for Name: work_locations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.work_locations (id, name, address, latitude, longitude, radius_meters, created_at, updated_at) FROM stdin;
9a55a27d-7a5d-42c5-9ecc-8b501eff8fc6	Kantor 1	Kepatihan, Kec. Tulungagung, Kabupaten Tulungagung, Jawa Timur 66223	-8.06183880	111.91194720	100	2026-10-05 13:00:44.329266	2026-10-05 13:00:44.329266
109234ed-46c7-45c7-8e61-ae801d140805	Kantor 2	Balerejo, Kec. Kauman, Kabupaten Tulungagung, Jawa Timur 66215	-8.06128210	111.87387530	100	2026-10-05 13:00:44.329266	2026-10-05 13:00:44.329266
\.


--
-- Name: __drizzle_migrations_id_seq; Type: SEQUENCE SET; Schema: drizzle; Owner: -
--

SELECT pg_catalog.setval('drizzle.__drizzle_migrations_id_seq', 5, true);


--
-- Name: __drizzle_migrations __drizzle_migrations_pkey; Type: CONSTRAINT; Schema: drizzle; Owner: -
--

ALTER TABLE ONLY drizzle.__drizzle_migrations
    ADD CONSTRAINT __drizzle_migrations_pkey PRIMARY KEY (id);


--
-- Name: abuse_logs abuse_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abuse_logs
    ADD CONSTRAINT abuse_logs_pkey PRIMARY KEY (id);


--
-- Name: announcements announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_pkey PRIMARY KEY (id);


--
-- Name: attendances attendances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_pkey PRIMARY KEY (id);


--
-- Name: bpjs_config bpjs_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bpjs_config
    ADD CONSTRAINT bpjs_config_pkey PRIMARY KEY (id);


--
-- Name: budgets budgets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);


--
-- Name: cash_advances cash_advances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_advances
    ADD CONSTRAINT cash_advances_pkey PRIMARY KEY (id);


--
-- Name: departments departments_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_name_unique UNIQUE (name);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: employee_shifts employee_shifts_emp_date_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_emp_date_idx UNIQUE (employee_id, date);


--
-- Name: employee_shifts employee_shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_pkey PRIMARY KEY (id);


--
-- Name: employees employees_nip_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_nip_unique UNIQUE (nip);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: leave_quotas leave_quotas_emp_type_year_idx; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_quotas
    ADD CONSTRAINT leave_quotas_emp_type_year_idx UNIQUE (employee_id, leave_type, year);


--
-- Name: leave_quotas leave_quotas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_quotas
    ADD CONSTRAINT leave_quotas_pkey PRIMARY KEY (id);


--
-- Name: leaves leaves_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: overtime_rates overtime_rates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_rates
    ADD CONSTRAINT overtime_rates_pkey PRIMARY KEY (id);


--
-- Name: overtime_requests overtime_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payrolls payrolls_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_pkey PRIMARY KEY (id);


--
-- Name: position_salary_audit_logs position_salary_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_salary_audit_logs
    ADD CONSTRAINT position_salary_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: positions positions_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_code_unique UNIQUE (code);


--
-- Name: positions positions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.positions
    ADD CONSTRAINT positions_pkey PRIMARY KEY (id);


--
-- Name: project_expenses project_expenses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expenses
    ADD CONSTRAINT project_expenses_pkey PRIMARY KEY (id);


--
-- Name: project_members project_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_pkey PRIMARY KEY (id);


--
-- Name: projects projects_code_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_code_unique UNIQUE (code);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: shift_swaps shift_swaps_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swaps
    ADD CONSTRAINT shift_swaps_pkey PRIMARY KEY (id);


--
-- Name: shifts shifts_name_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_name_unique UNIQUE (name);


--
-- Name: shifts shifts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shifts
    ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);


--
-- Name: social_comments social_comments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_comments
    ADD CONSTRAINT social_comments_pkey PRIMARY KEY (id);


--
-- Name: social_likes social_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_likes
    ADD CONSTRAINT social_likes_pkey PRIMARY KEY (id);


--
-- Name: social_posts social_posts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_pkey PRIMARY KEY (id);


--
-- Name: tax_config tax_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tax_config
    ADD CONSTRAINT tax_config_pkey PRIMARY KEY (id);


--
-- Name: attendances unique_employee_date; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT unique_employee_date UNIQUE (employee_id, date);


--
-- Name: payrolls unique_employee_period; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT unique_employee_period UNIQUE (employee_id, period_month, period_year);


--
-- Name: users users_email_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_unique UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: work_locations work_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.work_locations
    ADD CONSTRAINT work_locations_pkey PRIMARY KEY (id);


--
-- Name: idx_attendances_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendances_date ON public.attendances USING btree (date);


--
-- Name: idx_attendances_location; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_attendances_location ON public.attendances USING btree (location_id);


--
-- Name: idx_employees_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_department ON public.employees USING btree (department_id);


--
-- Name: idx_employees_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_is_active ON public.employees USING btree (is_active);


--
-- Name: idx_employees_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employees_user_id ON public.employees USING btree (user_id);


--
-- Name: idx_payrolls_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payrolls_employee ON public.payrolls USING btree (employee_id);


--
-- Name: idx_payrolls_period; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payrolls_period ON public.payrolls USING btree (period_year, period_month);


--
-- Name: social_likes_post_user_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX social_likes_post_user_unique ON public.social_likes USING btree (post_id, user_id);


--
-- Name: abuse_logs abuse_logs_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abuse_logs
    ADD CONSTRAINT abuse_logs_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: abuse_logs abuse_logs_resolved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.abuse_logs
    ADD CONSTRAINT abuse_logs_resolved_by_users_id_fk FOREIGN KEY (resolved_by) REFERENCES public.users(id);


--
-- Name: announcements announcements_created_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.announcements
    ADD CONSTRAINT announcements_created_by_users_id_fk FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: attendances attendances_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: attendances attendances_location_id_work_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.attendances
    ADD CONSTRAINT attendances_location_id_work_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.work_locations(id);


--
-- Name: budgets budgets_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: cash_advances cash_advances_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_advances
    ADD CONSTRAINT cash_advances_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: cash_advances cash_advances_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cash_advances
    ADD CONSTRAINT cash_advances_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_shifts employee_shifts_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employee_shifts employee_shifts_shift_id_shifts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_shifts
    ADD CONSTRAINT employee_shifts_shift_id_shifts_id_fk FOREIGN KEY (shift_id) REFERENCES public.shifts(id);


--
-- Name: employees employees_department_id_departments_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_department_id_departments_id_fk FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: employees employees_location_id_work_locations_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_location_id_work_locations_id_fk FOREIGN KEY (location_id) REFERENCES public.work_locations(id);


--
-- Name: employees employees_position_id_positions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_position_id_positions_id_fk FOREIGN KEY (position_id) REFERENCES public.positions(id);


--
-- Name: employees employees_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: leave_quotas leave_quotas_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leave_quotas
    ADD CONSTRAINT leave_quotas_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: leaves leaves_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: leaves leaves_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leaves
    ADD CONSTRAINT leaves_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: messages messages_receiver_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_receiver_id_users_id_fk FOREIGN KEY (receiver_id) REFERENCES public.users(id);


--
-- Name: messages messages_sender_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_sender_id_users_id_fk FOREIGN KEY (sender_id) REFERENCES public.users(id);


--
-- Name: notifications notifications_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: overtime_requests overtime_requests_approved_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_approved_by_users_id_fk FOREIGN KEY (approved_by) REFERENCES public.users(id);


--
-- Name: overtime_requests overtime_requests_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.overtime_requests
    ADD CONSTRAINT overtime_requests_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: password_reset_tokens password_reset_tokens_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: payrolls payrolls_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payrolls
    ADD CONSTRAINT payrolls_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: position_salary_audit_logs position_salary_audit_logs_changed_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_salary_audit_logs
    ADD CONSTRAINT position_salary_audit_logs_changed_by_user_id_users_id_fk FOREIGN KEY (changed_by_user_id) REFERENCES public.users(id);


--
-- Name: position_salary_audit_logs position_salary_audit_logs_position_id_positions_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.position_salary_audit_logs
    ADD CONSTRAINT position_salary_audit_logs_position_id_positions_id_fk FOREIGN KEY (position_id) REFERENCES public.positions(id) ON DELETE CASCADE;


--
-- Name: project_expenses project_expenses_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expenses
    ADD CONSTRAINT project_expenses_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: project_expenses project_expenses_submitted_by_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_expenses
    ADD CONSTRAINT project_expenses_submitted_by_user_id_users_id_fk FOREIGN KEY (submitted_by_user_id) REFERENCES public.users(id);


--
-- Name: project_members project_members_employee_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_employee_id_employees_id_fk FOREIGN KEY (employee_id) REFERENCES public.employees(id) ON DELETE CASCADE;


--
-- Name: project_members project_members_project_id_projects_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.project_members
    ADD CONSTRAINT project_members_project_id_projects_id_fk FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE;


--
-- Name: projects projects_manager_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_manager_user_id_users_id_fk FOREIGN KEY (manager_user_id) REFERENCES public.users(id);


--
-- Name: shift_swaps shift_swaps_decided_by_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swaps
    ADD CONSTRAINT shift_swaps_decided_by_users_id_fk FOREIGN KEY (decided_by) REFERENCES public.users(id);


--
-- Name: shift_swaps shift_swaps_requester_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swaps
    ADD CONSTRAINT shift_swaps_requester_id_employees_id_fk FOREIGN KEY (requester_id) REFERENCES public.employees(id);


--
-- Name: shift_swaps shift_swaps_target_id_employees_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.shift_swaps
    ADD CONSTRAINT shift_swaps_target_id_employees_id_fk FOREIGN KEY (target_id) REFERENCES public.employees(id);


--
-- Name: social_comments social_comments_post_id_social_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_comments
    ADD CONSTRAINT social_comments_post_id_social_posts_id_fk FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;


--
-- Name: social_comments social_comments_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_comments
    ADD CONSTRAINT social_comments_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: social_likes social_likes_post_id_social_posts_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_likes
    ADD CONSTRAINT social_likes_post_id_social_posts_id_fk FOREIGN KEY (post_id) REFERENCES public.social_posts(id) ON DELETE CASCADE;


--
-- Name: social_likes social_likes_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_likes
    ADD CONSTRAINT social_likes_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: social_posts social_posts_user_id_users_id_fk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.social_posts
    ADD CONSTRAINT social_posts_user_id_users_id_fk FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- PostgreSQL database dump complete
--


