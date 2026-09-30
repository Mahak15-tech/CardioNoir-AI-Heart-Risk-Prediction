/* =========================================================
   CARDIONOIR AI
   FRONTEND CONTROLLER (rewritten)
   - tolerant of different API response shapes
   - shows a visible banner listing any endpoint that failed
   ========================================================= */

"use strict";

let targetChart = null;
let scatterChart = null;
let modelPerformanceChart = null;

let analyticsData = null;
let scatterData = null;
let metadataData = null;
let correlationData = null;


/* =========================================================
   COLOUR SYSTEM
========================================================= */

const COLORS = {
    navy: "#0E1627",
    navy2: "#18233A",
    mauve: "#BD8E89",
    pink: "#E5C5C1",
    blush: "#F4E1E0",
    prune: "#7F6269",
    pruneLight: "#92757D",
    green: "#708276",
    orange: "#B9836A",
    rose: "#9A5660"
};


/* =========================================================
   HELPERS
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, ch => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[ch]));
}

function chartReady() {
    return typeof Chart !== "undefined";
}

function numbersOnly(list) {
    return (Array.isArray(list) ? list : [])
        .map(Number)
        .filter(Number.isFinite);
}


/* =========================================================
   STATUS BANNER
   Shows what failed instead of failing silently
========================================================= */

const issues = [];

function reportIssue(message) {

    console.error(message);

    if (!issues.includes(message)) {
        issues.push(message);
    }

    const banner = getElement("statusBanner");

    if (!banner) return;

    banner.hidden = false;

    banner.innerHTML =
        "<strong>Some data could not be loaded</strong><ul>" +
        issues.map(item => `<li>${escapeHTML(item)}</li>`).join("") +
        "</ul>";
}

async function fetchJSON(url, options) {

    try {

        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        return await response.json();

    } catch (error) {

        reportIssue(`${url} — ${error.message}`);

        return null;
    }
}


/* =========================================================
   THEME
========================================================= */

const themeToggle = getElement("themeToggle");
const themeIcon = getElement("themeIcon");

function isLightTheme() {
    return document.body.classList.contains("light");
}

function updateThemeIcon() {

    if (themeIcon) {
        themeIcon.textContent = isLightTheme() ? "☀" : "☾";
    }

    if (themeToggle) {

        const label = isLightTheme()
            ? "Switch to dark mode"
            : "Switch to light mode";

        themeToggle.setAttribute("aria-label", label);
        themeToggle.setAttribute("title", label);
    }
}

function applySavedTheme() {

    let saved = null;

    try {
        saved = localStorage.getItem("cardionoir-theme");
    } catch (error) {
        saved = null;
    }

    document.body.classList.toggle("light", saved === "light");

    updateThemeIcon();
}

if (themeToggle) {

    themeToggle.addEventListener("click", () => {

        document.body.classList.toggle("light");

        try {
            localStorage.setItem(
                "cardionoir-theme",
                isLightTheme() ? "light" : "dark"
            );
        } catch (error) {
            /* storage blocked — ignore */
        }

        updateThemeIcon();

        updateAllCharts();
    });
}


/* =========================================================
   CHART THEME HELPERS
========================================================= */

function chartTextColor() {
    return isLightTheme() ? COLORS.navy : COLORS.blush;
}

function chartMutedTextColor() {
    return isLightTheme() ? COLORS.prune : COLORS.pink;
}

function chartGridColor() {
    return isLightTheme()
        ? "rgba(14, 22, 39, 0.12)"
        : "rgba(244, 225, 224, 0.10)";
}

function chartTooltipBackground() {
    return isLightTheme() ? COLORS.navy : COLORS.navy2;
}

function chartBorderColor() {
    return isLightTheme() ? COLORS.blush : COLORS.navy;
}

function baseChartOptions() {

    return {

        responsive: true,

        maintainAspectRatio: false,

        animation: {
            duration: 850,
            easing: "easeOutQuart"
        },

        plugins: {

            legend: {
                labels: {
                    color: chartTextColor(),
                    font: { family: "DM Sans", size: 11 },
                    usePointStyle: true,
                    padding: 16
                }
            },

            tooltip: {
                backgroundColor: chartTooltipBackground(),
                titleColor: COLORS.blush,
                bodyColor: COLORS.pink,
                borderColor: COLORS.mauve,
                borderWidth: 1,
                padding: 12,
                cornerRadius: 10
            }
        }
    };
}

