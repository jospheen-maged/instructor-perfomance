import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "https://esm.sh/react@18.3.1/jsx-runtime";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1";
import { useEffect, useMemo, useRef, useState } from "https://esm.sh/react@18.3.1";
import { Activity, AlertTriangle, BarChart3, CheckCircle2, ChevronDown, Clock3, Database, Download, FileSpreadsheet, Filter, Flag, Gauge, LayoutDashboard, Menu, RefreshCw, Search, Settings, ShieldCheck, Trash2, UploadCloud, Users, X, } from "https://esm.sh/lucide-react@0.462.0?deps=react@18.3.1";
import { Bar, BarChart, CartesianGrid, Cell, ComposedChart, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, } from "https://esm.sh/recharts@2.12.7?deps=react@18.3.1,react-dom@18.3.1";
const COLORS = {
    navy: "#0B234A",
    blue: "#1769E0",
    sky: "#5AA7FF",
    orange: "#FF8A1F",
    amber: "#F7B955",
    green: "#16A66A",
    red: "#E84C4F",
    purple: "#8157D9",
    slate: "#70809B",
    pale: "#EDF5FF",
};
const METRICS = ["Setup", "Attitude", "Preparation", "Curriculum", "Teaching", "Feedback"];
const REVIEW_REQUIRED = ["Tutor ID", "QC Name", "Review Date", "Review_Cycle", "Overall Score %"];
const OBJECTION_REQUIRED = ["Objection ID", "QC Reviewer", "Objection Created At", "Objection Status"];
const clean = (value) => String(value ?? "").trim();
const toNumber = (value) => {
    const parsed = Number.parseFloat(clean(value).replace("%", ""));
    return Number.isFinite(parsed) ? parsed : null;
};
const unique = (values) => Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b));
const average = (values) => {
    const valid = values.filter((v) => typeof v === "number" && Number.isFinite(v));
    return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : 0;
};
const pct = (part, total) => (total ? (part / total) * 100 : 0);
const formatPct = (value, digits = 1) => `${value.toFixed(digits)}%`;
const formatHours = (value) => {
    if (value === null || !Number.isFinite(value))
        return "—";
    if (value < 24)
        return `${value.toFixed(1)}h`;
    return `${(value / 24).toFixed(1)}d`;
};
const formatNumber = (value) => new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 }).format(value);
function parseDateValue(raw) {
    const value = clean(raw);
    if (!value)
        return null;
    const dmy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
    if (dmy) {
        const [, d, m, y, hh = "0", mm = "0"] = dmy;
        const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm));
        return Number.isNaN(date.getTime()) ? null : date;
    }
    const iso = new Date(value.replace(" ", "T"));
    return Number.isNaN(iso.getTime()) ? null : iso;
}
function hoursBetween(start, end) {
    const from = parseDateValue(start);
    const to = parseDateValue(end);
    if (!from || !to)
        return null;
    const hours = (to.getTime() - from.getTime()) / 3_600_000;
    return hours >= 0 ? hours : null;
}
function workingHoursBetween(start, end, excludedDays) {
    const from = parseDateValue(start);
    const to = parseDateValue(end);
    if (!from || !to || to.getTime() < from.getTime())
        return null;
    let total = 0;
    let cursor = new Date(from);
    while (cursor.getTime() < to.getTime()) {
        const nextDay = new Date(cursor);
        nextDay.setHours(24, 0, 0, 0);
        const segmentEnd = nextDay.getTime() < to.getTime() ? nextDay : to;
        if (!excludedDays.includes(cursor.getDay())) {
            total += (segmentEnd.getTime() - cursor.getTime()) / 3_600_000;
        }
        cursor = new Date(segmentEnd);
    }
    return total;
}
function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i += 1) {
        const char = text[i];
        const next = text[i + 1];
        if (char === '"') {
            if (inQuotes && next === '"') {
                field += '"';
                i += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
        }
        else if (char === "," && !inQuotes) {
            row.push(field);
            field = "";
        }
        else if ((char === "\n" || char === "\r") && !inQuotes) {
            if (char === "\r" && next === "\n")
                i += 1;
            row.push(field);
            if (row.some((cell) => cell.trim() !== ""))
                rows.push(row);
            row = [];
            field = "";
        }
        else {
            field += char;
        }
    }
    row.push(field);
    if (row.some((cell) => cell.trim() !== ""))
        rows.push(row);
    if (!rows.length)
        return [];
    const headers = rows[0].map((header, index) => {
        const normalized = header.replace(/^\uFEFF/, "").trim();
        return normalized || `Column ${index + 1}`;
    });
    return rows.slice(1).map((cells) => {
        const record = {};
        headers.forEach((header, index) => {
            record[header] = clean(cells[index] ?? "");
        });
        return record;
    });
}
function reviewKey(row) {
    return [row["Tutor ID"], row["Session Recording"] || row["Lesson Name"], row["Review Date"], row["QC Name"]]
        .map(clean)
        .join("|");
}
function objectionKey(row) {
    return clean(row["Objection ID"] || `${row["Quality Review ID"]}|${row["Objected Item"]}|${row["Objection Created At"]}`);
}
function mergeRows(current, incoming, kind) {
    const keyFn = kind === "reviews" ? reviewKey : objectionKey;
    const map = new Map(current.map((row) => [keyFn(row), row]));
    incoming.forEach((row) => map.set(keyFn(row), row));
    return Array.from(map.values());
}
const DB_NAME = "quality-operations-analytics";
const STORE_NAME = "datasets";
function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE_NAME))
                db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}
