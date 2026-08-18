import React from 'react';
import { Link } from 'react-router-dom';

const capabilities = [
    {
        icon: 'event_available',
        title: 'Simple leave requests',
        text: 'Employees can request time off, check balances, and track every request from one place.',
    },
    {
        icon: 'groups',
        title: 'Manager-ready approvals',
        text: 'Managers get a clear view of upcoming absences, pending approvals, and team availability.',
    },
    {
        icon: 'analytics',
        title: 'Actionable HR insights',
        text: 'HR can understand absence trends, attendance patterns, leave utilization, and workforce health.',
    },
    {
        icon: 'account_tree',
        title: 'Connected workflows',
        text: 'Requests move through the right employee, manager, and HR workflow without disconnected tools.',
    },
];

const differentiators = [
    {
        number: '01',
        title: 'One connected absence experience',
        text: 'Leave requests, approvals, calendars, balances, and reporting are designed as one continuous workflow.',
    },
    {
        number: '02',
        title: 'Built around the people who use it',
        text: 'Employees get self-service. Managers get operational visibility. HR gets organization-wide control.',
    },
    {
        number: '03',
        title: 'Designed for better decisions',
        text: 'Instead of only recording leave, LeaveTrack helps teams understand availability and plan around absence.',
    },
];

const workflow = [
    {
        step: '01',
        title: 'Employee requests leave',
        text: 'Choose the leave type, dates, and reason.',
        icon: 'edit_calendar',
    },
    {
        step: '02',
        title: 'Manager reviews',
        text: 'Review the request against team availability and current workload.',
        icon: 'rule',
    },
    {
        step: '03',
        title: 'HR stays in control',
        text: 'HR sees organization-wide trends, records, and leave activity.',
        icon: 'admin_panel_settings',
    },
];