function destroyChart(canvasId) {

    const canvas = getElement(canvasId);

    if (!canvas || !chartReady()) return;

    const existing = Chart.getChart(canvas);

    if (existing) {
        existing.destroy();
    }
}


/* =========================================================
   DATA NORMALISERS
   Accept several possible backend response shapes
========================================================= */

function prettyTarget(label) {

    const text = String(label);

    if (text === "1") return "Heart Disease";
    if (text === "0") return "No Heart Disease";

    return text;
}

function normalizeTarget(raw) {

    if (!raw) return null;

    let entries = [];

    if (Array.isArray(raw)) {

        entries = raw.map(item => [
            item.label ?? item.name ?? item.target ?? item.class,
            Number(item.count ?? item.value ?? item.total)
        ]);

    } else if (typeof raw === "object") {

        entries = Object.entries(raw).map(([key, value]) => [key, Number(value)]);
    }

    entries = entries.filter(([, value]) => Number.isFinite(value));

    if (!entries.length) return null;

    entries.sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    return {
        labels: entries.map(([key]) => prettyTarget(key)),
        values: entries.map(([, value]) => value)
    };
}

function normalizeScatter(raw) {

    if (!raw || typeof raw !== "object") return null;

    const toPoints = list => (Array.isArray(list) ? list : [])
        .map(point => Array.isArray(point)
            ? { x: Number(point[0]), y: Number(point[1]) }
            : { x: Number(point.x ?? point.age), y: Number(point.y) })
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));

    const fromColumns = (xs, ys) => (xs || [])
        .map((x, i) => ({ x: Number(x), y: Number(ys[i]) }))
        .filter(point => Number.isFinite(point.x) && Number.isFinite(point.y));

    const out = {};

    [
        ["age_chol", "chol"],
        ["age_bp", "trestbps"],
        ["age_thalach", "thalach"]
    ].forEach(([key, column]) => {

        if (Array.isArray(raw[key])) {
            out[key] = toPoints(raw[key]);
        } else if (Array.isArray(raw.age) && Array.isArray(raw[column])) {
            out[key] = fromColumns(raw.age, raw[column]);
        } else {
            out[key] = [];
        }
    });

    return out;
}

function pickMetric(metrics, names) {

    const lookup = {};

    Object.keys(metrics || {}).forEach(key => {
        lookup[key.toLowerCase().replace(/[^a-z0-9]/g, "")] = metrics[key];
    });

    for (const name of names) {

        const value = lookup[name];

        if (value !== undefined && value !== null && value !== "") {

            let number = Number(value);

            if (Number.isFinite(number)) {
                if (number > 1) number = number / 100;
                return number;
            }
        }
    }

    return null;
}

function normalizeResults(raw) {

    if (!raw || typeof raw !== "object") return {};

    let entries = [];

    if (Array.isArray(raw)) {

        entries = raw.map((item, i) => [
            item.model ?? item.name ?? item.model_name ?? `Model ${i + 1}`,
            item
        ]);

    } else {

        entries = Object.entries(raw);
    }

    const out = {};

    entries.forEach(([name, metrics]) => {

        if (!metrics || typeof metrics !== "object") return;

        out[name] = {
            accuracy: pickMetric(metrics, ["accuracy", "acc"]),
            precision: pickMetric(metrics, ["precision"]),
            recall: pickMetric(metrics, ["recall", "sensitivity"]),
            f1: pickMetric(metrics, ["f1", "f1score"]),
            roc_auc: pickMetric(metrics, ["rocauc", "auc", "roc"])
        };
    });

    return out;
}

function getModelResults() {

    const raw =
        metadataData?.results ??
        metadataData?.model_results ??
        metadataData?.models ??
        analyticsData?.model_results ??
        analyticsData?.modelResults ??
        analyticsData?.results ??
        null;

    return normalizeResults(raw);
}

function getBestModel(results) {

    const declared =
        metadataData?.best_model ??
        metadataData?.bestModel ??
        metadataData?.best ??
        metadataData?.selected_model ??
        "";

    if (declared) return String(declared);

    let best = "";
    let bestScore = -1;

    Object.entries(results).forEach(([name, m]) => {

        const score = m.roc_auc ?? m.accuracy ?? -1;

        if (score > bestScore) {
            bestScore = score;
            best = name;
        }
    });

    return best;
}


