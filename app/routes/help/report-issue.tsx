import { useState, useRef } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/report-issue";

export function meta(_: Route.MetaArgs) {
    return [
        { title: "Report Issue · Kuvox Help Center" },
        {
            name: "description",
            content:
                "Report bugs, suggest features, or share feedback to help us improve Kuvox.",
        },
    ];
}

/* ── Types & Data ─────────────────────────────────────────────────────── */

interface Category {
    id: string;
    label: string;
    icon: string;
}

const CATEGORIES: Category[] = [
    { id: "bug", label: "Bug", icon: "bug_report" },
    { id: "feature", label: "Feature", icon: "lightbulb" },
    { id: "performance", label: "Performance", icon: "speed" },
    { id: "uiux", label: "UI/UX", icon: "palette" },
    { id: "other", label: "Other", icon: "more_horiz" },
];

interface Ticket {
    id: string;
    title: string;
    priority: string;
    date: string;
    status: "in-review" | "resolved" | "closed";
}

const MOCK_TICKETS: Ticket[] = [
    {
        id: "KVX-1024",
        title: "4K Export Hangs at 89%",
        priority: "High",
        date: "2 days ago",
        status: "in-review",
    },
    {
        id: "KVX-0988",
        title: "Feature: Audio Noise Reduction",
        priority: "Medium",
        date: "1 week ago",
        status: "resolved",
    },
    {
        id: "KVX-0912",
        title: "UI flicker in inspector panel",
        priority: "Low",
        date: "2 weeks ago",
        status: "closed",
    },
    {
        id: "KVX-0855",
        title: "Incorrect subtitle sync",
        priority: "Medium",
        date: "3 weeks ago",
        status: "resolved",
    },
];

const STATUS_CONFIG = {
    "in-review": { label: "IN REVIEW", color: "text-tertiary", dot: "bg-tertiary" },
    resolved: { label: "RESOLVED", color: "text-secondary", dot: "bg-secondary" },
    closed: { label: "CLOSED", color: "text-on-surface-variant", dot: "bg-on-surface-variant" },
} as const;

interface KnownIssue {
    title: string;
    status: "investigating" | "fix-in-progress" | "monitoring";
}

const KNOWN_ISSUES: KnownIssue[] = [
    { title: "Handwritten text recognition accuracy", status: "investigating" },
    { title: "Large PDF upload performance", status: "fix-in-progress" },
    { title: "Table structure detection inconsistency", status: "investigating" },
    { title: "Multi-page document export delay", status: "monitoring" },
    { title: "Special character recognition issues", status: "fix-in-progress" },
    { title: "Image rotation auto-correction errors", status: "investigating" },
    { title: "Mobile upload instability on some devices", status: "monitoring" },
];

const ISSUE_STATUS_CONFIG = {
    investigating: { label: "Investigating", emoji: "🟡" },
    "fix-in-progress": { label: "Fix in Progress", emoji: "🟠" },
    monitoring: { label: "Monitoring", emoji: "🟢" },
} as const;

function KnownIssueItem({ issue }: { issue: KnownIssue }) {
    const [open, setOpen] = useState(false);
    const cfg = ISSUE_STATUS_CONFIG[issue.status];

    return (
        <div className="p-3 rounded-xl bg-surface-container-low/50 border border-outline-variant/20 hover:border-outline-variant/40 transition-colors duration-200">
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="w-full flex items-start gap-3 text-left group"
            >
                <span className="text-sm shrink-0 mt-0.5">{cfg.emoji}</span>
                <div className="min-w-0 flex-grow pr-1">
                    <p className={`text-body-sm font-medium text-on-surface transition-colors duration-200 group-hover:text-primary ${open ? "" : "truncate"}`}>
                        {issue.title}
                    </p>
                    <p className="text-[11px] font-semibold text-on-surface-variant mt-0.5">
                        Status: {cfg.label}
                    </p>
                </div>
                <span
                    className={`material-symbols-outlined text-[18px] text-on-surface-variant shrink-0 mt-0.5 transition-transform duration-300 ${
                        open ? "rotate-180" : ""
                    }`}
                >
                    expand_more
                </span>
            </button>
        </div>
    );
}