async function readDataset(key) {
    try {
        const db = await openDatabase();
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const request = tx.objectStore(STORE_NAME).get(key);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
        });
    }
    catch {
        return [];
    }
}
async function writeDataset(key, rows) {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).put(rows, key);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
async function clearDatasets() {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).clear();
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
}
function downloadText(filename, content, type = "text/csv;charset=utf-8") {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}
function rowsToCSV(rows) {
    if (!rows.length)
        return "";
    const headers = unique(rows.flatMap((row) => Object.keys(row)));
    const escape = (value) => {
        const text = clean(value);
        return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}
function groupBy(rows, keyFn) {
    return rows.reduce((acc, row) => {
        const key = keyFn(row) || "Unassigned";
        (acc[key] ||= []).push(row);
        return acc;
    }, {});
}
function isFlagged(row) {
    return Boolean(clean(row.Flags));
}
function normalizedOutcome(row) {
    return clean(row["Review Objection Outcome"] || row["Objection Outcome"] || row["Objection Status"] || "Unknown");
}
function isResolvedOutcome(outcome) {
    return !/in progress|pending|edu approved|qc approved|qc corrected|qc rejected/i.test(outcome);
}
function outcomeGroup(outcome) {
    const value = outcome.toLowerCase();
    if (value.includes("partial"))
        return "Partially Approved";
    if (value.includes("approved") || value.includes("accepted"))
        return "Approved";
    if (value.includes("reject"))
        return "Rejected";
    return "In Progress";
}
function getSlaHours(row, stage) {
    if (stage === "etl")
        return workingHoursBetween(row["Objection Created At"], row["ETL Decision At"], [4, 5]);
    if (stage === "qc")
        return workingHoursBetween(row["ETL Decision At"], row["QC Response At"], [5, 6]);
    return workingHoursBetween(row["QC Response At"], row["QTL Decision At"], [5, 6]);
}
function getRawSlaHours(row, stage) {
    const pairs = {
        etl: [row["Objection Created At"], row["ETL Decision At"]],
        qc: [row["ETL Decision At"], row["QC Response At"]],
        qtl: [row["QC Response At"], row["QTL Decision At"]],
    };
    const [start, end] = pairs[stage];
    const from = parseDateValue(start);
    const to = parseDateValue(end);
    return from && to ? (to.getTime() - from.getTime()) / 3_600_000 : null;
}
function slaSummary(rows, stage, limit) {
    const values = rows.map((row) => getSlaHours(row, stage)).filter((value) => value !== null);
    const within = values.filter((value) => value <= limit).length;
    return {
        total: values.length,
        within,
        breached: values.length - within,
        compliance: pct(within, values.length),
        average: average(values),
        median: values.length ? [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] : 0,
    };
}
function Badge({ children, tone = "blue" }) {
    const classes = {
        blue: "bg-blue-50 text-blue-700 ring-blue-100",
        green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
        orange: "bg-orange-50 text-orange-700 ring-orange-100",
        red: "bg-red-50 text-red-700 ring-red-100",
        slate: "bg-slate-100 text-slate-700 ring-slate-200",
    };
    return _jsx("span", { className: `inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${classes[tone]}`, children: children });
}
function StatCard({ label, value, note, icon, accent = "blue", }) {
    const iconClass = {
        blue: "bg-blue-50 text-blue-700",
        orange: "bg-orange-50 text-orange-700",
        green: "bg-emerald-50 text-emerald-700",
        red: "bg-red-50 text-red-700",
    }[accent];
    return (_jsx("div", { className: "rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md", children: _jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "text-sm font-medium text-slate-500", children: label }), _jsx("p", { className: "mt-2 text-3xl font-bold tracking-tight text-slate-950", children: value }), _jsx("p", { className: "mt-2 text-xs leading-5 text-slate-500", children: note })] }), _jsx("div", { className: `rounded-xl p-2.5 ${iconClass}`, children: icon })] }) }));
}
function Card({ title, subtitle, action, children, className = "" }) {
    return (_jsxs("section", { className: `rounded-2xl border border-slate-200/80 bg-white shadow-sm ${className}`, children: [_jsxs("div", { className: "flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4", children: [_jsxs("div", { children: [_jsx("h3", { className: "font-bold text-slate-900", children: title }), subtitle && _jsx("p", { className: "mt-1 text-sm text-slate-500", children: subtitle })] }), action] }), _jsx("div", { className: "p-5", children: children })] }));
}
function EmptyState({ onUpload }) {
    return (_jsx("div", { className: "mx-auto flex min-h-[62vh] max-w-3xl items-center justify-center px-4", children: _jsxs("div", { className: "w-full rounded-3xl border border-blue-100 bg-white p-8 text-center shadow-xl shadow-blue-950/5 md:p-12", children: [_jsx("div", { className: "mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white shadow-lg shadow-blue-600/20", children: _jsx(BarChart3, { size: 30 }) }), _jsx(Badge, { tone: "orange", children: "Monthly analytics workspace" }), _jsx("h2", { className: "mt-5 text-3xl font-bold tracking-tight text-slate-950", children: "Upload the two monthly exports" }), _jsx("p", { className: "mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-600", children: "Reviews and objections are analysed locally in this browser. Your raw CSV data is not sent to a server, and each new month can be merged with the saved history." }), _jsxs("button", { onClick: onUpload, className: "mt-7 inline-flex items-center gap-2 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800", children: [_jsx(UploadCloud, { size: 18 }), " Upload monthly exports"] }), _jsx("div", { className: "mt-8 grid gap-3 text-left sm:grid-cols-3", children: ["QC productivity & accuracy", "TL and team performance", "24 working-hour SLA by stage"].map((item) => (_jsxs("div", { className: "rounded-xl bg-slate-50 p-3 text-sm font-medium text-slate-700", children: [_jsx(CheckCircle2, { className: "mb-2 text-emerald-600", size: 17 }), " ", item] }, item))) })] }) }));
}
function UploadModal({ open, onClose, mode, setMode, onUpload, busy, }) {
    const reviewsRef = useRef(null);
    const objectionsRef = useRef(null);
    if (!open)
        return null;
    return (_jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm", children: _jsxs("div", { className: "max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white shadow-2xl", children: [_jsxs("div", { className: "flex items-start justify-between border-b border-slate-100 px-6 py-5", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-xl font-bold text-slate-950", children: "Import monthly exports" }), _jsx("p", { className: "mt-1 text-sm text-slate-500", children: "Upload reviews and objections separately. CSV files with multiline comments are supported." })] }), _jsx("button", { onClick: onClose, className: "rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700", children: _jsx(X, { size: 20 }) })] }), _jsxs("div", { className: "space-y-6 p-6", children: [_jsx("div", { className: "rounded-2xl bg-slate-50 p-2", children: _jsxs("div", { className: "grid grid-cols-2 gap-2", children: [_jsx("button", { onClick: () => setMode("merge"), className: `rounded-xl px-4 py-3 text-sm font-bold transition ${mode === "merge" ? "bg-white text-blue-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500"}`, children: "Add / update month" }), _jsx("button", { onClick: () => setMode("replace"), className: `rounded-xl px-4 py-3 text-sm font-bold transition ${mode === "replace" ? "bg-white text-orange-700 shadow-sm ring-1 ring-slate-200" : "text-slate-500"}`, children: "Replace dataset" })] }) }), _jsxs("div", { className: "grid gap-4 md:grid-cols-2", children: [_jsxs("button", { disabled: busy, onClick: () => reviewsRef.current?.click(), className: "group rounded-2xl border-2 border-dashed border-blue-200 bg-blue-50/40 p-7 text-left transition hover:border-blue-500 hover:bg-blue-50 disabled:opacity-50", children: [_jsx(FileSpreadsheet, { className: "text-blue-700", size: 28 }), _jsx("h3", { className: "mt-4 font-bold text-slate-900", children: "Quality reviews export" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-500", children: "Expected fields include QC Name, Review Cycle, Educational Team Lead and Overall Score." }), _jsxs("span", { className: "mt-4 inline-flex items-center gap-2 text-sm font-bold text-blue-700", children: ["Choose CSV ", _jsx(UploadCloud, { size: 16 })] })] }), _jsxs("button", { disabled: busy, onClick: () => objectionsRef.current?.click(), className: "group rounded-2xl border-2 border-dashed border-orange-200 bg-orange-50/40 p-7 text-left transition hover:border-orange-500 hover:bg-orange-50 disabled:opacity-50", children: [_jsx(FileSpreadsheet, { className: "text-orange-700", size: 28 }), _jsx("h3", { className: "mt-4 font-bold text-slate-900", children: "Quality objections export" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-500", children: "Expected fields include objection timestamps, actors, status, outcome and final score." }), _jsxs("span", { className: "mt-4 inline-flex items-center gap-2 text-sm font-bold text-orange-700", children: ["Choose CSV ", _jsx(UploadCloud, { size: 16 })] })] })] }), _jsx("input", { ref: reviewsRef, hidden: true, type: "file", accept: ".csv,text/csv", onChange: (event) => onUpload(event.target.files, "reviews") }), _jsx("input", { ref: objectionsRef, hidden: true, type: "file", accept: ".csv,text/csv", onChange: (event) => onUpload(event.target.files, "objections") }), _jsxs("div", { className: "flex items-start gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-900", children: [_jsx(ShieldCheck, { className: "mt-0.5 shrink-0", size: 18 }), _jsxs("p", { children: [_jsx("b", { children: "Private by design:" }), " imported records stay in IndexedDB on this device. The public website contains no internal data."] })] })] })] }) }));
}
function SelectFilter({ label, value, options, onChange }) {
    return (_jsxs("label", { className: "min-w-[150px] flex-1", children: [_jsx("span", { className: "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-slate-400", children: label }), _jsxs("div", { className: "relative", children: [_jsxs("select", { value: value, onChange: (event) => onChange(event.target.value), className: "w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-3 pr-9 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100", children: [_jsxs("option", { value: "", children: ["All ", label] }), options.map((option) => _jsx("option", { value: option, children: option }, option))] }), _jsx(ChevronDown, { className: "pointer-events-none absolute right-3 top-3 text-slate-400", size: 16 })] })] }));
}
function DataTable({ columns, rows, empty = "No records match the current filters." }) {
    return (_jsxs("div", { className: "overflow-x-auto", children: [_jsxs("table", { className: "min-w-full text-sm", children: [_jsx("thead", { children: _jsx("tr", { className: "border-b border-slate-200 bg-slate-50/80", children: columns.map((column) => _jsx("th", { className: `whitespace-nowrap px-4 py-3 text-[11px] font-bold uppercase tracking-wider text-slate-500 ${column.align === "right" ? "text-right" : "text-left"}`, children: column.label }, column.key)) }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: rows.map((row, index) => (_jsx("tr", { className: "transition hover:bg-blue-50/40", children: columns.map((column) => _jsx("td", { className: `whitespace-nowrap px-4 py-3.5 text-slate-700 ${column.align === "right" ? "text-right" : "text-left"}`, children: column.render ? column.render(row) : row[column.key] }, column.key)) }, row.id || row.name || index))) })] }), !rows.length && _jsx("div", { className: "p-10 text-center text-sm text-slate-500", children: empty })] }));
}
function SLAStageCard({ title, subtitle, summary, limit, icon, tone }) {
    const progress = Math.min(summary.compliance, 100);
    const toneClasses = {
        blue: { box: "bg-blue-50 text-blue-700", bar: "bg-blue-600" },
        orange: { box: "bg-orange-50 text-orange-700", bar: "bg-orange-500" },
        green: { box: "bg-emerald-50 text-emerald-700", bar: "bg-emerald-600" },
    }[tone];
    return (_jsxs("div", { className: "rounded-2xl border border-slate-200 bg-white p-5 shadow-sm", children: [_jsxs("div", { className: "flex items-start justify-between gap-3", children: [_jsxs("div", { children: [_jsx("p", { className: "font-bold text-slate-900", children: title }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: subtitle })] }), _jsx("div", { className: `rounded-xl p-2.5 ${toneClasses.box}`, children: icon })] }), _jsxs("div", { className: "mt-5 flex items-end justify-between gap-4", children: [_jsxs("div", { children: [_jsx("p", { className: "text-3xl font-bold text-slate-950", children: formatPct(summary.compliance) }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: [summary.within, " within ", limit, "h \u00B7 ", summary.breached, " breached"] })] }), _jsxs("div", { className: "text-right", children: [_jsx("p", { className: "text-xs font-semibold text-slate-400", children: "Average" }), _jsx("p", { className: "text-lg font-bold text-slate-800", children: formatHours(summary.average) })] })] }), _jsx("div", { className: "mt-4 h-2 overflow-hidden rounded-full bg-slate-100", children: _jsx("div", { className: `h-full rounded-full ${toneClasses.bar}`, style: { width: `${progress}%` } }) })] }));
}
function App() {
    const [view, setView] = useState("overview");
    const [reviews, setReviews] = useState([]);
    const [objections, setObjections] = useState([]);
    const [loaded, setLoaded] = useState(false);
    const [uploadOpen, setUploadOpen] = useState(false);
    const [mergeMode, setMergeMode] = useState("merge");
    const [busy, setBusy] = useState(false);
    const [mobileNav, setMobileNav] = useState(false);
    const [toast, setToast] = useState("");
    const [explorerKind, setExplorerKind] = useState("reviews");
    const [explorerSearch, setExplorerSearch] = useState("");
    const [sla, setSla] = useState(() => {
        const saved = localStorage.getItem("quality-sla-settings");
        return saved ? JSON.parse(saved) : { etl: 24, qc: 24, qtl: 24 };
    });
    const [filters, setFilters] = useState({ cycle: "", organization: "", qc: "", tl: "", source: "" });
    useEffect(() => {
        Promise.all([readDataset("reviews"), readDataset("objections")]).then(([savedReviews, savedObjections]) => {
            setReviews(savedReviews);
            setObjections(savedObjections);
            setLoaded(true);
        });
    }, []);
    useEffect(() => {
        localStorage.setItem("quality-sla-settings", JSON.stringify(sla));
    }, [sla]);
    useEffect(() => {
        if (!toast)
            return;
        const timer = window.setTimeout(() => setToast(""), 3500);
        return () => window.clearTimeout(timer);
    }, [toast]);
    const filterOptions = useMemo(() => ({
        cycles: unique([...reviews.map((row) => clean(row.Review_Cycle)), ...objections.map((row) => clean(row["Review Cycle"]))]),
        organizations: unique([...reviews.map((row) => clean(row.Organization_Name)), ...objections.map((row) => clean(row.Organization))]),
        qcs: unique([...reviews.map((row) => clean(row["QC Name"])), ...objections.map((row) => clean(row["QC Reviewer"]))]),
        tls: unique([...reviews.map((row) => clean(row.Educational_Team_Lead)), ...objections.map((row) => clean(row["Educational Team Lead (ETL)"]))]).filter((v) => v !== "--"),
        sources: unique(reviews.map((row) => clean(row.Review_Source))),
    }), [reviews, objections]);
    const filteredReviews = useMemo(() => reviews.filter((row) => {
        if (filters.cycle && clean(row.Review_Cycle) !== filters.cycle)
            return false;
        if (filters.organization && clean(row.Organization_Name) !== filters.organization)
            return false;
        if (filters.qc && clean(row["QC Name"]) !== filters.qc)
            return false;
        if (filters.tl && clean(row.Educational_Team_Lead) !== filters.tl)
            return false;
        if (filters.source && clean(row.Review_Source) !== filters.source)
            return false;
        return true;
    }), [reviews, filters]);
    const filteredObjections = useMemo(() => objections.filter((row) => {
        if (filters.cycle && clean(row["Review Cycle"]) !== filters.cycle)
            return false;
        if (filters.organization && clean(row.Organization) !== filters.organization)
            return false;
        if (filters.qc && clean(row["QC Reviewer"]) !== filters.qc)
            return false;
        if (filters.tl && clean(row["Educational Team Lead (ETL)"]) !== filters.tl)
            return false;
        return true;
    }), [objections, filters]);
    const reviewStats = useMemo(() => {
        const scores = filteredReviews.map((row) => toNumber(row["Overall Score %"]));
        const flagged = filteredReviews.filter(isFlagged).length;
        return {
            total: filteredReviews.length,
            tutors: new Set(filteredReviews.map((row) => clean(row["Tutor ID"])).filter(Boolean)).size,
            avg: average(scores),
            flagged,
            flagRate: pct(flagged, filteredReviews.length),
        };
    }, [filteredReviews]);
    const objectionStats = useMemo(() => {
        const grouped = filteredObjections.map((row) => outcomeGroup(normalizedOutcome(row)));
        const resolved = grouped.filter((outcome) => outcome !== "In Progress");
        const approved = resolved.filter((outcome) => outcome === "Approved" || outcome === "Partially Approved").length;
        return {
            total: filteredObjections.length,
            inProgress: grouped.filter((outcome) => outcome === "In Progress").length,
            approvalRate: pct(approved, resolved.length),
            resolved: resolved.length,
        };
    }, [filteredObjections]);
    const qcPerformance = useMemo(() => {
        const grouped = groupBy(filteredReviews, (row) => clean(row["QC Name"]));
        return Object.entries(grouped).map(([name, rows]) => {
            const related = filteredObjections.filter((row) => clean(row["QC Reviewer"]) === name);
            const qcSla = slaSummary(related, "qc", sla.qc);
            const outcomes = related.map((row) => outcomeGroup(normalizedOutcome(row)));
            const resolved = outcomes.filter((outcome) => outcome !== "In Progress");
            const approved = resolved.filter((outcome) => outcome !== "Rejected").length;
            const flags = rows.filter(isFlagged).length;
            return {
                name,
                reviews: rows.length,
                tutors: new Set(rows.map((row) => clean(row["Tutor ID"]))).size,
                avgScore: average(rows.map((row) => toNumber(row["Overall Score %"]))),
                flags,
                flagRate: pct(flags, rows.length),
                objections: related.length,
                objectionApproval: pct(approved, resolved.length),
                slaCompliance: qcSla.compliance,
                slaAverage: qcSla.average,
            };
        }).sort((a, b) => b.reviews - a.reviews);
    }, [filteredReviews, filteredObjections, sla.qc]);
    const tlPerformance = useMemo(() => {
        const grouped = groupBy(filteredReviews, (row) => clean(row.Educational_Team_Lead) || "Unassigned");
        return Object.entries(grouped).map(([name, rows]) => {
            const related = filteredObjections.filter((row) => clean(row["Educational Team Lead (ETL)"]) === name);
            const etlSla = slaSummary(related, "etl", sla.etl);
            const flags = rows.filter(isFlagged).length;
            return {
                name,
                reviews: rows.length,
                tutors: new Set(rows.map((row) => clean(row["Tutor ID"]))).size,
                avgScore: average(rows.map((row) => toNumber(row["Overall Score %"]))),
                flags,
                flagRate: pct(flags, rows.length),
                objections: related.length,
                slaCompliance: etlSla.compliance,
                slaAverage: etlSla.average,
            };
        }).sort((a, b) => b.reviews - a.reviews);
    }, [filteredReviews, filteredObjections, sla.etl]);
    const organizationPerformance = useMemo(() => {
        const grouped = groupBy(filteredReviews, (row) => clean(row.Organization_Name) || "Unassigned");
        return Object.entries(grouped).map(([name, rows]) => {
            const flags = rows.filter(isFlagged).length;
            return {
                name,
                reviews: rows.length,
                tutors: new Set(rows.map((row) => clean(row["Tutor ID"]))).size,
                avgScore: average(rows.map((row) => toNumber(row["Overall Score %"]))),
                flags,
                flagRate: pct(flags, rows.length),
                qcs: new Set(rows.map((row) => clean(row["QC Name"]))).size,
            };
        }).sort((a, b) => b.reviews - a.reviews);
    }, [filteredReviews]);
    const metricData = useMemo(() => METRICS.map((metric) => ({
        metric,
        score: average(filteredReviews.map((row) => {
            const value = toNumber(row[metric]);
            return value === null ? null : value * 20;
        })),
    })), [filteredReviews]);
    const scoreBands = useMemo(() => {
        const bands = [
            { name: "< 70", min: -Infinity, max: 70, count: 0 },
            { name: "70–79", min: 70, max: 80, count: 0 },
            { name: "80–89", min: 80, max: 90, count: 0 },
            { name: "90–94", min: 90, max: 95, count: 0 },
            { name: "95–100", min: 95, max: Infinity, count: 0 },
        ];
        filteredReviews.forEach((row) => {
            const score = toNumber(row["Overall Score %"]);
            if (score === null)
                return;
            const band = bands.find((item) => score >= item.min && score < item.max);
            if (band)
                band.count += 1;
        });
        return bands;
    }, [filteredReviews]);
    const reviewTrend = useMemo(() => {
        const grouped = {};
        filteredReviews.forEach((row) => {
            const date = parseDateValue(row["Review Date"]);
            if (!date)
                return;
            const key = `${String(date.getDate()).padStart(2, "0")}/${String(date.getMonth() + 1).padStart(2, "0")}`;
            grouped[key] ||= { count: 0, scores: [] };
            grouped[key].count += 1;
            const score = toNumber(row["Overall Score %"]);
            if (score !== null)
                grouped[key].scores.push(score);
        });
        return Object.entries(grouped).map(([date, data]) => ({ date, reviews: data.count, avgScore: average(data.scores) })).slice(-31);
    }, [filteredReviews]);
    const sourceData = useMemo(() => Object.entries(groupBy(filteredReviews, (row) => clean(row.Review_Source) || "Unknown")).map(([name, rows]) => ({ name, value: rows.length })), [filteredReviews]);
    const outcomeData = useMemo(() => Object.entries(groupBy(filteredObjections, (row) => outcomeGroup(normalizedOutcome(row)))).map(([name, rows]) => ({ name, value: rows.length })), [filteredObjections]);
    const slaETL = useMemo(() => slaSummary(filteredObjections, "etl", sla.etl), [filteredObjections, sla.etl]);
    const slaQC = useMemo(() => slaSummary(filteredObjections, "qc", sla.qc), [filteredObjections, sla.qc]);
    const slaQTL = useMemo(() => slaSummary(filteredObjections, "qtl", sla.qtl), [filteredObjections, sla.qtl]);
    const dataIssues = useMemo(() => {
        const negativeTimes = filteredObjections.filter((row) => ["etl", "qc", "qtl"].some((stage) => {
            const raw = getRawSlaHours(row, stage);
            return raw !== null && raw < 0;
        })).length;
        const missingResolution = filteredObjections.filter((row) => isResolvedOutcome(normalizedOutcome(row)) && !clean(row["Resolution Date"])).length;
        const missingTL = filteredReviews.filter((row) => !clean(row.Educational_Team_Lead) || clean(row.Educational_Team_Lead) === "--").length;
        const invalidScores = filteredReviews.filter((row) => toNumber(row["Overall Score %"]) === null).length;
        return { negativeTimes, missingResolution, missingTL, invalidScores, total: negativeTimes + missingResolution + missingTL + invalidScores };
    }, [filteredReviews, filteredObjections]);
    const insights = useMemo(() => {
        const items = [];
        if (qcPerformance.length > 1) {
            const max = qcPerformance[0];
            const min = [...qcPerformance].sort((a, b) => a.reviews - b.reviews)[0];
            const spread = max.reviews - min.reviews;
            items.push({ title: "Workload balance", text: `${max.name} has ${spread} more reviews than ${min.name} in the selected view.`, tone: spread > 30 ? "orange" : "green" });
            const highestFlag = [...qcPerformance].sort((a, b) => b.flagRate - a.flagRate)[0];
            items.push({ title: "Flag concentration", text: `${highestFlag.name} has the highest flagged-review rate at ${formatPct(highestFlag.flagRate)}.`, tone: highestFlag.flagRate > 30 ? "orange" : "blue" });
        }
        const stages = [
            { name: "TL / ETL", value: slaETL.compliance },
            { name: "QC", value: slaQC.compliance },
            { name: "QTL", value: slaQTL.compliance },
        ].filter((stage) => Number.isFinite(stage.value));
        if (stages.length) {
            const weakest = [...stages].sort((a, b) => a.value - b.value)[0];
            items.push({ title: "SLA priority", text: `${weakest.name} is the lowest-compliance stage at ${formatPct(weakest.value)}.`, tone: weakest.value < 70 ? "red" : "green" });
        }
        if (tlPerformance.length) {
            const lowest = [...tlPerformance].filter((row) => row.reviews >= 3).sort((a, b) => a.avgScore - b.avgScore)[0];
            if (lowest)
                items.push({ title: "Team watch", text: `${lowest.name} has the lowest average score at ${formatPct(lowest.avgScore)} across ${lowest.reviews} reviews.`, tone: lowest.avgScore < 90 ? "orange" : "blue" });
        }
        return items.slice(0, 4);
    }, [qcPerformance, tlPerformance, slaETL, slaQC, slaQTL]);
    const objectionDetails = useMemo(() => filteredObjections.map((row) => {
        const etlHours = getSlaHours(row, "etl");
        const qcHours = getSlaHours(row, "qc");
        const qtlHours = getSlaHours(row, "qtl");
        const overall = hoursBetween(row["Objection Created At"], row["Resolution Date"]);
        return {
            id: clean(row["Objection ID"]),
            tutor: clean(row["Tutor Name"]),
            qc: clean(row["QC Reviewer"]),
            tl: clean(row["Educational Team Lead (ETL)"]),
            type: clean(row["Objection Type"]),
            outcome: outcomeGroup(normalizedOutcome(row)),
            status: clean(row["Objection Status"]),
            etlHours,
            qcHours,
            qtlHours,
            overall,
            etlBreach: etlHours !== null && etlHours > sla.etl,
            qcBreach: qcHours !== null && qcHours > sla.qc,
            qtlBreach: qtlHours !== null && qtlHours > sla.qtl,
        };
    }).sort((a, b) => (b.overall || 0) - (a.overall || 0)), [filteredObjections, sla]);
    const explorerRows = useMemo(() => {
        const base = explorerKind === "reviews" ? filteredReviews : filteredObjections;
        const search = explorerSearch.trim().toLowerCase();
        if (!search)
            return base.slice(0, 250);
        return base.filter((row) => Object.values(row).some((value) => clean(value).toLowerCase().includes(search))).slice(0, 250);
    }, [explorerKind, filteredReviews, filteredObjections, explorerSearch]);
    async function handleUpload(files, kind) {
        if (!files?.length)
            return;
        setBusy(true);
        try {
            const text = await files[0].text();
            const parsed = parseCSV(text);
            const required = kind === "reviews" ? REVIEW_REQUIRED : OBJECTION_REQUIRED;
            const missing = required.filter((field) => !parsed.length || !(field in parsed[0]));
            if (missing.length)
                throw new Error(`Missing columns: ${missing.join(", ")}`);
            const current = kind === "reviews" ? reviews : objections;
            const next = mergeMode === "replace" ? parsed : mergeRows(current, parsed, kind);
            if (kind === "reviews")
                setReviews(next);
            else
                setObjections(next);
            await writeDataset(kind, next);
            setToast(`${files[0].name}: ${parsed.length} rows imported. ${next.length} total saved.`);
        }
        catch (error) {
            setToast(error instanceof Error ? error.message : "The CSV could not be imported.");
        }
        finally {
            setBusy(false);
        }
    }
    function resetFilters() {
        setFilters({ cycle: "", organization: "", qc: "", tl: "", source: "" });
    }
    async function clearAll() {
        if (!window.confirm("Delete all imported reviews and objections from this browser?"))
            return;
        await clearDatasets();
        setReviews([]);
        setObjections([]);
        resetFilters();
        setToast("All locally saved data was removed.");
    }
    const navItems = [
        { key: "overview", label: "Executive Overview", icon: _jsx(LayoutDashboard, { size: 18 }) },
        { key: "qc", label: "QC Analytics", icon: _jsx(Users, { size: 18 }) },
        { key: "teams", label: "TL & Teams", icon: _jsx(Activity, { size: 18 }) },
        { key: "objections", label: "Objections & SLA", icon: _jsx(Clock3, { size: 18 }) },
        { key: "explorer", label: "Data Explorer", icon: _jsx(Database, { size: 18 }) },
        { key: "settings", label: "Settings", icon: _jsx(Settings, { size: 18 }) },
    ];
    const titles = {
        overview: { title: "Executive Overview", subtitle: "Monthly quality health, coverage, scoring and operational alerts" },
        qc: { title: "QC Analytics", subtitle: "Productivity, review patterns, flags, objections and response SLA" },
        teams: { title: "TL & Team Analytics", subtitle: "Tutor coverage and performance by educational team lead and organization" },
        objections: { title: "Objections & SLA", subtitle: "Stage-by-stage accountability for TL / ETL, QC and QTL decisions" },
        explorer: { title: "Data Explorer", subtitle: "Search, inspect and export the currently filtered raw records" },
        settings: { title: "Workspace Settings", subtitle: "Configure SLA targets and manage locally stored monthly data" },
    };
    if (!loaded)
        return _jsx("div", { className: "flex min-h-screen items-center justify-center bg-slate-50", children: _jsx(RefreshCw, { className: "animate-spin text-blue-700" }) });
    const hasData = reviews.length > 0 || objections.length > 0;
    return (_jsxs("div", { className: "min-h-screen bg-[#F5F8FC] text-slate-900", children: [_jsx(UploadModal, { open: uploadOpen, onClose: () => setUploadOpen(false), mode: mergeMode, setMode: setMergeMode, onUpload: handleUpload, busy: busy }), toast && _jsx("div", { className: "fixed bottom-5 right-5 z-[60] max-w-md rounded-xl bg-slate-950 px-4 py-3 text-sm font-medium text-white shadow-2xl", children: toast }), _jsx("aside", { className: `fixed inset-y-0 left-0 z-40 w-72 transform bg-[#0B234A] text-white shadow-2xl transition-transform lg:translate-x-0 ${mobileNav ? "translate-x-0" : "-translate-x-full"}`, children: _jsxs("div", { className: "flex h-full flex-col", children: [_jsx("div", { className: "border-b border-white/10 p-6", children: _jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-lg font-black shadow-lg", children: "iS" }), _jsxs("div", { children: [_jsx("p", { className: "text-base font-bold", children: "Quality Intelligence" }), _jsx("p", { className: "text-xs text-blue-200", children: "Operations Analytics Board" })] }), _jsx("button", { onClick: () => setMobileNav(false), className: "ml-auto rounded-lg p-1.5 text-blue-200 hover:bg-white/10 lg:hidden", children: _jsx(X, { size: 19 }) })] }) }), _jsxs("nav", { className: "flex-1 space-y-1 overflow-y-auto p-4", children: [_jsx("p", { className: "px-3 pb-2 pt-2 text-[10px] font-bold uppercase tracking-[0.2em] text-blue-300/70", children: "Analytics" }), navItems.map((item) => (_jsxs("button", { onClick: () => { setView(item.key); setMobileNav(false); }, className: `flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${view === item.key ? "bg-white text-blue-900 shadow-lg" : "text-blue-100 hover:bg-white/10 hover:text-white"}`, children: [item.icon, _jsx("span", { children: item.label })] }, item.key)))] }), _jsxs("div", { className: "m-4 rounded-2xl border border-white/10 bg-white/5 p-4", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-bold", children: [_jsx(ShieldCheck, { size: 17, className: "text-emerald-300" }), " Local data protection"] }), _jsx("p", { className: "mt-2 text-xs leading-5 text-blue-200", children: "CSV records are processed and saved only inside this browser." })] })] }) }), _jsxs("main", { className: "lg:pl-72", children: [_jsx("header", { className: "sticky top-0 z-30 border-b border-slate-200/80 bg-white/90 px-4 py-4 backdrop-blur-xl md:px-7", children: _jsxs("div", { className: "flex items-center justify-between gap-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("button", { onClick: () => setMobileNav(true), className: "rounded-xl border border-slate-200 p-2.5 text-slate-600 lg:hidden", children: _jsx(Menu, { size: 20 }) }), _jsxs("div", { children: [_jsx("h1", { className: "text-xl font-bold tracking-tight text-slate-950 md:text-2xl", children: titles[view].title }), _jsx("p", { className: "mt-0.5 hidden text-sm text-slate-500 sm:block", children: titles[view].subtitle })] })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsxs("button", { onClick: () => window.print(), className: "hidden items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 sm:flex", children: [_jsx(Download, { size: 17 }), " PDF"] }), _jsxs("button", { onClick: () => setUploadOpen(true), className: "inline-flex items-center gap-2 rounded-xl bg-blue-700 px-3.5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 hover:bg-blue-800", children: [_jsx(UploadCloud, { size: 17 }), " Upload data"] })] })] }) }), !hasData ? _jsx(EmptyState, { onUpload: () => setUploadOpen(true) }) : (_jsxs("div", { className: "space-y-6 p-4 md:p-7", children: [view !== "settings" && (_jsxs("div", { className: "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm", children: [_jsxs("div", { className: "mb-3 flex flex-wrap items-center justify-between gap-3", children: [_jsxs("div", { className: "flex items-center gap-2 text-sm font-bold text-slate-700", children: [_jsx(Filter, { size: 17, className: "text-blue-700" }), " Global filters"] }), _jsx("button", { onClick: resetFilters, className: "text-xs font-bold text-blue-700 hover:text-blue-900", children: "Reset all" })] }), _jsxs("div", { className: "flex flex-wrap gap-3", children: [_jsx(SelectFilter, { label: "Cycles", value: filters.cycle, options: filterOptions.cycles, onChange: (value) => setFilters((prev) => ({ ...prev, cycle: value })) }), _jsx(SelectFilter, { label: "Organizations", value: filters.organization, options: filterOptions.organizations, onChange: (value) => setFilters((prev) => ({ ...prev, organization: value })) }), _jsx(SelectFilter, { label: "QCs", value: filters.qc, options: filterOptions.qcs, onChange: (value) => setFilters((prev) => ({ ...prev, qc: value })) }), _jsx(SelectFilter, { label: "TLs", value: filters.tl, options: filterOptions.tls, onChange: (value) => setFilters((prev) => ({ ...prev, tl: value })) }), _jsx(SelectFilter, { label: "Sources", value: filters.source, options: filterOptions.sources, onChange: (value) => setFilters((prev) => ({ ...prev, source: value })) })] })] })), view === "overview" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Reviewed Sessions", value: formatNumber(reviewStats.total), note: `${formatNumber(reviewStats.tutors)} unique tutors covered`, icon: _jsx(FileSpreadsheet, { size: 21 }) }), _jsx(StatCard, { label: "Average Quality Score", value: formatPct(reviewStats.avg), note: "Across all filtered reviews", icon: _jsx(Gauge, { size: 21 }), accent: "green" }), _jsx(StatCard, { label: "Flagged Reviews", value: formatNumber(reviewStats.flagged), note: `${formatPct(reviewStats.flagRate)} of reviewed sessions`, icon: _jsx(Flag, { size: 21 }), accent: "orange" }), _jsx(StatCard, { label: "Objection Approval", value: formatPct(objectionStats.approvalRate), note: `${objectionStats.inProgress} currently in progress`, icon: _jsx(CheckCircle2, { size: 21 }), accent: objectionStats.approvalRate > 50 ? "orange" : "blue" })] }), insights.length > 0 && (_jsx("div", { className: "grid gap-3 md:grid-cols-2 xl:grid-cols-4", children: insights.map((item) => {
                                            const styles = { blue: "border-blue-100 bg-blue-50/70 text-blue-900", orange: "border-orange-100 bg-orange-50/80 text-orange-900", red: "border-red-100 bg-red-50/80 text-red-900", green: "border-emerald-100 bg-emerald-50/80 text-emerald-900" }[item.tone];
                                            return _jsxs("div", { className: `rounded-2xl border p-4 ${styles}`, children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider opacity-70", children: item.title }), _jsx("p", { className: "mt-2 text-sm font-semibold leading-6", children: item.text })] }, item.title);
                                        }) })), _jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsx(Card, { title: "Review volume by QC", subtitle: "Workload distribution for the selected cycle and filters", children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: qcPerformance, margin: { left: -20, right: 10 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E8EDF5" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11 }, interval: 0, angle: -12, textAnchor: "end", height: 70 }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "reviews", name: "Reviews", fill: COLORS.blue, radius: [7, 7, 0, 0] })] }) }) }) }), _jsx(Card, { title: "Quality metric averages", subtitle: "Each metric converted from 5-point scale to percentage", children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: metricData, layout: "vertical", margin: { left: 10, right: 25 }, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", horizontal: false, stroke: "#E8EDF5" }), _jsx(XAxis, { type: "number", domain: [0, 100], tick: { fontSize: 11 } }), _jsx(YAxis, { type: "category", dataKey: "metric", width: 85, tick: { fontSize: 11 } }), _jsx(Tooltip, { formatter: (value) => formatPct(value) }), _jsx(Bar, { dataKey: "score", name: "Average", fill: COLORS.orange, radius: [0, 7, 7, 0] })] }) }) }) }), _jsx(Card, { title: "Review activity trend", subtitle: "Daily review submissions and average score", children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(LineChart, { data: reviewTrend, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E8EDF5" }), _jsx(XAxis, { dataKey: "date", tick: { fontSize: 11 } }), _jsx(YAxis, { yAxisId: "left", tick: { fontSize: 11 } }), _jsx(YAxis, { yAxisId: "right", orientation: "right", domain: [0, 100], tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Line, { yAxisId: "left", type: "monotone", dataKey: "reviews", stroke: COLORS.blue, strokeWidth: 3, dot: false }), _jsx(Line, { yAxisId: "right", type: "monotone", dataKey: "avgScore", stroke: COLORS.orange, strokeWidth: 3, dot: false })] }) }) }) }), _jsx(Card, { title: "Score distribution", subtitle: "Spot score inflation, outliers and low-performing reviews", children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: scoreBands, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E8EDF5" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11 } }), _jsx(YAxis, { tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Bar, { dataKey: "count", name: "Reviews", fill: COLORS.navy, radius: [7, 7, 0, 0] })] }) }) }) })] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-3", children: [_jsx(Card, { title: "Review sources", subtitle: "Automatic, manual and change-request mix", className: "xl:col-span-1", children: _jsx("div", { className: "h-64", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: sourceData, dataKey: "value", nameKey: "name", innerRadius: 55, outerRadius: 90, paddingAngle: 3, children: sourceData.map((_, index) => _jsx(Cell, { fill: [COLORS.blue, COLORS.orange, COLORS.green, COLORS.purple, COLORS.slate][index % 5] }, index)) }), _jsx(Tooltip, {}), _jsx(Legend, {})] }) }) }) }), _jsx(Card, { title: "SLA snapshot", subtitle: "Current compliance against 24 working-hour role targets", className: "xl:col-span-2", children: _jsx("div", { className: "grid gap-4 sm:grid-cols-3", children: [{ label: "TL / ETL", data: slaETL, limit: sla.etl, color: "bg-blue-600" }, { label: "QC", data: slaQC, limit: sla.qc, color: "bg-orange-500" }, { label: "QTL (You)", data: slaQTL, limit: sla.qtl, color: "bg-emerald-600" }].map((stage) => (_jsxs("div", { className: "rounded-xl bg-slate-50 p-4", children: [_jsx("p", { className: "text-sm font-bold text-slate-800", children: stage.label }), _jsx("p", { className: "mt-3 text-3xl font-bold text-slate-950", children: formatPct(stage.data.compliance) }), _jsxs("p", { className: "mt-1 text-xs text-slate-500", children: ["Average ", formatHours(stage.data.average), " \u00B7 target ", stage.limit, "h"] }), _jsx("div", { className: "mt-4 h-2 overflow-hidden rounded-full bg-white", children: _jsx("div", { className: `h-full ${stage.color}`, style: { width: `${Math.min(stage.data.compliance, 100)}%` } }) })] }, stage.label))) }) })] }), dataIssues.total > 0 && _jsxs("div", { className: "flex flex-wrap items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950", children: [_jsx(AlertTriangle, { className: "mt-0.5 shrink-0", size: 19 }), _jsxs("div", { children: [_jsxs("p", { className: "font-bold", children: ["Data quality checks found ", dataIssues.total, " items."] }), _jsxs("p", { className: "mt-1 text-xs leading-5", children: [dataIssues.negativeTimes, " reversed timestamps \u00B7 ", dataIssues.missingResolution, " missing resolution dates \u00B7 ", dataIssues.missingTL, " unassigned TL reviews \u00B7 ", dataIssues.invalidScores, " invalid scores. Reversed durations are excluded from SLA calculations."] })] })] })] })), view === "qc" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Active Reviewers", value: formatNumber(qcPerformance.length), note: "QCs with reviews in the selected view", icon: _jsx(Users, { size: 21 }) }), _jsx(StatCard, { label: "Average per QC", value: formatNumber(average(qcPerformance.map((row) => row.reviews))), note: "Review volume workload baseline", icon: _jsx(BarChart3, { size: 21 }), accent: "green" }), _jsx(StatCard, { label: "QC SLA Compliance", value: formatPct(slaQC.compliance), note: `${slaQC.breached} responses breached ${sla.qc}h`, icon: _jsx(Clock3, { size: 21 }), accent: slaQC.compliance < 70 ? "red" : "orange" }), _jsx(StatCard, { label: "QC Objections", value: formatNumber(filteredObjections.length), note: `${formatPct(objectionStats.approvalRate)} approved or partially approved`, icon: _jsx(AlertTriangle, { size: 21 }), accent: "orange" })] }), _jsx(Card, { title: "QC performance scorecard", subtitle: "Click global filters to focus on a cycle, organization, TL or review source", action: _jsxs("button", { onClick: () => downloadText("qc-performance.csv", rowsToCSV(qcPerformance.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, String(value)]))))), className: "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50", children: [_jsx(Download, { size: 15 }), " Export"] }), children: _jsx(DataTable, { rows: qcPerformance, columns: [
                                                { key: "name", label: "QC", render: (row) => _jsxs("div", { children: [_jsx("p", { className: "font-bold text-slate-900", children: row.name }), _jsxs("p", { className: "text-xs text-slate-400", children: [row.tutors, " tutors"] })] }) },
                                                { key: "reviews", label: "Reviews", align: "right" },
                                                { key: "avgScore", label: "Avg score", align: "right", render: (row) => _jsx("b", { children: formatPct(row.avgScore) }) },
                                                { key: "flags", label: "Flags", align: "right", render: (row) => _jsxs("span", { children: [row.flags, " ", _jsxs("small", { className: "text-slate-400", children: ["(", formatPct(row.flagRate), ")"] })] }) },
                                                { key: "objections", label: "Objections", align: "right" },
                                                { key: "objectionApproval", label: "Approved", align: "right", render: (row) => formatPct(row.objectionApproval) },
                                                { key: "slaCompliance", label: "QC SLA", align: "right", render: (row) => _jsx(Badge, { tone: row.slaCompliance >= 80 ? "green" : row.slaCompliance >= 60 ? "orange" : "red", children: formatPct(row.slaCompliance) }) },
                                                { key: "slaAverage", label: "Avg response", align: "right", render: (row) => formatHours(row.slaAverage) },
                                            ] }) }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsx(Card, { title: "Reviews vs flagged rate", subtitle: "High volume should be read alongside review strictness", children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(ComposedChart, { data: qcPerformance, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E8EDF5" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11 }, interval: 0, angle: -12, textAnchor: "end", height: 70 }), _jsx(YAxis, { yAxisId: "left", tick: { fontSize: 11 } }), _jsx(YAxis, { yAxisId: "right", orientation: "right", domain: [0, 100], tick: { fontSize: 11 } }), _jsx(Tooltip, {}), _jsx(Legend, {}), _jsx(Bar, { yAxisId: "left", dataKey: "reviews", fill: COLORS.blue, radius: [6, 6, 0, 0] }), _jsx(Line, { yAxisId: "right", type: "monotone", dataKey: "flagRate", stroke: COLORS.orange, strokeWidth: 3 })] }) }) }) }), _jsx(Card, { title: "QC response SLA", subtitle: "Compliance and average response duration by reviewer", children: _jsx("div", { className: "h-80", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(BarChart, { data: qcPerformance, children: [_jsx(CartesianGrid, { strokeDasharray: "3 3", vertical: false, stroke: "#E8EDF5" }), _jsx(XAxis, { dataKey: "name", tick: { fontSize: 11 }, interval: 0, angle: -12, textAnchor: "end", height: 70 }), _jsx(YAxis, { domain: [0, 100], tick: { fontSize: 11 } }), _jsx(Tooltip, { formatter: (value) => formatPct(value) }), _jsx(Bar, { dataKey: "slaCompliance", name: "SLA compliance", fill: COLORS.green, radius: [6, 6, 0, 0] })] }) }) }) })] })] })), view === "teams" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 sm:grid-cols-2 xl:grid-cols-4", children: [_jsx(StatCard, { label: "Educational TLs", value: formatNumber(tlPerformance.filter((row) => row.name !== "--" && row.name !== "Unassigned").length), note: "Leads represented in review data", icon: _jsx(Users, { size: 21 }) }), _jsx(StatCard, { label: "Organizations", value: formatNumber(organizationPerformance.length), note: "Programs and operating teams covered", icon: _jsx(Activity, { size: 21 }), accent: "green" }), _jsx(StatCard, { label: "TL / ETL SLA", value: formatPct(slaETL.compliance), note: `${slaETL.breached} decisions breached ${sla.etl}h`, icon: _jsx(Clock3, { size: 21 }), accent: slaETL.compliance < 70 ? "red" : "orange" }), _jsx(StatCard, { label: "Unassigned Reviews", value: formatNumber(dataIssues.missingTL), note: "Reviews with blank or -- educational TL", icon: _jsx(AlertTriangle, { size: 21 }), accent: dataIssues.missingTL ? "orange" : "green" })] }), _jsx(Card, { title: "Educational team lead scorecard", subtitle: "Team quality, coverage, flag rate, objection volume and first-stage SLA", children: _jsx(DataTable, { rows: tlPerformance, columns: [
                                                { key: "name", label: "TL / ETL", render: (row) => _jsxs("div", { children: [_jsx("p", { className: "font-bold text-slate-900", children: row.name }), _jsxs("p", { className: "text-xs text-slate-400", children: [row.tutors, " tutors"] })] }) },
                                                { key: "reviews", label: "Reviews", align: "right" },
                                                { key: "avgScore", label: "Avg score", align: "right", render: (row) => _jsx("b", { children: formatPct(row.avgScore) }) },
                                                { key: "flags", label: "Flags", align: "right", render: (row) => `${row.flags} (${formatPct(row.flagRate)})` },
                                                { key: "objections", label: "Objections", align: "right" },
                                                { key: "slaCompliance", label: "TL SLA", align: "right", render: (row) => _jsx(Badge, { tone: row.slaCompliance >= 80 ? "green" : row.slaCompliance >= 60 ? "orange" : "red", children: formatPct(row.slaCompliance) }) },
                                                { key: "slaAverage", label: "Avg decision", align: "right", render: (row) => formatHours(row.slaAverage) },
                                            ] }) }), _jsx(Card, { title: "Organization / program performance", subtitle: "Coverage and quality comparison across teams", children: _jsx(DataTable, { rows: organizationPerformance, columns: [
                                                { key: "name", label: "Organization", render: (row) => _jsx("p", { className: "max-w-[320px] truncate font-bold text-slate-900", title: row.name, children: row.name }) },
                                                { key: "reviews", label: "Reviews", align: "right" },
                                                { key: "tutors", label: "Tutors", align: "right" },
                                                { key: "qcs", label: "QCs", align: "right" },
                                                { key: "avgScore", label: "Avg score", align: "right", render: (row) => formatPct(row.avgScore) },
                                                { key: "flags", label: "Flagged", align: "right", render: (row) => `${row.flags} (${formatPct(row.flagRate)})` },
                                            ] }) })] })), view === "objections" && (_jsxs(_Fragment, { children: [_jsxs("div", { className: "grid gap-4 lg:grid-cols-3", children: [_jsx(SLAStageCard, { title: "TL / ETL decision", subtitle: "Objection created \u2192 ETL decision", summary: slaETL, limit: sla.etl, icon: _jsx(Users, { size: 20 }), tone: "blue" }), _jsx(SLAStageCard, { title: "QC response", subtitle: "ETL decision \u2192 QC response", summary: slaQC, limit: sla.qc, icon: _jsx(Clock3, { size: 20 }), tone: "orange" }), _jsx(SLAStageCard, { title: "QTL decision (You)", subtitle: "QC response \u2192 QTL final decision", summary: slaQTL, limit: sla.qtl, icon: _jsx(ShieldCheck, { size: 20 }), tone: "green" })] }), _jsxs("div", { className: "grid gap-6 xl:grid-cols-3", children: [_jsx(Card, { title: "Objection outcomes", subtitle: `${objectionStats.total} objections in the selected view`, className: "xl:col-span-1", children: _jsx("div", { className: "h-72", children: _jsx(ResponsiveContainer, { width: "100%", height: "100%", children: _jsxs(PieChart, { children: [_jsx(Pie, { data: outcomeData, dataKey: "value", nameKey: "name", innerRadius: 55, outerRadius: 95, paddingAngle: 3, children: outcomeData.map((entry) => _jsx(Cell, { fill: { Approved: COLORS.green, "Partially Approved": COLORS.amber, Rejected: COLORS.red, "In Progress": COLORS.blue }[entry.name] || COLORS.slate }, entry.name)) }), _jsx(Tooltip, {}), _jsx(Legend, {})] }) }) }) }), _jsx(Card, { title: "SLA interpretation", subtitle: "Transparent stage ownership for the full workflow", className: "xl:col-span-2", children: _jsxs("div", { className: "grid gap-4 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-xl bg-blue-50 p-4", children: [_jsx("p", { className: "text-sm font-bold text-blue-900", children: "Stage accountability" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-blue-800", children: "Each role is measured only from the previous role's completed timestamp. Missing timestamps remain pending and are not treated as a completed SLA." })] }), _jsxs("div", { className: "rounded-xl bg-orange-50 p-4", children: [_jsx("p", { className: "text-sm font-bold text-orange-900", children: "Data protection" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-orange-800", children: "Negative time differences are marked as data issues and excluded so incorrect entry order cannot improve or damage compliance." })] }), _jsxs("div", { className: "rounded-xl bg-emerald-50 p-4", children: [_jsx("p", { className: "text-sm font-bold text-emerald-900", children: "Configurable targets" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-emerald-800", children: "The default is 24 hours for TL / ETL, QC and QTL. Targets can be changed independently in Settings." })] }), _jsxs("div", { className: "rounded-xl bg-slate-100 p-4", children: [_jsx("p", { className: "text-sm font-bold text-slate-900", children: "Outcome accuracy" }), _jsx("p", { className: "mt-2 text-sm leading-6 text-slate-700", children: "Approved and Partially Approved objections are reported separately from Rejected and In Progress cases." })] })] }) })] }), _jsx(Card, { title: "Objection SLA detail", subtitle: "Longest total resolution time appears first", action: _jsxs("button", { onClick: () => downloadText("objection-sla-detail.csv", rowsToCSV(filteredObjections)), className: "inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50", children: [_jsx(Download, { size: 15 }), " Export raw"] }), children: _jsx(DataTable, { rows: objectionDetails, columns: [
                                                { key: "id", label: "ID", render: (row) => _jsxs("b", { className: "text-blue-700", children: ["#", row.id] }) },
                                                { key: "tutor", label: "Tutor", render: (row) => _jsxs("div", { children: [_jsx("p", { className: "max-w-[220px] truncate font-semibold text-slate-900", title: row.tutor, children: row.tutor || "—" }), _jsx("p", { className: "text-xs text-slate-400", children: row.type })] }) },
                                                { key: "qc", label: "QC" },
                                                { key: "tl", label: "TL / ETL" },
                                                { key: "outcome", label: "Outcome", render: (row) => _jsx(Badge, { tone: row.outcome === "Approved" ? "green" : row.outcome === "Partially Approved" ? "orange" : row.outcome === "Rejected" ? "red" : "blue", children: row.outcome }) },
                                                { key: "etlHours", label: "TL SLA", align: "right", render: (row) => _jsx("span", { className: row.etlBreach ? "font-bold text-red-600" : "text-slate-700", children: formatHours(row.etlHours) }) },
                                                { key: "qcHours", label: "QC SLA", align: "right", render: (row) => _jsx("span", { className: row.qcBreach ? "font-bold text-red-600" : "text-slate-700", children: formatHours(row.qcHours) }) },
                                                { key: "qtlHours", label: "QTL SLA", align: "right", render: (row) => _jsx("span", { className: row.qtlBreach ? "font-bold text-red-600" : "text-slate-700", children: formatHours(row.qtlHours) }) },
                                                { key: "overall", label: "Total", align: "right", render: (row) => _jsx("b", { children: formatHours(row.overall) }) },
                                            ] }) })] })), view === "explorer" && (_jsxs(Card, { title: "Filtered raw records", subtitle: `Showing up to 250 matching ${explorerKind}`, action: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => setExplorerKind("reviews"), className: `rounded-lg px-3 py-2 text-xs font-bold ${explorerKind === "reviews" ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-600"}`, children: "Reviews" }), _jsx("button", { onClick: () => setExplorerKind("objections"), className: `rounded-lg px-3 py-2 text-xs font-bold ${explorerKind === "objections" ? "bg-orange-500 text-white" : "bg-slate-100 text-slate-600"}`, children: "Objections" })] }), children: [_jsxs("div", { className: "mb-4 flex flex-wrap gap-3", children: [_jsxs("label", { className: "relative min-w-[250px] flex-1", children: [_jsx(Search, { className: "absolute left-3 top-3 text-slate-400", size: 17 }), _jsx("input", { value: explorerSearch, onChange: (event) => setExplorerSearch(event.target.value), placeholder: "Search any field...", className: "w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" })] }), _jsxs("button", { onClick: () => downloadText(`${explorerKind}-filtered.csv`, rowsToCSV(explorerKind === "reviews" ? filteredReviews : filteredObjections)), className: "inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50", children: [_jsx(Download, { size: 17 }), " Export filtered"] })] }), _jsxs("div", { className: "overflow-x-auto rounded-xl border border-slate-200", children: [_jsxs("table", { className: "min-w-full text-xs", children: [_jsx("thead", { children: _jsx("tr", { className: "bg-slate-50", children: unique(explorerRows.flatMap((row) => Object.keys(row))).slice(0, 14).map((header) => _jsx("th", { className: "whitespace-nowrap border-b border-slate-200 px-3 py-3 text-left font-bold text-slate-500", children: header }, header)) }) }), _jsx("tbody", { className: "divide-y divide-slate-100", children: explorerRows.map((row, index) => _jsx("tr", { className: "hover:bg-blue-50/40", children: unique(explorerRows.flatMap((item) => Object.keys(item))).slice(0, 14).map((header) => _jsx("td", { className: "max-w-[260px] truncate whitespace-nowrap px-3 py-3 text-slate-700", title: row[header], children: row[header] || "—" }, header)) }, index)) })] }), !explorerRows.length && _jsx("div", { className: "p-10 text-center text-sm text-slate-500", children: "No records match this search." })] })] })), view === "settings" && (_jsxs("div", { className: "grid gap-6 xl:grid-cols-2", children: [_jsx(Card, { title: "SLA targets", subtitle: "Set the maximum calendar hours allowed for each completed stage", children: _jsx("div", { className: "space-y-4", children: [{ key: "etl", label: "TL / ETL decision", note: "Objection Created At → ETL Decision · Thu/Fri excluded" }, { key: "qc", label: "QC response", note: "ETL Decision → QC Response · Fri/Sat excluded" }, { key: "qtl", label: "QTL decision (You)", note: "QC Response → QTL Decision · Fri/Sat excluded" }].map((item) => (_jsxs("label", { className: "flex items-center justify-between gap-4 rounded-xl border border-slate-200 p-4", children: [_jsxs("div", { children: [_jsx("p", { className: "font-bold text-slate-900", children: item.label }), _jsx("p", { className: "mt-1 text-xs text-slate-500", children: item.note })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "number", min: "1", max: "720", value: sla[item.key], onChange: (event) => setSla((prev) => ({ ...prev, [item.key]: Math.max(1, Number(event.target.value) || 24) })), className: "w-24 rounded-lg border border-slate-200 px-3 py-2 text-right font-bold outline-none focus:border-blue-500" }), _jsx("span", { className: "text-sm text-slate-500", children: "hours" })] })] }, item.key))) }) }), _jsxs(Card, { title: "Data storage", subtitle: "Manage the monthly exports saved in this browser", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("div", { className: "rounded-xl bg-blue-50 p-4", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-blue-600", children: "Reviews saved" }), _jsx("p", { className: "mt-2 text-3xl font-bold text-blue-950", children: formatNumber(reviews.length) })] }), _jsxs("div", { className: "rounded-xl bg-orange-50 p-4", children: [_jsx("p", { className: "text-xs font-bold uppercase tracking-wider text-orange-600", children: "Objections saved" }), _jsx("p", { className: "mt-2 text-3xl font-bold text-orange-950", children: formatNumber(objections.length) })] })] }), _jsxs("div", { className: "mt-4 flex flex-wrap gap-3", children: [_jsxs("button", { onClick: () => setUploadOpen(true), className: "inline-flex items-center gap-2 rounded-xl bg-blue-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-blue-800", children: [_jsx(UploadCloud, { size: 17 }), " Import another month"] }), _jsxs("button", { onClick: clearAll, className: "inline-flex items-center gap-2 rounded-xl border border-red-200 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50", children: [_jsx(Trash2, { size: 17 }), " Clear all data"] })] }), _jsxs("div", { className: "mt-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-sm leading-6 text-emerald-900", children: [_jsx("b", { children: "No server database:" }), " every user and browser has a separate local dataset. Exported CSVs should be kept as the official backup."] })] }), _jsx(Card, { title: "Included analytics", subtitle: "What is calculated automatically after each upload", className: "xl:col-span-2", children: _jsx("div", { className: "grid gap-3 sm:grid-cols-2 lg:grid-cols-4", children: ["QC workload, tutor coverage and scores", "Flag rate and score distribution", "TL and organization comparisons", "Objection outcomes by type and reviewer", "24 working-hour SLA by TL, QC and QTL", "Average and median response durations", "Data-quality and timestamp validation", "CSV export and print-to-PDF"].map((item) => _jsxs("div", { className: "flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-sm font-medium leading-5 text-slate-700", children: [_jsx(CheckCircle2, { className: "mt-0.5 shrink-0 text-emerald-600", size: 16 }), item] }, item)) }) })] }))] }))] })] }));
}
const root = document.getElementById("root");
if (!root)
    throw new Error("Missing #root");
createRoot(root).render(_jsx(App, {}));