/* =========================================================
   01 — DOUGHNUT CHART
========================================================= */

function createDoughnutChart(canvasId, labels, values) {

    const canvas = getElement(canvasId);

    if (!canvas || !chartReady()) return null;

    destroyChart(canvasId);

    const options = baseChartOptions();

    options.cutout = "68%";

    options.plugins = {
        ...options.plugins,

        legend: {
            position: "bottom",

            labels: {
                color: chartTextColor(),
                font: { family: "DM Sans", size: 11 },
                usePointStyle: true,
                padding: 18
            }
        }
    };

    targetChart = new Chart(canvas, {

        type: "doughnut",

        data: {
            labels,

            datasets: [{
                data: values,
                backgroundColor: [COLORS.mauve, COLORS.prune, COLORS.orange, COLORS.green],
                borderColor: chartBorderColor(),
                borderWidth: 4,
                hoverOffset: 10
            }]
        },

        options
    });

    return targetChart;
}


/* =========================================================
   02 — SCATTER CHART
========================================================= */

function scatterConfig(metric) {

    const configs = {

        age_chol: {
            title: "Age vs Cholesterol",
            xLabel: "Age",
            yLabel: "Cholesterol (mg/dL)",
            color: COLORS.mauve
        },

        age_bp: {
            title: "Age vs Resting Blood Pressure",
            xLabel: "Age",
            yLabel: "Resting Blood Pressure (mmHg)",
            color: COLORS.pruneLight
        },

        age_thalach: {
            title: "Age vs Maximum Heart Rate",
            xLabel: "Age",
            yLabel: "Maximum Heart Rate (bpm)",
            color: COLORS.orange
        }
    };

    return configs[metric] || configs.age_chol;
}

function createScatterChart(metric = "age_chol") {

    const canvas = getElement("scatterChart");

    if (!canvas || !scatterData || !chartReady()) return;

    destroyChart("scatterChart");

    const config = scatterConfig(metric);

    const points = scatterData[metric] || [];

    const options = baseChartOptions();

    options.plugins = {
        ...options.plugins,
        legend: { display: false }
    };

    const axis = label => ({
        title: {
            display: true,
            text: label,
            color: chartTextColor(),
            font: { family: "DM Sans", size: 11 }
        },
        ticks: { color: chartMutedTextColor() },
        grid: { color: chartGridColor() }
    });

    options.scales = {
        x: axis(config.xLabel),
        y: axis(config.yLabel)
    };

    scatterChart = new Chart(canvas, {

        type: "scatter",

        data: {
            datasets: [{
                label: config.title,
                data: points,
                backgroundColor: config.color,
                borderColor: COLORS.pink,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBorderWidth: 1
            }]
        },

        options
    });
}

const scatterMetric = getElement("scatterMetric");

if (scatterMetric) {

    scatterMetric.addEventListener("change", () => {
        createScatterChart(scatterMetric.value);
    });
}


/* =========================================================
   03 — CORRELATION HEATMAP
   Built as an HTML grid (no plugin needed)
========================================================= */

const FEATURE_LABELS = {
    age: "Age",
    sex: "Sex",
    cp: "Chest Pain",
    trestbps: "Rest BP",
    chol: "Cholesterol",
    fbs: "Fasting Sugar",
    restecg: "Rest ECG",
    thalach: "Max HR",
    exang: "Ex. Angina",
    oldpeak: "ST Depr.",
    slope: "ST Slope",
    ca: "Vessels",
    thal: "Thal",
    target: "Disease"
};

function prettyFeature(name) {
    return FEATURE_LABELS[name] || name;
}

function normalizeCorrelation(raw) {

    if (!raw || typeof raw !== "object") return null;

    let labels = null;
    let matrix = null;

    if (Array.isArray(raw.matrix)) {

        labels = raw.labels ?? raw.features ?? raw.columns;
        matrix = raw.matrix;

    } else {

        /* shape produced by df.corr().to_dict() */
        const keys = Object.keys(raw).filter(key =>
            raw[key] && typeof raw[key] === "object" && !Array.isArray(raw[key])
        );

        if (keys.length > 1) {
            labels = keys;
            matrix = keys.map(row => keys.map(col => raw[col]?.[row] ?? raw[row]?.[col]));
        }
    }

    if (!Array.isArray(labels) || !Array.isArray(matrix)) return null;

    matrix = matrix.map(row => Array.isArray(row) ? row.map(Number) : []);

    if (
        labels.length !== matrix.length ||
        matrix.some(row => row.length !== labels.length)
    ) {
        return null;
    }

    return {
        labels: labels.map(String),
        matrix: matrix.map(row => row.map(v => Number.isFinite(v) ? v : 0))
    };
}