export function LandingPage() {
    return (
        <div className="min-h-screen bg-white text-[#0b2b4c] overflow-x-hidden">

            {/* ================================================================
          NAVIGATION
          ================================================================ */}

            <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-[#dbe5ee]">
                <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10">

                    <div className="h-[72px] flex items-center justify-between">

                        {/* Brand */}

                        <Link
                            to="/"
                            className="flex items-center gap-3"
                        >

                            <div className="w-10 h-10 rounded-xl bg-[#0875e1] flex items-center justify-center shadow-sm">
                                <span className="material-symbols-outlined text-white text-[22px]">
                                    calendar_clock
                                </span>
                            </div>

                            <div>
                                <div className="text-[19px] font-extrabold tracking-[-0.02em] text-[#082b4c]">
                                    LeaveTrack
                                </div>

                                <div className="hidden sm:block text-[9px] uppercase tracking-[0.16em] font-bold text-[#64778a]">
                                    Absence Management
                                </div>
                            </div>

                        </Link>


                        {/* Desktop navigation */}

                        <nav className="hidden md:flex items-center gap-8 text-[13px] font-semibold text-[#173b5c]">
                            <a
                                href="#capabilities"
                                className="hover:text-[#0875e1] transition-colors"
                            >
                                Capabilities
                            </a>

                            <a
                                href="#workflow"
                                className="hover:text-[#0875e1] transition-colors"
                            >
                                How it works
                            </a>

                            <a
                                href="#why-leavetrack"
                                className="hover:text-[#0875e1] transition-colors"
                            >
                                Why LeaveTrack
                            </a>
                        </nav>


                        {/* Demo CTA */}

                        <Link
                            to="/login"
                            className="inline-flex items-center gap-2 bg-[#0875e1] hover:bg-[#0665c4] text-white px-4 sm:px-5 py-2.5 rounded-lg text-[13px] font-bold shadow-sm transition-all"
                        >
                            Try Demo

                            <span className="material-symbols-outlined text-[17px]">
                                arrow_forward
                            </span>
                        </Link>

                    </div>

                </div>
            </header>


            {/* ================================================================
          HERO
          ================================================================ */}

            <main>

                <section className="relative overflow-hidden bg-[#f8fbff]">

                    {/* Decorative shapes */}

                    <div className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full bg-[#e8f3ff]" />

                    <div className="absolute top-[45%] -left-44 w-[360px] h-[360px] rounded-full bg-[#fff1e8]" />

                    <div className="absolute top-0 right-[24%] w-2 h-24 bg-[#f47b20] opacity-90" />

                    <div className="relative max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10">

                        <div className="grid lg:grid-cols-[1.08fr_0.92fr] gap-12 lg:gap-16 items-center min-h-[650px] py-16 lg:py-20">

                            {/* Hero copy */}

                            <div className="max-w-[700px]">

                                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#c9dff4] bg-white text-[#0875e1] text-[11px] font-bold uppercase tracking-[0.12em] mb-7">

                                    <span className="w-1.5 h-1.5 rounded-full bg-[#f47b20]" />

                                    Modern absence management

                                </div>


                                <h1 className="text-[42px] sm:text-[52px] lg:text-[64px] leading-[1.02] tracking-[-0.045em] font-extrabold text-[#082b4c]">

                                    Make time off
                                    <span className="text-[#0875e1]"> easier for everyone.</span>

                                </h1>


                                <p className="mt-7 max-w-[620px] text-[17px] sm:text-[19px] leading-8 text-[#486278]">

                                    LeaveTrack brings employee leave requests, manager approvals,
                                    team calendars, and HR insights together in one connected
                                    absence management experience.

                                </p>


                                <div className="mt-9 flex flex-col sm:flex-row gap-3">

                                    <Link
                                        to="/login"
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg bg-[#0875e1] hover:bg-[#0665c4] text-white text-sm font-bold shadow-md transition-all"
                                    >
                                        Try the demo

                                        <span className="material-symbols-outlined text-[18px]">
                                            arrow_forward
                                        </span>
                                    </Link>


                                    <a
                                        href="#capabilities"
                                        className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-lg border border-[#b9cbdc] bg-white hover:bg-[#f4f8fc] text-[#123a5b] text-sm font-bold transition-all"
                                    >
                                        Explore capabilities

                                        <span className="material-symbols-outlined text-[18px]">
                                            expand_more
                                        </span>
                                    </a>

                                </div>


                                {/* Trust line */}

                                <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] font-semibold text-[#687d91]">

                                    <span className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[#0875e1] text-[16px]">
                                            verified_user
                                        </span>
                                        Role-based access
                                    </span>

                                    <span className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[#0875e1] text-[16px]">
                                            database
                                        </span>
                                        Centralized workforce data
                                    </span>

                                    <span className="flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[#0875e1] text-[16px]">
                                            security
                                        </span>
                                        Secure workflows
                                    </span>

                                </div>

                            </div>


                            {/* Hero product preview */}

                            <div className="relative">

                                <div className="absolute -top-6 -right-4 w-24 h-24 bg-[#f47b20] rounded-[28px] opacity-90" />

                                <div className="absolute -bottom-8 -left-5 w-32 h-32 bg-[#dceeff] rounded-full" />


                                <div className="relative bg-white rounded-[24px] border border-[#d8e4ef] shadow-[0_24px_70px_rgba(8,43,76,0.13)] overflow-hidden">

                                    {/* Mock application header */}

                                    <div className="h-14 border-b border-[#e3eaf1] flex items-center justify-between px-5">

                                        <div className="flex items-center gap-2">

                                            <div className="w-7 h-7 rounded-lg bg-[#0875e1] flex items-center justify-center">
                                                <span className="material-symbols-outlined text-white text-[16px]">
                                                    calendar_clock
                                                </span>
                                            </div>

                                            <span className="text-xs font-bold text-[#123a5b]">
                                                LeaveTrack
                                            </span>

                                        </div>

                                        <div className="w-8 h-8 rounded-full bg-[#edf4fa] flex items-center justify-center">
                                            <span className="material-symbols-outlined text-[#5d7488] text-[17px]">
                                                person
                                            </span>
                                        </div>

                                    </div>


                                    <div className="p-5 sm:p-6">

                                        <div className="flex items-start justify-between gap-4">

                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider font-bold text-[#71859a]">
                                                    My absence
                                                </p>

                                                <h3 className="mt-1 text-xl font-extrabold text-[#082b4c]">
                                                    Good morning
                                                </h3>

                                                <p className="mt-1 text-xs text-[#6d8194]">
                                                    Here's your leave overview.
                                                </p>
                                            </div>

                                            <div className="px-2.5 py-1 rounded-full bg-[#e8f6ef] text-[#21864e] text-[10px] font-bold">
                                                8 days available
                                            </div>

                                        </div>


                                        {/* Mini metrics */}

                                        <div className="grid grid-cols-3 gap-2.5 mt-6">

                                            <div className="p-3 rounded-xl bg-[#f5f9fd] border border-[#e1ebf4]">
                                                <span className="material-symbols-outlined text-[#0875e1] text-[18px]">
                                                    beach_access
                                                </span>
                                                <p className="mt-2 text-[17px] font-extrabold text-[#082b4c]">
                                                    12
                                                </p>
                                                <p className="text-[9px] text-[#71859a]">
                                                    Annual
                                                </p>
                                            </div>

                                            <div className="p-3 rounded-xl bg-[#f5f9fd] border border-[#e1ebf4]">
                                                <span className="material-symbols-outlined text-[#0875e1] text-[18px]">
                                                    medical_services
                                                </span>
                                                <p className="mt-2 text-[17px] font-extrabold text-[#082b4c]">
                                                    6
                                                </p>
                                                <p className="text-[9px] text-[#71859a]">
                                                    Sick
                                                </p>
                                            </div>

                                            <div className="p-3 rounded-xl bg-[#f5f9fd] border border-[#e1ebf4]">
                                                <span className="material-symbols-outlined text-[#f47b20] text-[18px]">
                                                    pending_actions
                                                </span>
                                                <p className="mt-2 text-[17px] font-extrabold text-[#082b4c]">
                                                    1
                                                </p>
                                                <p className="text-[9px] text-[#71859a]">
                                                    Pending
                                                </p>
                                            </div>

                                        </div>


                                        {/* Upcoming leave */}

                                        <div className="mt-5 rounded-xl border border-[#e1ebf4] overflow-hidden">

                                            <div className="px-4 py-3 bg-[#f8fbfe] border-b border-[#e1ebf4] flex items-center justify-between">

                                                <span className="text-[10px] uppercase tracking-wider font-bold text-[#60778b]">
                                                    Upcoming absence
                                                </span>

                                                <span className="text-[10px] font-bold text-[#0875e1]">
                                                    View calendar
                                                </span>

                                            </div>

                                            <div className="px-4 py-3 flex items-center justify-between">

                                                <div className="flex items-center gap-3">

                                                    <div className="w-9 h-9 rounded-lg bg-[#fff0e7] text-[#f47b20] flex items-center justify-center">
                                                        <span className="material-symbols-outlined text-[18px]">
                                                            event
                                                        </span>
                                                    </div>

                                                    <div>
                                                        <p className="text-xs font-bold text-[#173b5c]">
                                                            Annual Leave
                                                        </p>
                                                        <p className="text-[10px] text-[#71859a]">
                                                            24 – 26 June
                                                        </p>
                                                    </div>

                                                </div>

                                                <span className="text-[10px] font-bold px-2 py-1 rounded-md bg-[#e8f6ef] text-[#21864e]">
                                                    Approved
                                                </span>

                                            </div>

                                        </div>


                                        {/* CTA */}

                                        <div className="mt-4 flex items-center justify-between gap-3 p-3 rounded-xl bg-[#082b4c]">

                                            <div className="flex items-center gap-2">

                                                <span className="material-symbols-outlined text-[#7fc4ff] text-[18px]">
                                                    add_circle
                                                </span>

                                                <span className="text-[10px] font-semibold text-white">
                                                    Need time off?
                                                </span>

                                            </div>

                                            <span className="text-[10px] font-bold text-white bg-[#0875e1] px-2.5 py-1.5 rounded-md">
                                                Request leave
                                            </span>

                                        </div>

                                    </div>

                                </div>

                            </div>

                        </div>

                    </div>

                </section>


                {/* ================================================================
            CAPABILITIES
            ================================================================ */}

                <section
                    id="capabilities"
                    className="py-20 sm:py-24 bg-white"
                >

                    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10">

                        <div className="max-w-[700px]">

                            <div className="flex items-center gap-3 mb-4">

                                <span className="w-12 h-1 bg-[#f47b20]" />

                                <span className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[#0875e1]">
                                    What you can do
                                </span>

                            </div>


                            <h2 className="text-[34px] sm:text-[44px] leading-[1.08] tracking-[-0.035em] font-extrabold text-[#082b4c]">
                                Manage absence without the administrative friction.
                            </h2>


                            <p className="mt-5 text-[16px] leading-7 text-[#5d7286]">
                                LeaveTrack gives every persona the right view of absence:
                                self-service for employees, operational visibility for managers,
                                and organization-wide control for HR.
                            </p>

                        </div>


                        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-12">

                            {capabilities.map(
                                (item) => (

                                    <div
                                        key={item.title}
                                        className="group p-6 rounded-2xl border border-[#dce7f0] bg-white hover:border-[#a9c8e5] hover:shadow-[0_12px_35px_rgba(8,43,76,0.08)] transition-all"
                                    >

                                        <div className="w-11 h-11 rounded-xl bg-[#edf6ff] text-[#0875e1] flex items-center justify-center group-hover:bg-[#0875e1] group-hover:text-white transition-colors">

                                            <span className="material-symbols-outlined text-[22px]">
                                                {item.icon}
                                            </span>

                                        </div>


                                        <h3 className="mt-6 text-[16px] font-extrabold text-[#082b4c]">
                                            {item.title}
                                        </h3>


                                        <p className="mt-3 text-[13px] leading-6 text-[#657b8f]">
                                            {item.text}
                                        </p>

                                    </div>

                                )
                            )}

                        </div>

                    </div>

                </section>


                {/* ================================================================
            WORKFLOW
            ================================================================ */}

                <section
                    id="workflow"
                    className="py-20 sm:py-24 bg-[#f7faff]"
                >

                    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10">

                        <div className="grid lg:grid-cols-[0.72fr_1.28fr] gap-14 items-start">

                            <div>

                                <div className="flex items-center gap-3 mb-4">

                                    <span className="w-12 h-1 bg-[#f47b20]" />

                                    <span className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[#0875e1]">
                                        How it works
                                    </span>

                                </div>


                                <h2 className="text-[34px] sm:text-[44px] leading-[1.08] tracking-[-0.035em] font-extrabold text-[#082b4c]">
                                    One workflow. Three perspectives.
                                </h2>


                                <p className="mt-5 text-[15px] leading-7 text-[#60768a]">
                                    The same absence request moves through the organization
                                    while each persona sees exactly what they need to act.
                                </p>


                                <Link
                                    to="/login"
                                    className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#0875e1] hover:text-[#0665c4]"
                                >
                                    Try the experience

                                    <span className="material-symbols-outlined text-[17px]">
                                        arrow_forward
                                    </span>
                                </Link>

                            </div>


                            <div className="space-y-3">

                                {workflow.map(
                                    (item) => (

                                        <div
                                            key={item.step}
                                            className="bg-white rounded-2xl border border-[#dce7f0] p-5 sm:p-6 flex gap-5 items-start"
                                        >

                                            <div className="shrink-0 w-12 h-12 rounded-xl bg-[#082b4c] text-white flex items-center justify-center">

                                                <span className="material-symbols-outlined text-[21px]">
                                                    {item.icon}
                                                </span>

                                            </div>


                                            <div className="flex-1">

                                                <div className="flex items-center gap-2">

                                                    <span className="text-[10px] font-extrabold text-[#f47b20] tracking-wider">
                                                        {item.step}
                                                    </span>

                                                    <span className="w-1 h-1 rounded-full bg-[#b8c6d3]" />

                                                    <h3 className="text-[15px] font-extrabold text-[#082b4c]">
                                                        {item.title}
                                                    </h3>

                                                </div>


                                                <p className="mt-2 text-[13px] leading-6 text-[#657b8f]">
                                                    {item.text}
                                                </p>

                                            </div>

                                        </div>

                                    )
                                )}

                            </div>

                        </div>

                    </div>

                </section>


                {/* ================================================================
            WHY LEAVETRACK
            ================================================================ */}

                <section
                    id="why-leavetrack"
                    className="py-20 sm:py-24 bg-white"
                >

                    <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10">

                        <div className="grid lg:grid-cols-[1fr_1fr] gap-14 lg:gap-20 items-center">

                            {/* Left visual */}

                            <div className="relative">

                                <div className="absolute -top-8 -left-8 w-20 h-20 bg-[#f47b20] rounded-2xl" />

                                <div className="relative bg-[#082b4c] rounded-[26px] p-7 sm:p-9 overflow-hidden shadow-[0_20px_60px_rgba(8,43,76,0.18)]">

                                    <div className="absolute -right-20 -top-20 w-52 h-52 rounded-full border-[34px] border-[#17476c]" />

                                    <div className="absolute -left-16 -bottom-20 w-48 h-48 rounded-full border-[30px] border-[#103b5d]" />


                                    <div className="relative">

                                        <p className="text-[10px] uppercase tracking-[0.16em] font-bold text-[#8fcaff]">
                                            Absence at a glance
                                        </p>

                                        <h3 className="mt-2 text-2xl font-extrabold text-white">
                                            Better visibility.
                                            <br />
                                            Better decisions.
                                        </h3>


                                        <div className="grid grid-cols-2 gap-3 mt-8">

                                            <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                                                <p className="text-3xl font-extrabold text-white">
                                                    94%
                                                </p>
                                                <p className="mt-1 text-[10px] text-[#a9c5db]">
                                                    Requests processed on time
                                                </p>
                                            </div>

                                            <div className="p-4 rounded-xl bg-white/10 border border-white/10">
                                                <p className="text-3xl font-extrabold text-white">
                                                    3
                                                </p>
                                                <p className="mt-1 text-[10px] text-[#a9c5db]">
                                                    Connected personas
                                                </p>
                                            </div>

                                        </div>


                                        <div className="mt-3 p-4 rounded-xl bg-white/10 border border-white/10">

                                            <div className="flex items-center justify-between">

                                                <span className="text-[10px] font-bold text-white">
                                                    Team availability
                                                </span>

                                                <span className="text-[10px] font-bold text-[#82d5a8]">
                                                    Healthy
                                                </span>

                                            </div>


                                            <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">

                                                <div className="h-full w-[78%] rounded-full bg-[#0875e1]" />

                                            </div>


                                            <div className="mt-2 flex justify-between text-[9px] text-[#a9c5db]">

                                                <span>Available</span>

                                                <span>On leave</span>

                                            </div>

                                        </div>

                                    </div>

                                </div>

                            </div>


                            {/* Right copy */}

                            <div>

                                <div className="flex items-center gap-3 mb-4">

                                    <span className="w-12 h-1 bg-[#f47b20]" />

                                    <span className="text-[11px] uppercase tracking-[0.14em] font-extrabold text-[#0875e1]">
                                        Why LeaveTrack
                                    </span>

                                </div>


                                <h2 className="text-[34px] sm:text-[44px] leading-[1.08] tracking-[-0.035em] font-extrabold text-[#082b4c]">
                                    More than a leave form.
                                    <br />
                                    A connected HCM workflow.
                                </h2>


                                <p className="mt-5 text-[15px] leading-7 text-[#60768a]">
                                    Traditional leave systems often stop when an employee
                                    submits a request. LeaveTrack keeps the workflow moving:
                                    the manager can review it, the team can plan around it,
                                    and HR can see the bigger workforce picture.
                                </p>


                                <div className="mt-8 space-y-5">

                                    {differentiators.map(
                                        (item) => (

                                            <div
                                                key={item.number}
                                                className="flex gap-4"
                                            >

                                                <div className="shrink-0 w-9 h-9 rounded-lg bg-[#fff1e8] text-[#f47b20] flex items-center justify-center text-[10px] font-extrabold">
                                                    {item.number}
                                                </div>


                                                <div>

                                                    <h3 className="text-[14px] font-extrabold text-[#082b4c]">
                                                        {item.title}
                                                    </h3>

                                                    <p className="mt-1.5 text-[13px] leading-6 text-[#657b8f]">
                                                        {item.text}
                                                    </p>

                                                </div>

                                            </div>

                                        )
                                    )}

                                </div>

                            </div>

                        </div>

                    </div>

                </section>


                {/* ================================================================
            FINAL CTA
            ================================================================ */}

                <section className="py-16 sm:py-20 bg-[#fff8f2] border-y border-[#f7dfca]">

                    <div className="max-w-[1000px] mx-auto px-5 sm:px-8 text-center">

                        <div className="flex justify-center mb-5">

                            <div className="w-12 h-12 rounded-xl bg-[#0875e1] text-white flex items-center justify-center shadow-sm">

                                <span className="material-symbols-outlined text-[24px]">
                                    calendar_month
                                </span>

                            </div>

                        </div>


                        <h2 className="text-[34px] sm:text-[46px] leading-[1.08] tracking-[-0.035em] font-extrabold text-[#082b4c]">
                            Make absence management
                            <span className="text-[#0875e1]"> work better.</span>
                        </h2>


                        <p className="mt-4 max-w-[650px] mx-auto text-[15px] leading-7 text-[#63778a]">
                            Give employees a simple self-service experience, managers
                            the visibility to make informed decisions, and HR the control
                            to keep the organization moving.
                        </p>


                        <Link
                            to="/login"
                            className="mt-8 inline-flex items-center gap-2 px-7 py-3.5 rounded-lg bg-[#0875e1] hover:bg-[#0665c4] text-white text-sm font-bold shadow-md transition-all"
                        >
                            Try the LeaveTrack demo

                            <span className="material-symbols-outlined text-[18px]">
                                arrow_forward
                            </span>
                        </Link>

                    </div>

                </section>

            </main>


            {/* ================================================================
          FOOTER
          ================================================================ */}

            <footer className="bg-[#082b4c] text-white">

                <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-10 py-10">

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">

                        <div className="flex items-center gap-3">

                            <div className="w-9 h-9 rounded-lg bg-[#0875e1] flex items-center justify-center">

                                <span className="material-symbols-outlined text-white text-[20px]">
                                    calendar_clock
                                </span>

                            </div>

                            <div>

                                <p className="text-sm font-extrabold">
                                    LeaveTrack
                                </p>

                                <p className="text-[10px] text-[#9bb3c8]">
                                    Enterprise absence management
                                </p>

                            </div>

                        </div>


                        <Link
                            to="/login"
                            className="text-xs font-bold text-[#8fcaff] hover:text-white transition-colors"
                        >
                            Try Demo →
                        </Link>

                    </div>


                    <div className="mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between gap-3">

                        <p className="text-[10px] text-[#8fa8bd]">
                            LeaveTrack • Workforce absence management demo
                        </p>

                        <p className="text-[10px] text-[#8fa8bd]">
                            Built for a connected HCM experience
                        </p>

                    </div>

                </div>

            </footer>

        </div>
    );
}

export default LandingPage;