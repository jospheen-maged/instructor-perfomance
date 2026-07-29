const fs = require("fs");
const path = require("path");

const appPath = path.join(__dirname, "..", "public", "quality-analytics", "app.js");
let source = fs.readFileSync(appPath, "utf8");

const hoursFunction = `function hoursBetween(start, end) {
    const from = parseDateValue(start);
    const to = parseDateValue(end);
    if (!from || !to)
        return null;
    const hours = (to.getTime() - from.getTime()) / 3_600_000;
    return hours >= 0 ? hours : null;
}`;

const workingHoursFunction = `${hoursFunction}
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
}`;

if (!source.includes("function workingHoursBetween")) {
    if (!source.includes(hoursFunction)) throw new Error("hoursBetween function not found");
    source = source.replace(hoursFunction, workingHoursFunction);
}

const oldSla = `function getSlaHours(row, stage) {
    if (stage === "etl")
        return hoursBetween(row["Objection Created At"], row["ETL Decision At"]);
    if (stage === "qc")
        return hoursBetween(row["ETL Decision At"], row["QC Response At"]);
    return hoursBetween(row["QC Response At"], row["QTL Decision At"]);
}`;

const newSla = `function getSlaHours(row, stage) {
    if (stage === "etl")
        return workingHoursBetween(row["Objection Created At"], row["ETL Decision At"], [4, 5]);
    if (stage === "qc")
        return workingHoursBetween(row["ETL Decision At"], row["QC Response At"], [5, 6]);
    return workingHoursBetween(row["QC Response At"], row["QTL Decision At"], [5, 6]);
}`;

if (source.includes(oldSla)) source = source.replace(oldSla, newSla);
if (!source.includes(newSla)) throw new Error("SLA stage logic was not applied");

const replacements = [
    ["24-hour SLA by stage", "24 working-hour SLA by stage"],
    [" within ", " within "],
    ["Current compliance against the configured role targets", "Current compliance against 24 working-hour role targets"],
    ["Objection created → ETL decision", "Objection Created At (arrival to TL) → ETL decision · Thu/Fri excluded"],
    ["ETL decision → QC response", "ETL decision → QC response · Fri/Sat excluded"],
    ["QC response → QTL final decision", "QC response → QTL final decision · Fri/Sat excluded"],
    ["Created → ETL Decision", "Objection Created At → ETL Decision · Thu/Fri excluded"],
    ["ETL Decision → QC Response", "ETL Decision → QC Response · Fri/Sat excluded"],
    ["QC Response → QTL Decision", "QC Response → QTL Decision · Fri/Sat excluded"],
    ["Set the maximum hours allowed for each completed stage", "Set the maximum working hours allowed for each completed stage; role weekends are excluded automatically"],
    ["24-hour SLA by TL, QC and QTL", "24 working-hour SLA by TL, QC and QTL"]
];
for (const [from, to] of replacements) source = source.split(from).join(to);

fs.writeFileSync(appPath, source);
console.log("SLA stage timing and role weekends patched successfully.");