function heatColor(value) {

    const strength = Math.min(1, Math.abs(value));

    /* positive = mauve, negative = sage green */
    const base = value >= 0 ? "189, 142, 137" : "112, 130, 118";

    return `rgba(${base}, ${(0.08 + strength * 0.92).toFixed(2)})`;
}

function renderHeatmap() {

    const container = getElement("heatmap");

    if (!container || !correlationData) return;

    const { labels, matrix } = correlationData;

    container.style.setProperty("--cols", labels.length);

    let html = `<div class="heatmap-corner"></div>`;

    html += labels.map(label =>
        `<div class="heatmap-col-label">${escapeHTML(prettyFeature(label))}</div>`
    ).join("");

    matrix.forEach((row, i) => {

        html += `<div class="heatmap-row-label">${escapeHTML(prettyFeature(labels[i]))}</div>`;

        html += row.map((value, j) => {

            const textColor = Math.abs(value) > 0.55 ? `color:${COLORS.navy};` : "";

            const tip = `${prettyFeature(labels[i])} × ${prettyFeature(labels[j])}: ${value.toFixed(2)}`;

            return `<div class="heatmap-cell" style="background:${heatColor(value)};${textColor}" title="${escapeHTML(tip)}">${value.toFixed(2)}</div>`;

        }).join("");
    });

    container.innerHTML = html;
}


/* =========================================================
   04 — MODEL PERFORMANCE CHART
========================================================= */

function createModelPerformanceChart(results) {

    const canvas = getElement("modelPerformanceChart");

    if (!canvas || !results || !chartReady()) return;

    const models = Object.keys(results);

    if (!models.length) return;

    destroyChart("modelPerformanceChart");

    const series = key => models.map(model => results[model][key] ?? 0);

    modelPerformanceChart = new Chart(canvas, {

        type: "bar",

        data: {

            labels: models,

            datasets: [
                { label: "Accuracy", data: series("accuracy"), backgroundColor: COLORS.navy, borderRadius: 6 },
                { label: "Precision", data: series("precision"), backgroundColor: COLORS.mauve, borderRadius: 6 },
                { label: "Recall", data: series("recall"), backgroundColor: COLORS.prune, borderRadius: 6 },
                { label: "F1 Score", data: series("f1"), backgroundColor: COLORS.pink, borderRadius: 6 },
                {
                    label: "ROC-AUC",
                    data: series("roc_auc"),
                    backgroundColor: COLORS.blush,
                    borderColor: COLORS.mauve,
                    borderWidth: 1,
                    borderRadius: 6
                }
            ]
        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            plugins: {
                legend: { labels: { color: chartTextColor() } }
            },

            scales: {

                x: {
                    ticks: { color: chartTextColor() },
                    grid: { display: false }
                },

                y: {
                    beginAtZero: true,
                    max: 1,
                    ticks: {
                        color: chartTextColor(),
                        callback: value => `${Math.round(value * 100)}%`
                    },
                    grid: { color: chartGridColor() },
                    title: {
                        display: true,
                        text: "Score",
                        color: chartTextColor()
                    }
                }
            }
        }
    });
}


/* =========================================================
   MODEL CARDS
========================================================= */

function metricRow(label, value) {

    const formatted = Number.isFinite(value)
        ? `${(value * 100).toFixed(1)}%`
        : "—";

    return `
        <div class="metric-row">
            <span>${label}</span>
            <span>${formatted}</span>
        </div>
    `;
}

function renderModelCards(results, bestModel) {

    const container = getElement("modelCards");

    if (!container) return;

    const models = Object.keys(results);

    if (!models.length) {

        container.innerHTML = `
            <div class="empty-state">Model information unavailable.</div>
        `;

        return;
    }

    container.innerHTML = models.map(name => {

        const m = results[name];

        const isBest = name === bestModel;

        return `
            <div class="model-card ${isBest ? "best" : ""}">

                ${isBest ? `<span class="model-badge">Best Model</span>` : ""}

                <h3>${escapeHTML(name)}</h3>

                <p>Classification model</p>

                <div class="metric-list">
                    ${metricRow("Accuracy", m.accuracy)}
                    ${metricRow("Precision", m.precision)}
                    ${metricRow("Recall", m.recall)}
                    ${metricRow("F1 Score", m.f1)}
                    ${metricRow("ROC-AUC", m.roc_auc)}
                </div>

            </div>
        `;

    }).join("");
}