/* ── Component ────────────────────────────────────────────────────────── */

export default function ReportIssue() {
    const [selectedCategory, setSelectedCategory] = useState("bug");
    const [isDragging, setIsDragging] = useState(false);
    const [submitState, setSubmitState] = useState<"idle" | "loading" | "success">("idle");
    const [contactPermission, setContactPermission] = useState(true);
    const formRef = useRef<HTMLFormElement>(null);

    function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (submitState !== "idle") return;

        setSubmitState("loading");
        setTimeout(() => {
            setSubmitState("success");
            setTimeout(() => {
                setSubmitState("idle");
                formRef.current?.reset();
            }, 2000);
        }, 1500);
    }

    return (
        <div className="w-full max-w-[1536px] mx-auto animate-fade-in-up px-6 lg:px-8">
            <main className="flex flex-col lg:flex-row gap-8 lg:gap-10">
                {/* ── Main Form Column ──────────────────────────────────────── */}
                <section className="flex-grow lg:max-w-[900px]">
                    {/* Hero */}
                    <div className="mb-10 text-center lg:text-left">
                        <div className="flex items-center gap-3 mb-4 justify-center lg:justify-start">
                            <div className="w-12 h-12 rounded-xl bg-primary-container/20 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-[28px]">
                                    bug_report
                                </span>
                            </div>
                            <h1 className="text-2xl sm:text-3xl lg:text-headline-lg font-semibold text-on-surface tracking-tight">
                                Report an Issue
                            </h1>
                        </div>
                        <p className="text-body-lg text-on-surface-variant max-w-2xl">
                            Help us improve Kuvox. Report bugs, suggest features, or share
                            feedback.
                        </p>
                    </div>

                    {/* Form */}
                    <form
                        ref={formRef}
                        onSubmit={handleSubmit}
                        className="glass rounded-2xl p-6 sm:p-8 space-y-8"
                    >
                        {/* ── Category Selector ──────────────────────────────────── */}
                        <div className="space-y-3">
                            <label className="text-label-md font-bold uppercase tracking-wider text-primary block">
                                Category
                            </label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                                {CATEGORIES.map((cat) => {
                                    const isActive = selectedCategory === cat.id;
                                    return (
                                        <button
                                            key={cat.id}
                                            type="button"
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`px-3 py-4 rounded-xl border text-[11px] font-semibold uppercase tracking-wide flex flex-col items-center gap-2 transition-all duration-200 ${isActive
                                                ? "border-primary bg-primary-container/10 text-primary"
                                                : "border-outline-variant bg-surface-container-low text-on-surface-variant hover:border-primary/50"
                                                }`}
                                        >
                                            <span className="material-symbols-outlined">{cat.icon}</span>
                                            {cat.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* ── Title Input ────────────────────────────────────────── */}
                        <div className="space-y-3">
                            <label
                                htmlFor="issue-title"
                                className="text-label-md font-bold uppercase tracking-wider text-primary block"
                            >
                                Descriptive Title
                            </label>
                            <input
                                id="issue-title"
                                type="text"
                                required
                                placeholder="Briefly describe the core problem"
                                className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-body-sm text-on-surface placeholder:text-outline outline-none transition-all duration-200"
                            />
                        </div>

                        {/* ── Description ────────────────────────────────────────── */}
                        <div className="space-y-3">
                            <label
                                htmlFor="issue-desc"
                                className="text-label-md font-bold uppercase tracking-wider text-primary block"
                            >
                                Detailed Description
                            </label>
                            <textarea
                                id="issue-desc"
                                rows={6}
                                required
                                placeholder="Please provide as much detail as possible. If this is a bug, please list the steps to reproduce it (e.g., 1. Open project, 2. Import 4K clip, 3. Press Play)."
                                className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-body-sm text-on-surface placeholder:text-outline outline-none transition-all duration-200 resize-none"
                            />
                        </div>

                        {/* ── File Upload ────────────────────────────────────────── */}
                        <div className="space-y-3">
                            <label className="text-label-md font-bold uppercase tracking-wider text-primary block">
                                Attachments
                            </label>
                            <div
                                onDragEnter={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragOver={(e) => {
                                    e.preventDefault();
                                    setIsDragging(true);
                                }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    setIsDragging(false);
                                }}
                                className={`border-2 border-dashed rounded-2xl py-12 flex flex-col items-center justify-center gap-4 transition-all duration-200 cursor-pointer group ${isDragging
                                    ? "border-primary bg-primary/5"
                                    : "border-outline-variant bg-surface-container-low hover:bg-surface-variant hover:border-primary/40"
                                    }`}
                            >
                                <div className="w-12 h-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-110 transition-transform duration-200">
                                    <span className="material-symbols-outlined text-3xl">
                                        upload_file
                                    </span>
                                </div>
                                <div className="text-center">
                                    <p className="text-body-sm font-semibold text-on-surface">
                                        Drag & drop files here
                                    </p>
                                    <p className="text-body-sm text-on-surface-variant">
                                        or{" "}
                                        <span className="text-primary font-semibold">
                                            browse files
                                        </span>{" "}
                                        from your computer
                                    </p>
                                </div>
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-outline">
                                    Maximum file size: 50MB (MP4, PNG, JPG, MOV)
                                </p>
                            </div>
                        </div>

                        {/* ── Priority & Contact Toggle ──────────────────────────── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* Priority */}
                            <div className="space-y-3">
                                <label
                                    htmlFor="priority"
                                    className="text-label-md font-bold uppercase tracking-wider text-primary block"
                                >
                                    Priority Level
                                </label>
                                <div className="relative">
                                    <select
                                        id="priority"
                                        defaultValue="Medium"
                                        className="w-full bg-surface-container-lowest border border-outline-variant focus:border-primary focus:ring-1 focus:ring-primary rounded-xl px-4 py-3 text-body-sm text-on-surface outline-none transition-all duration-200 appearance-none cursor-pointer"
                                    >
                                        <option>Low</option>
                                        <option>Medium</option>
                                        <option>High</option>
                                        <option>Critical (Prevents work)</option>
                                    </select>
                                    <span className="material-symbols-outlined text-on-surface-variant absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[20px]">
                                        expand_more
                                    </span>
                                </div>
                            </div>

                            {/* Contact toggle */}
                            <div className="flex items-center justify-between p-4 bg-surface-container-low rounded-xl border border-outline-variant">
                                <div className="space-y-1">
                                    <p className="text-body-sm font-semibold text-on-surface">
                                        Contact Permission
                                    </p>
                                    <p className="text-[11px] font-semibold text-on-surface-variant">
                                        Allow us to reach out for details.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    role="switch"
                                    aria-checked={contactPermission}
                                    onClick={() => setContactPermission(!contactPermission)}
                                    className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ease-in-out cursor-pointer ${contactPermission ? "bg-primary" : "bg-surface-variant"
                                        }`}
                                >
                                    <span
                                        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-md transform transition-transform duration-200 ease-in-out mt-0.5 ${contactPermission ? "translate-x-[22px]" : "translate-x-0.5"
                                            }`}
                                    />
                                </button>
                            </div>
                        </div>

                        {/* ── Submit Button ───────────────────────────────────────── */}
                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={submitState !== "idle"}
                                className={`w-full py-4 rounded-xl text-body-sm font-semibold flex items-center justify-center gap-3 transition-all duration-200 ${submitState === "success"
                                    ? "bg-secondary-container text-on-secondary-container"
                                    : "bg-primary-container text-on-primary-container hover:brightness-110 active:scale-[0.98]"
                                    } disabled:cursor-not-allowed`}
                            >
                                {submitState === "idle" && (
                                    <>
                                        <span className="material-symbols-outlined">send</span>
                                        Submit Report
                                    </>
                                )}
                                {submitState === "loading" && (
                                    <>
                                        <span className="material-symbols-outlined animate-spin">
                                            sync
                                        </span>
                                        Sending...
                                    </>
                                )}
                                {submitState === "success" && (
                                    <>
                                        <span className="material-symbols-outlined">
                                            check_circle
                                        </span>
                                        Report Received
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </section>

                {/* ── Sidebar ──────────────────────────────────────────────── */}
                <aside className="w-full lg:w-[260px] shrink-0 space-y-6">
                    {/* My Tickets */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-outline-variant/40 bg-surface-container-high/50 flex justify-between items-center">
                            <h3 className="text-body-sm font-semibold text-on-surface">
                                My Tickets
                            </h3>
                            <span className="bg-primary/20 text-primary px-2 py-0.5 rounded text-[10px] font-bold">
                                {MOCK_TICKETS.length} TOTAL
                            </span>
                        </div>

                        <div className="p-4 space-y-4 max-h-[500px] overflow-y-auto">
                            {MOCK_TICKETS.map((ticket, i) => {
                                const status = STATUS_CONFIG[ticket.status];
                                return (
                                    <div key={ticket.id}>
                                        {i > 0 && (
                                            <div className="h-px bg-outline-variant/30 mb-4" />
                                        )}
                                        <div className="group cursor-pointer">
                                            <div className="flex justify-between items-start mb-1">
                                                <span className="text-[10px] font-semibold bg-surface-variant px-1.5 py-0.5 rounded text-on-surface-variant uppercase">
                                                    {ticket.id}
                                                </span>
                                                <span
                                                    className={`flex items-center gap-1 text-[10px] font-semibold ${status.color}`}
                                                >
                                                    <span
                                                        className={`w-1.5 h-1.5 rounded-full ${status.dot}`}
                                                    />
                                                    {status.label}
                                                </span>
                                            </div>
                                            <h4 className="text-body-sm font-semibold text-on-surface group-hover:text-primary transition-colors duration-200 truncate">
                                                {ticket.title}
                                            </h4>
                                            <p className="text-[11px] font-semibold text-on-surface-variant">
                                                {ticket.date} • {ticket.priority} Priority
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <Link
                            to="#"
                            className="block p-4 text-center text-label-md font-semibold text-primary hover:bg-primary/5 transition-colors duration-200 border-t border-outline-variant/40"
                        >
                            View Full History
                        </Link>
                    </div>

                    {/* System Status */}
                    <div className="glass rounded-2xl p-6">
                        <h3 className="text-label-md font-bold uppercase tracking-wider text-primary mb-4">
                            System Status
                        </h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-body-sm text-on-surface">
                                    AI Processing
                                </span>
                                <span className="text-secondary text-[10px] uppercase font-bold">
                                    Operational
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body-sm text-on-surface">
                                    Cloud Rendering
                                </span>
                                <span className="text-secondary text-[10px] uppercase font-bold">
                                    Operational
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-body-sm text-on-surface">
                                    Support Response
                                </span>
                                <span className="text-tertiary text-[10px] uppercase font-bold">
                                    ~4 Hours
                                </span>
                            </div>
                        </div>
                    </div>


                    {/* Visual Accent */}
                    <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-surface-container-high to-tertiary/10" />
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(128,131,255,0.3),transparent_60%)]" />
                        <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-wider">
                                Powered by Kuvox AI
                            </p>
                            <p className="text-body-sm font-bold text-on-surface">
                                Dedicated Engineering Team
                            </p>
                        </div>
                    </div>
                </aside>

                {/* ── Sidebar 2 (Column 3) ──────────────────────────────────────────────── */}
                <aside className="w-full lg:w-[260px] shrink-0 space-y-6">
                    {/* Known Issues */}
                    <div className="glass rounded-2xl overflow-hidden">
                        <div className="p-5 border-b border-outline-variant/40 bg-surface-container-high/50 flex justify-between items-center">
                            <h3 className="text-body-sm font-semibold text-on-surface">
                                Known Issues
                            </h3>
                            <span className="bg-tertiary/20 text-tertiary px-2 py-0.5 rounded text-[10px] font-bold">
                                {KNOWN_ISSUES.length} ACTIVE
                            </span>
                        </div>

                        <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
                            {KNOWN_ISSUES.map((issue) => (
                                <KnownIssueItem key={issue.title} issue={issue} />
                            ))}
                        </div>
                    </div>
                </aside>
            </main>
        </div>
    );
}