/* =========================================================
   RENDER — METADATA / ANALYTICS / STATS
========================================================= */

function renderMetadata() {

    const results = getModelResults();

    const bestModel = getBestModel(results);

    const modelCountElement = getElement("modelCount");
    const datasetRowsElement = getElement("datasetRows");
    const bestModelElement = getElement("bestModel");

    /* use the first value that is a real, positive number (a 0 from the backend is ignored) */
    const datasetRows = [
        metadataData?.dataset_size,
        metadataData?.rows,
        metadataData?.dataset_rows,
        correlationData?.rows
    ].map(Number).find(n => Number.isFinite(n) && n > 0) ?? null;

    if (modelCountElement) {
        modelCountElement.textContent = Object.keys(results).length || "—";
    }

    if (datasetRowsElement) {
        datasetRowsElement.textContent =
            Number.isFinite(Number(datasetRows))
                ? Number(datasetRows).toLocaleString()
                : "—";
    }

    if (bestModelElement) {
        bestModelElement.textContent = bestModel || "—";
    }

    renderModelCards(results, bestModel);

    createModelPerformanceChart(results);
}

function renderAnalytics() {

    if (!analyticsData) return;

    const target = normalizeTarget(
        analyticsData.target_distribution ??
        analyticsData.targetDistribution ??
        analyticsData.target ??
        analyticsData.outcomes
    );

    if (target) {
        createDoughnutChart("targetChart", target.labels, target.values);
    } else {
        reportIssue("/api/analytics — no target distribution found in response");
    }
}


/* =========================================================
   LOADERS
========================================================= */

async function loadMetadata() {

    metadataData = await fetchJSON("/api/metadata");

    if (metadataData) renderMetadata();
}

async function loadAnalytics() {

    analyticsData = await fetchJSON("/api/analytics");

    renderAnalytics();

    /* model results may only exist in the analytics response */
    if (analyticsData && !metadataData) renderMetadata();
}

async function loadScatterData() {

    scatterData = normalizeScatter(await fetchJSON("/api/analytics/raw"));

    if (scatterData) {
        createScatterChart(getElement("scatterMetric")?.value || "age_chol");
    }
}

async function loadCorrelation() {

    const raw = await fetchJSON("/api/analytics/correlation");

    correlationData = normalizeCorrelation(raw);

    if (raw && !correlationData) {
        reportIssue("/api/analytics/correlation — unexpected response format");
    }

    if (correlationData) {

        renderHeatmap();

        /* refresh dataset size if metadata did not provide it */
        if (raw.rows && ["—", "0"].includes(getElement("datasetRows")?.textContent)) {
            correlationData.rows = raw.rows;
            renderMetadata();
        }
    }
}


/* =========================================================
   PREDICTION FORM
========================================================= */

const predictionForm = getElement("predictionForm");

const FORM_FIELDS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg",
    "thalach", "exang", "oldpeak", "slope", "ca", "thal"
];

if (predictionForm) {

    predictionForm.addEventListener("submit", async event => {

        event.preventDefault();

        const formError = getElement("formError");

        const submitButton =
            predictionForm.querySelector('button[type="submit"]');

        if (formError) formError.textContent = "";

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = "<span>Analyzing...</span><span>…</span>";
        }

        try {

            const formData = new FormData(predictionForm);

            const payload = {};

            FORM_FIELDS.forEach(field => {
                payload[field] = Number(formData.get(field));
            });

            const response = await fetch("/api/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            let data = {};

            try {
                data = await response.json();
            } catch (error) {
                data = {};
            }

            if (!response.ok) {

                const detail =
                    typeof data.detail === "string"
                        ? data.detail
                        : Array.isArray(data.detail)
                            ? data.detail.map(d => `${(d.loc || []).slice(-1)[0]}: ${d.msg}`).join(", ")
                            : null;

                throw new Error(detail || `Prediction failed (HTTP ${response.status})`);
            }

            showResult(data);

        } catch (error) {

            console.error("Prediction error:", error);

            if (formError) {
                formError.textContent = error.message || "Unable to generate prediction.";
            }

        } finally {

            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML =
                    "<span>Analyze Cardiovascular Risk</span><span>→</span>";
            }
        }
    });
}


/* =========================================================
   RESULT
========================================================= */

function showResult(data) {

    const panel = getElement("resultPanel");

    const riskRaw = Number(
        data.risk_percentage ??
        data.probability ??
        data.risk ??
        0
    );

    const percentage = riskRaw > 1 ? riskRaw : riskRaw * 100;

    const rounded = Math.max(0, Math.min(100, percentage));

    const prediction = Number(data.prediction ?? (rounded >= 50 ? 1 : 0));

    const level =
        data.risk_level ??
        data.level ??
        (rounded < 30 ? "Low" : rounded < 60 ? "Moderate" : "High");

    const model = data.model_name ?? data.model ?? "—";

    const setText = (id, text) => {
        const el = getElement(id);
        if (el) el.textContent = text;
    };

    setText("riskPercentage", `${rounded.toFixed(1)}%`);
    setText("resultModel", model);
    setText("resultLevel", level);

    if (prediction === 1) {

        setText("resultTitle", "Elevated cardiovascular risk");
        setText("resultStatus", "RESULT: POSITIVE");
        setText(
            "resultDescription",
            "The model identified a positive cardiovascular disease prediction based on the provided clinical indicators."
        );

    } else {

        setText("resultTitle", "Lower estimated cardiovascular risk");
        setText("resultStatus", "RESULT: NEGATIVE");
        setText(
            "resultDescription",
            "The model identified a negative cardiovascular disease prediction based on the provided clinical indicators."
        );
    }

    const riskCircle = getElement("riskCircle");

    if (riskCircle) {

        const degrees = rounded * 3.6;

        const activeColor = prediction === 1 ? COLORS.rose : COLORS.mauve;

        const inactiveColor = isLightTheme() ? "#EED8D6" : "#202C44";

        riskCircle.style.background =
            `conic-gradient(${activeColor} 0deg ${degrees}deg, ${inactiveColor} ${degrees}deg 360deg)`;

        riskCircle.style.borderColor = "transparent";
    }

    if (panel) {
        panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
}


/* =========================================================
   RESET FORM
========================================================= */

const resetForm = getElement("resetForm");

if (resetForm) {

    resetForm.addEventListener("click", () => {

        if (predictionForm) predictionForm.reset();

        const setText = (id, text) => {
            const el = getElement(id);
            if (el) el.textContent = text;
        };

        setText("riskPercentage", "—");
        setText("resultTitle", "Awaiting assessment");
        setText("resultDescription", "Submit the assessment to view the model's result.");
        setText("resultModel", "—");
        setText("resultLevel", "—");
        setText("resultStatus", "READY");
        setText("formError", "");

        const riskCircle = getElement("riskCircle");

        if (riskCircle) {

            riskCircle.style.background =
                "radial-gradient(circle, rgba(127, 98, 105, 0.18), transparent 68%)";

            riskCircle.style.borderColor = "rgba(189, 142, 137, 0.20)";
            riskCircle.style.borderTopColor = COLORS.mauve;
            riskCircle.style.borderRightColor = COLORS.mauve;
        }
    });
}


/* =========================================================
   UPDATE ALL CHARTS (theme change)
========================================================= */

function updateAllCharts() {

    renderAnalytics();

    if (scatterData) {
        createScatterChart(getElement("scatterMetric")?.value || "age_chol");
    }

    createModelPerformanceChart(getModelResults());
}


/* =========================================================
   NAVIGATION
========================================================= */

document.querySelectorAll(".nav-links a").forEach(link => {

    link.addEventListener("click", () => {

        document
            .querySelectorAll(".nav-links a")
            .forEach(item => item.classList.remove("active"));

        link.classList.add("active");
    });
});


/* =========================================================
   INITIALIZE
========================================================= */

async function initApp() {

    applySavedTheme();

    if (!chartReady()) {
        reportIssue("Chart.js did not load — check your internet connection or the CDN script tag");
    }

    await loadMetadata();
    await loadAnalytics();
    await loadScatterData();
    await loadCorrelation();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
} else {
    initApp();
}