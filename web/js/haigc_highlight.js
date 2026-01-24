import { app } from "../../scripts/app.js";
import { $el } from "../../scripts/ui.js";

app.registerExtension({
	name: "Comfyui.HAIGC.Highlight",
	setup() {
        console.log("%c Comfyui HAIGC Highlight Extension Loaded ", "background: #222; color: #bada55");

        const coerceBool = (value, fallback) => {
            if (value === true || value === "true" || value === 1 || value === "1") return true;
            if (value === false || value === "false" || value === 0 || value === "0") return false;
            return fallback;
        };
        const coerceNumber = (value, fallback) => {
            const n = Number(value);
            return Number.isFinite(n) ? n : fallback;
        };
        const normalizeHex = (value, fallback) => {
            if (typeof value !== "string") return fallback;
            const v = value.trim();
            return /^#([0-9a-fA-F]{6})$/.test(v) ? v : fallback;
        };
        const normalizeColor = (value, fallback) => {
            if (typeof value !== "string") return fallback;
            const parts = value.split(",").map(s => s.trim()).filter(Boolean);
            if (parts.length === 0) return fallback;
            const valid = parts.every(p => /^#([0-9a-fA-F]{6})$/.test(p));
            return valid ? parts.join(",") : fallback;
        };
        const clamp01 = (value, fallback) => {
            const n = coerceNumber(value, fallback);
            if (n < 0) return 0;
            if (n > 1) return 1;
            return n;
        };
        const formatElapsed = (ms) => {
            const totalSeconds = Math.max(0, ms / 1000);
            if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = (totalSeconds % 60).toFixed(1).padStart(4, "0");
            return `${minutes}:${seconds}s`;
        };

        let highlightEnabled = true;
        let breathingEnabled = false;
        let autoBreathingEnabled = false;
        let breathingPeriodMs = 500;
        let breathingStrength = 100;
        let breathingColor = "#fafafa";
        let breathingSizeScale = 2;
        let breathingBrightness = 2;
        let timeEnabled = true;
        let timeColor = "#ff4d00";
        let timeBgOpacity = 1.0;
        let timeShadowOpacity = 0.5;
        let runningNodeId = null;
        let runningStartTime = 0;
        let lastRunningNodeId = null;
        let lastMouseMoveTime = 0;
        let mouseBreathPeriodMs = 0;
        let mouseBreathPhaseStart = 0;
        let mouseListenerAttached = false;
        let tickHandle = null;
        let lastHighlightTime = 0;
        let lastMouseMoveHandleTime = 0;
        
        // New State Variables
        let missingInputColor = "#E0B0FF";
        let errorColor = "#9932CC";
        let loadedPresets = [];
        let lastErrorNodeId = null;
        
        let highlightSetting, enabledSetting, autoBreathingSetting, periodSetting, strengthSetting, sizeSetting, brightnessSetting, colorSetting, timeEnabledSetting, timeColorSetting, timeBgOpacitySetting, timeShadowOpacitySetting;

        const applyDefaults = (defaults) => {
            if (!defaults) return;
            if (defaults.highlight_enabled !== undefined) highlightEnabled = coerceBool(defaults.highlight_enabled, true);
            if (defaults.breathing_enabled !== undefined) breathingEnabled = coerceBool(defaults.breathing_enabled, false);
            if (defaults.auto_breathing !== undefined) autoBreathingEnabled = coerceBool(defaults.auto_breathing, false);
            if (defaults.breathing_period_ms !== undefined) breathingPeriodMs = coerceNumber(defaults.breathing_period_ms, 500);
            if (defaults.breathing_strength !== undefined) breathingStrength = coerceNumber(defaults.breathing_strength, 100);
            if (defaults.breathing_size_scale !== undefined) breathingSizeScale = coerceNumber(defaults.breathing_size_scale, 2);
            if (defaults.breathing_brightness !== undefined) breathingBrightness = coerceNumber(defaults.breathing_brightness, 2);
            if (defaults.breathing_color !== undefined) breathingColor = normalizeColor(defaults.breathing_color, "#fafafa");
            if (defaults.time_enabled !== undefined) timeEnabled = coerceBool(defaults.time_enabled, true);
            if (defaults.time_color !== undefined) timeColor = normalizeHex(defaults.time_color, "#ff4d00");
            if (defaults.time_bg_opacity !== undefined) timeBgOpacity = clamp01(defaults.time_bg_opacity, 1.0);
            if (defaults.time_shadow_opacity !== undefined) timeShadowOpacity = clamp01(defaults.time_shadow_opacity, 0.5);
        };

        const registerSettings = () => {
            if (app.ui?.settings?.addSetting) {
                highlightSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Enabled",
                    name: "HAIGC 高亮：高亮框",
                    type: "boolean",
                    defaultValue: highlightEnabled,
                    onChange(value) {
                        highlightEnabled = coerceBool(value, true);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                highlightEnabled = coerceBool(highlightSetting?.value, highlightEnabled);

                const enabledSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Breathing.Enabled",
                    name: "HAIGC 高亮：鼠标触发呼吸",
                    type: "boolean",
                    defaultValue: breathingEnabled,
                    onChange(value) {
                        breathingEnabled = coerceBool(value, true);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                breathingEnabled = coerceBool(enabledSetting?.value, breathingEnabled);

                const autoBreathingSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Breathing.Auto",
                    name: "HAIGC 高亮：自动呼吸",
                    type: "boolean",
                    defaultValue: autoBreathingEnabled,
                    onChange(value) {
                        autoBreathingEnabled = coerceBool(value, true);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                autoBreathingEnabled = coerceBool(autoBreathingSetting?.value, autoBreathingEnabled);

                const periodSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Breathing.PeriodMs",
                    name: "HAIGC 高亮：呼吸周期 (s)",
                    defaultValue: breathingPeriodMs,
                    type: () => {
                        const id = "HAIGC-Highlight-Breathing-PeriodMs";
                        const input = $el("input", {
                            id,
                            type: "number",
                            min: 0.1,
                            step: 0.1,
                            value: (coerceNumber(periodSetting.value, breathingPeriodMs) / 1000).toFixed(1),
                            style: { 
                                width: "80px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)"
                            },
                            oninput: (e) => {
                                // Only update local variable for preview, don't trigger setting save/UI refresh
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                    breathingPeriodMs = val * 1000;
                                    app.graph?.setDirtyCanvas?.(true, true);
                                }
                            },
                            onchange: (e) => {
                                // Update persistent setting on commit (blur/enter)
                                const val = parseFloat(e.target.value);
                                if (!isNaN(val) && val > 0) {
                                    periodSetting.value = val * 1000;
                                    breathingPeriodMs = val * 1000;
                                }
                            },
                            onkeydown: (e) => {
                                e.stopPropagation();
                            }
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：呼吸周期 (s):" })]),
                            $el("td", [input]),
                        ]);
                    },
                    onChange(value) {
                        breathingPeriodMs = coerceNumber(value, 1885);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                breathingPeriodMs = coerceNumber(periodSetting?.value, breathingPeriodMs);

                const strengthSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Breathing.Strength",
                    name: "HAIGC 高亮：呼吸强度",
                    defaultValue: breathingStrength,
                    type: () => {
                        const id = "HAIGC-Highlight-Breathing-Strength";
                        const input = $el("input", {
                            id,
                            type: "number",
                            min: 0,
                            max: 100,
                            step: 1,
                            value: coerceNumber(strengthSetting.value, breathingStrength),
                            style: { 
                                width: "80px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)"
                            },
                            oninput: (e) => {
                                // Only update local variable for preview
                                let val = coerceNumber(e.target.value, 60);
                                if (val < 0) val = 0;
                                if (val > 100) val = 100;
                                breathingStrength = val;
                                app.graph?.setDirtyCanvas?.(true, true);
                            },
                            onchange: (e) => {
                                // Update persistent setting on commit
                                let val = coerceNumber(e.target.value, 60);
                                if (val < 0) val = 0;
                                if (val > 100) val = 100;
                                strengthSetting.value = val;
                                breathingStrength = val;
                            },
                             onkeydown: (e) => {
                                e.stopPropagation();
                            }
                        });
                        const unitLabel = $el("span", {
                            textContent: "%",
                            style: { marginLeft: "4px" },
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：呼吸强度:" })]),
                            $el("td", [input, unitLabel]),
                        ]);
                    },
                    onChange(value) {
                        breathingStrength = coerceNumber(value, 60);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                breathingStrength = coerceNumber(strengthSetting?.value, breathingStrength);

                const sizeSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Breathing.Size",
                    name: "HAIGC 高亮：呼吸大小",
                    defaultValue: breathingSizeScale,
                    type: () => {
                        const id = "HAIGC-Highlight-Breathing-Size";
                        const input = $el("input", {
                            id,
                            type: "number",
                            min: 0.2,
                            max: 10,
                            step: 0.1,
                            value: coerceNumber(sizeSetting.value, breathingSizeScale),
                            style: { 
                                width: "80px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)"
                            },
                            oninput: (e) => {
                                let val = coerceNumber(e.target.value, 1);
                                if (val < 0.2) val = 0.2;
                                if (val > 10) val = 10;
                                breathingSizeScale = val;
                                app.graph?.setDirtyCanvas?.(true, true);
                            },
                            onchange: (e) => {
                                let val = coerceNumber(e.target.value, 1);
                                if (val < 0.2) val = 0.2;
                                if (val > 10) val = 10;
                                sizeSetting.value = val;
                                breathingSizeScale = val;
                            },
                             onkeydown: (e) => {
                                e.stopPropagation();
                            }
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：呼吸大小:" })]),
                            $el("td", [input]),
                        ]);
                    },
                    onChange(value) {
                        let val = coerceNumber(value, 1);
                        if (val < 0.2) val = 0.2;
                        if (val > 10) val = 10;
                        breathingSizeScale = val;
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                breathingSizeScale = coerceNumber(sizeSetting?.value, breathingSizeScale);

                const brightnessSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Breathing.Brightness",
                    name: "HAIGC 高亮：呼吸亮度",
                    defaultValue: breathingBrightness,
                    type: () => {
                        const id = "HAIGC-Highlight-Breathing-Brightness";
                        const input = $el("input", {
                            id,
                            type: "number",
                            min: 0,
                            max: 2,
                            step: 0.1,
                            value: coerceNumber(brightnessSetting.value, breathingBrightness),
                            style: { 
                                width: "80px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)"
                            },
                            oninput: (e) => {
                                let val = coerceNumber(e.target.value, 1);
                                if (val < 0) val = 0;
                                if (val > 2) val = 2;
                                breathingBrightness = val;
                                app.graph?.setDirtyCanvas?.(true, true);
                            },
                            onchange: (e) => {
                                let val = coerceNumber(e.target.value, 1);
                                if (val < 0) val = 0;
                                if (val > 2) val = 2;
                                brightnessSetting.value = val;
                                breathingBrightness = val;
                            },
                             onkeydown: (e) => {
                                e.stopPropagation();
                            }
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：呼吸亮度:" })]),
                            $el("td", [input]),
                        ]);
                    },
                    onChange(value) {
                        let val = coerceNumber(value, 1);
                        if (val < 0) val = 0;
                        if (val > 2) val = 2;
                        breathingBrightness = val;
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                breathingBrightness = coerceNumber(brightnessSetting?.value, breathingBrightness);

                const colorSettingId = "HAIGC.Highlight.Breathing.Color";
                const colorSetting = app.ui.settings.addSetting({
                    id: colorSettingId,
                    name: "HAIGC 高亮：颜色设置",
                    defaultValue: breathingColor,
                    type: () => {
                        const id = "HAIGC-Highlight-Breathing-Color";
                        
                        // --- Helper to update state ---
                        const parseColors = (val) => {
                            const parts = (typeof val === "string" ? val : "")
                                .split(",")
                                .map(s => s.trim())
                                .filter(Boolean);
                            const first = normalizeHex(parts[0], "#22FF22");
                            const second = normalizeHex(parts[1], first);
                            const third = normalizeHex(parts[2], second);
                            return [first, second, third];
                        };

                        let singlePicker;
                        let startPicker;
                        let midPicker;
                        let endPicker;
                        let gradStart = "#FF0000";
                        let gradMid = "#00FF00";
                        let gradEnd = "#0000FF";

                        const updateColor = (val, save) => {
                            if (input) input.value = val;
                            breathingColor = val;
                            const [s, m, e] = parseColors(val);
                            gradStart = s;
                            gradMid = m;
                            gradEnd = e;
                            if (singlePicker) singlePicker.value = s;
                            if (startPicker) startPicker.value = s;
                            if (midPicker) midPicker.value = m;
                            if (endPicker) endPicker.value = e;
                            app.graph?.setDirtyCanvas?.(true, true);
                            if (save) {
                                colorSetting.value = val;
                                app.ui?.settings?.setSettingValue?.(colorSettingId, val);
                            }
                        };

                        // --- 1. Text Input (Source of Truth) ---
                        const input = $el("input", {
                            id,
                            type: "text",
                            value: colorSetting?.value || breathingColor,
                            placeholder: "#22FF22 或 #FF0000,#0000FF",
                            style: { 
                                width: "100%",
                                padding: "4px",
                                marginBottom: "5px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)",
                                fontFamily: "monospace"
                            },
                            oninput: (e) => updateColor(e.target.value, false),
                            onchange: (e) => updateColor(e.target.value, true),
                            onkeydown: (e) => e.stopPropagation()
                        });

                        // --- 2. Color Pickers ---
                        const createPicker = (initial, onPreview, onCommit, title) => {
                            return $el("input", {
                                type: "color",
                                value: normalizeHex(initial, "#000000"),
                                title: title,
                                style: { 
                                    width: "24px", height: "24px", padding: 0, 
                                    border: "1px solid #666", cursor: "pointer", 
                                    backgroundColor: "transparent", borderRadius: "4px"
                                },
                                oninput: (e) => onPreview(e.target.value),
                                onchange: (e) => onCommit(e.target.value)
                            });
                        };

                        const currVal = colorSetting?.value || breathingColor;
                        const [currStart, currMid, currEnd] = parseColors(currVal);
                        
                        // Single Color Picker
                        singlePicker = createPicker(currStart, (val) => updateColor(val, false), (val) => updateColor(val, true), "单色选择");
                        
                        // Gradient Pickers
                        // Try to parse current gradient or default
                        gradStart = currStart;
                        gradMid = currMid;
                        gradEnd = currEnd;
                        
                        const updateGradientPreview = () => updateColor(`${gradStart},${gradMid},${gradEnd}`, false);
                        const updateGradientCommit = () => updateColor(`${gradStart},${gradMid},${gradEnd}`, true);
                        
                        startPicker = createPicker(
                            gradStart,
                            (val) => { gradStart = val; updateGradientPreview(); },
                            (val) => { gradStart = val; updateGradientCommit(); },
                            "渐变起始色"
                        );
                        midPicker = createPicker(
                            gradMid,
                            (val) => { gradMid = val; updateGradientPreview(); },
                            (val) => { gradMid = val; updateGradientCommit(); },
                            "渐变中间色"
                        );
                        endPicker = createPicker(
                            gradEnd,
                            (val) => { gradEnd = val; updateGradientPreview(); },
                            (val) => { gradEnd = val; updateGradientCommit(); },
                            "渐变结束色"
                        );

                        // --- 3. Presets ---
                        const createPreset = (colors, label) => {
                            const bg = colors.includes(",") ? `linear-gradient(to right, ${colors})` : colors;
                            return $el("div", {
                                title: label,
                                style: {
                                    width: "18px", height: "18px", borderRadius: "50%",
                                    background: bg, cursor: "pointer", border: "1px solid #888"
                                },
                                onclick: () => updateColor(colors, true)
                            });
                        };

                        let presetElements = [];
                        if (loadedPresets && loadedPresets.length > 0) {
                            presetElements = loadedPresets.map(p => {
                                const colorStr = Array.isArray(p.colors) ? p.colors.join(",") : p.colors;
                                return createPreset(colorStr, p.name);
                            });
                        } else {
                            presetElements = [
                                createPreset("#22FF22", "默认绿"),
                                createPreset("#FF0000", "红"),
                                createPreset("#0088FF", "蓝"),
                                createPreset("#FF0000,#FFFF00", "火"),
                                createPreset("#00FFFF,#FF00FF", "赛博"),
                                createPreset("#0000FF,#00FFFF", "海洋"),
                                createPreset("#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF", "彩虹")
                            ];
                        }

                        // Layout Container
                        const controls = $el("div", { style: { display: "flex", flexDirection: "column", gap: "6px", width: "100%" } }, [
                            input,
                            $el("div", { style: { display: "flex", gap: "8px", alignItems: "center", fontSize: "12px", color: "var(--input-text, #ccc)" } }, [
                                $el("span", { textContent: "单色:" }), singlePicker,
                                $el("div", { style: { width: "1px", height: "16px", background: "#555", margin: "0 4px" } }), // Divider
                                $el("span", { textContent: "渐变:" }), startPicker, midPicker, endPicker
                            ]),
                            $el("div", { style: { display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap", marginTop: "2px" } }, [
                                $el("span", { textContent: "预设:", style: { fontSize: "12px", color: "var(--input-text, #ccc)" } }), 
                                ...presetElements
                            ])
                        ]);

                        return $el("tr", [
                            $el("td", { style: { verticalAlign: "top", paddingTop: "8px" } }, [
                                $el("label", { for: id, textContent: "HAIGC 高亮颜色:" })
                            ]),
                            $el("td", [controls]),
                        ]);
                    },
                    onChange(value) {
                        breathingColor = value || "#22FF22";
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                // Initialize from saved setting or default
                breathingColor = colorSetting?.value || breathingColor;

                const timeEnabledSetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Time.Enabled",
                    name: "HAIGC 高亮：时间显示",
                    type: "boolean",
                    defaultValue: timeEnabled,
                    onChange(value) {
                        timeEnabled = coerceBool(value, true);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                timeEnabled = coerceBool(timeEnabledSetting?.value, timeEnabled);

                const timeColorSettingId = "HAIGC.Highlight.Time.Color";
                const timeColorSetting = app.ui.settings.addSetting({
                    id: timeColorSettingId,
                    name: "HAIGC 高亮：时间颜色",
                    defaultValue: timeColor,
                    type: () => {
                        const id = "HAIGC-Highlight-Time-Color";
                        let textInput;
                        let colorInput;
                        const updateTimeColor = (val, save) => {
                            const nextColor = normalizeHex(val, timeColor || "#22FF22");
                            timeColor = nextColor;
                            if (textInput) textInput.value = nextColor;
                            if (colorInput) colorInput.value = nextColor;
                            app.graph?.setDirtyCanvas?.(true, true);
                            if (save) {
                                timeColorSetting.value = nextColor;
                                app.ui?.settings?.setSettingValue?.(timeColorSettingId, nextColor);
                            }
                        };
                        const current = normalizeHex(timeColorSetting?.value || timeColor || "#22FF22", "#22FF22");
                        textInput = $el("input", {
                            id,
                            type: "text",
                            value: current,
                            placeholder: "#22FF22",
                            style: { 
                                width: "100%",
                                padding: "4px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)",
                                fontFamily: "monospace"
                            },
                            oninput: (e) => updateTimeColor(e.target.value, false),
                            onchange: (e) => updateTimeColor(e.target.value, true),
                            onkeydown: (e) => e.stopPropagation()
                        });
                        colorInput = $el("input", {
                            type: "color",
                            value: current,
                            style: { 
                                width: "24px",
                                height: "24px",
                                padding: 0,
                                border: "1px solid #666",
                                cursor: "pointer",
                                backgroundColor: "transparent",
                                borderRadius: "4px"
                            },
                            oninput: (e) => updateTimeColor(e.target.value, false),
                            onchange: (e) => updateTimeColor(e.target.value, true)
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：时间颜色:" })]),
                            $el("td", [
                                $el("div", { style: { display: "flex", alignItems: "center", gap: "8px" } }, [
                                    colorInput,
                                    textInput
                                ])
                            ]),
                        ]);
                    },
                    onChange(value) {
                        timeColor = normalizeHex(value, timeColor || "#22FF22");
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                timeColor = normalizeHex(timeColorSetting?.value || timeColor, "#22FF22");

                const timeBgOpacitySetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Time.BgOpacity",
                    name: "HAIGC 高亮：时间背景透明度",
                    defaultValue: timeBgOpacity,
                    type: () => {
                        const id = "HAIGC-Highlight-Time-BgOpacity";
                        const input = $el("input", {
                            id,
                            type: "number",
                            min: 0,
                            max: 1,
                            step: 0.05,
                            value: clamp01(timeBgOpacitySetting.value, timeBgOpacity).toFixed(2),
                            style: { 
                                width: "80px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)"
                            },
                            oninput: (e) => {
                                timeBgOpacity = clamp01(e.target.value, 0.55);
                                app.graph?.setDirtyCanvas?.(true, true);
                            },
                            onchange: (e) => {
                                timeBgOpacity = clamp01(e.target.value, 0.55);
                                timeBgOpacitySetting.value = timeBgOpacity;
                            },
                            onkeydown: (e) => {
                                e.stopPropagation();
                            }
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：时间背景透明度:" })]),
                            $el("td", [input]),
                        ]);
                    },
                    onChange(value) {
                        timeBgOpacity = clamp01(value, 0.55);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                timeBgOpacity = clamp01(timeBgOpacitySetting?.value, timeBgOpacity);

                const timeShadowOpacitySetting = app.ui.settings.addSetting({
                    id: "HAIGC.Highlight.Time.ShadowOpacity",
                    name: "HAIGC 高亮：时间阴影透明度",
                    defaultValue: timeShadowOpacity,
                    type: () => {
                        const id = "HAIGC-Highlight-Time-ShadowOpacity";
                        const input = $el("input", {
                            id,
                            type: "number",
                            min: 0,
                            max: 1,
                            step: 0.05,
                            value: clamp01(timeShadowOpacitySetting.value, timeShadowOpacity).toFixed(2),
                            style: { 
                                width: "80px",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--border-color, #333)",
                                backgroundColor: "var(--comfy-input-bg, #222)",
                                color: "var(--input-text, #ddd)"
                            },
                            oninput: (e) => {
                                timeShadowOpacity = clamp01(e.target.value, 0.98);
                                app.graph?.setDirtyCanvas?.(true, true);
                            },
                            onchange: (e) => {
                                timeShadowOpacity = clamp01(e.target.value, 0.98);
                                timeShadowOpacitySetting.value = timeShadowOpacity;
                            },
                            onkeydown: (e) => {
                                e.stopPropagation();
                            }
                        });
                        return $el("tr", [
                            $el("td", [$el("label", { for: id, textContent: "HAIGC 高亮：时间阴影透明度:" })]),
                            $el("td", [input]),
                        ]);
                    },
                    onChange(value) {
                        timeShadowOpacity = clamp01(value, 0.98);
                        app.graph?.setDirtyCanvas?.(true, true);
                    },
                });
                timeShadowOpacity = clamp01(timeShadowOpacitySetting?.value, timeShadowOpacity);
            }
        };

        const scriptUrl = import.meta.url;
        const presetsUrl = new URL("./presets.json", scriptUrl).href;

        fetch(presetsUrl)
            .then(r => r.json())
            .then(data => {
                if (data.presets) loadedPresets = data.presets;
                if (data.styles) {
                    if (data.styles.missing_input?.color) missingInputColor = normalizeColor(data.styles.missing_input.color, "#FF0000");
                    if (data.styles.error?.color) errorColor = normalizeColor(data.styles.error.color, "#FF0000");
                }
                if (data.defaults) {
                    applyDefaults(data.defaults);
                }
                registerSettings();
            })
            .catch(e => {
                console.warn("HAIGC Highlight: Failed to load presets.json, using built-in defaults.", e);
                registerSettings();
            });

        const original_drawNode = LGraphCanvas.prototype.drawNode;

        LGraphCanvas.prototype.drawNode = function(node, ctx) {
            original_drawNode.call(this, node, ctx);

            const currentRunningId = app.runningNodeId || runningNodeId;
            if (currentRunningId && currentRunningId.toString() !== lastRunningNodeId) {
                lastRunningNodeId = currentRunningId.toString();
                runningStartTime = performance.now();
            }
            const isRunning = (
                (currentRunningId && currentRunningId.toString() === node.id.toString())
            );

            // Determine State & Color
            let targetColor = breathingColor;
            let isError = false;
            let isMissingInput = false;

            // Error Check
            if (node.bgcolor === "#FF0000" || node.bgcolor === "red" || 
                (app.lastNodeErrors && app.lastNodeErrors[node.id]) ||
                (lastErrorNodeId && lastErrorNodeId === node.id.toString())
            ) {
                isError = true;
                targetColor = errorColor;
            }

            // Missing Node Check (Class Definition Missing)
            if (!isError && node.type && typeof LiteGraph !== 'undefined' && LiteGraph.registered_node_types && !LiteGraph.registered_node_types[node.type]) {
                 isError = true;
                 targetColor = errorColor;
            }
            // Missing Input Check
            // Only check if not already error and not running
            if (!isRunning && !isError) {
                 if (node.inputs) {
                     // Try to identify required inputs from ComfyUI node definition
                     const nodeData = node.constructor ? node.constructor.nodeData : null;
                     const requiredInputs = (nodeData && nodeData.input && nodeData.input.required) 
                                            ? Object.keys(nodeData.input.required) 
                                            : null;

                     // Critical types that usually MUST be connected if present
                     const CRITICAL_TYPES = new Set([
                         "MODEL", "VAE", "CLIP", "LATENT", "IMAGE", "CONDITIONING", 
                         "MASK", "STYLE_MODEL", "CLIP_VISION", "CONTROL_NET", "AUDIO"
                     ]);

                     for (const inp of node.inputs) {
                         if (inp.link !== null) continue; // Already connected
                         
                         // Skip implicit optional types
                         if (inp.type === "OPTIONAL" || (typeof inp.type === 'string' && inp.type.toLowerCase() === "optional")) continue;
                         if (inp.name === "is_changed") continue; 
                         if (inp.name === "mask") continue; // 'mask' is often optional even if not marked

                         let isRequired = false;
                         
                         // Special handling for Reroute and PrimitiveNode (always required if unconnected)
                         if (node.type === "Reroute" || node.type === "PrimitiveNode") {
                             isRequired = true;
                         } else if (requiredInputs && requiredInputs.includes(inp.name)) {
                             // It is marked as required. 
                             // We further filter to avoid false positives (e.g. widgets that are not converted to inputs).
                             
                             const typeStr = (typeof inp.type === 'string') ? inp.type.toUpperCase() : "";
                             const isCritical = CRITICAL_TYPES.has(typeStr);
                             
                             // Check if there is a corresponding widget. 
                             // If a widget exists with the same name, we assume the user might provide value via widget.
                             // (Converted widgets are usually removed from node.widgets)
                             const hasWidget = node.widgets && node.widgets.some(w => w.name === inp.name);

                             if (isCritical) {
                                 // Critical types usually don't have widgets and must be connected
                                 isRequired = true;
                             } else if (!hasWidget) {
                                 // If it's not critical but has NO widget, it must be connected
                                 isRequired = true;
                             }
                         }

                         if (isRequired) {
                             isMissingInput = true;
                             targetColor = missingInputColor;
                             break;
                         }
                     }
                 }
            }

            // Keep animation loop alive if there are errors or missing inputs
            if (isError || isMissingInput) {
                lastHighlightTime = performance.now();
                if (tickHandle === null) scheduleTick(0);
            }

            if (!isRunning && !isError && !isMissingInput) return;
            if (!highlightEnabled) return;

            try {
                ctx.save();
                const r = window.devicePixelRatio || 1;
                
                // Reset transform? No, drawNode is in node-local space.
                // So (0,0) is top-left of node.
                
                const shape = node._shape || LiteGraph.BOX_SHAPE;

                // --- Helper Function to create path ---
                // pad: padding amount
                // top_pad: extra top padding
                const createPath = (pad, top_pad) => {
                    ctx.beginPath();
                    const isCollapsed = !!(node.flags && node.flags.collapsed) || !!node.collapsed;
                    const titleHeight = LiteGraph.NODE_TITLE_HEIGHT || 30;
                    const width = isCollapsed
                        ? (node._collapsed_width || LiteGraph.NODE_COLLAPSED_WIDTH || (node.size && node.size[0]) || 140)
                        : ((node.size && node.size[0]) || 140);
                    const height = isCollapsed
                        ? titleHeight
                        : ((node.size && node.size[1]) || 60);
                    const bounds = isCollapsed
                        ? { x: 0, y: -titleHeight, w: width, h: titleHeight }
                        : { x: 0, y: -titleHeight, w: width, h: height + titleHeight };
                    const padOuter = pad;
                    if (shape === LiteGraph.CIRCLE_SHAPE) {
                        const radius = Math.max(2, Math.max(bounds.w, bounds.h) * 0.5 + padOuter);
                        ctx.arc(bounds.x + bounds.w * 0.5, bounds.y + bounds.h * 0.5, radius, 0, Math.PI * 2);
                    } else {
                        const x = bounds.x - padOuter;
                        const y = bounds.y - padOuter;
                        const w = bounds.w + padOuter * 2;
                        const h = bounds.h + padOuter * 2;
                        if (ctx.roundRect) {
                            ctx.roundRect(x, y, w, h, 12);
                        } else {
                            ctx.rect(x, y, w, h);
                        }
                    }
                };

                const official_pad = 4;
                const cover_width = 4;
                const ambient_width = 10;
                const main_width = 6;
                const core_width = 2;
                const top_padding_adjustment = 0;
                const side_inset = 0;
                const outer_expand = 0;

                const cover_pad = official_pad;
                const glow_pad = cover_pad;

                // Animation pulse
                const now = performance.now();
                let breathAlpha = 1.0;
                if (breathingEnabled) {
                    const period = Math.max(50, breathingPeriodMs);
                    const strength = Math.min(100, Math.max(0, breathingStrength)) / 100;
                    const minAlpha = 1 - strength * 0.5;
                    if (autoBreathingEnabled) {
                        // Firefly-like breathing: (exp(sin(t)) - 1/e) / (e - 1/e)
                        // This creates a sharper peak (flash) and wider trough (darkness)
                        // Simplified approximation using pow: pow((sin(t) + 1)/2, 2)
                        
                        const t = (now / period) * Math.PI * 2;
                        // Using a slightly modified sine wave for firefly effect
                        // exp(sin(t)) gives the classic firefly curve
                        const sineVal = Math.sin(t);
                        const expVal = Math.exp(sineVal);
                        // Normalize exp(sin(t)) to 0-1 range. Max is e, min is 1/e
                        const maxVal = Math.E; // approx 2.718
                        const minVal = 1 / Math.E; // approx 0.368
                        const pulse = (expVal - minVal) / (maxVal - minVal);
                        
                        breathAlpha = minAlpha + pulse * (1 - minAlpha);
                    } else if (lastMouseMoveTime) {
                        const recentMouse = now - lastMouseMoveTime < 300;
                        if (recentMouse) {
                            const mousePeriod = Math.max(50, mouseBreathPeriodMs || period);
                            const elapsed = now - (mouseBreathPhaseStart || now);
                            const pulse = (Math.sin((elapsed / mousePeriod) * Math.PI * 2) + 1) / 2;
                            breathAlpha = minAlpha + pulse * (1 - minAlpha);
                        }
                    }
                }

                const parseGradient = (str) => {
                    const colors = (typeof str === "string" ? str : "").split(",").map(s => s.trim()).filter(Boolean);
                    if (colors.length === 0) return ["#22FF22"];
                    return colors;
                };
                
                const gradientColors = parseGradient(targetColor);
                
                // Helper to create gradient fill/stroke
                const setGradientStyle = (colors, alphaMultiplier = 1.0) => {
                    if (colors.length === 1) {
                         // Single color
                         const c = colors[0];
                         // Apply alpha if needed? Canvas colors are usually hex.
                         // Convert to rgba if alpha < 1
                         if (alphaMultiplier < 1) {
                             // Simple hex to rgba
                             const hex = c.replace("#", "");
                             const r = parseInt(hex.substring(0,2), 16);
                             const g = parseInt(hex.substring(2,4), 16);
                             const b = parseInt(hex.substring(4,6), 16);
                             ctx.fillStyle = `rgba(${r},${g},${b},${alphaMultiplier})`;
                             ctx.strokeStyle = `rgba(${r},${g},${b},${alphaMultiplier})`;
                         } else {
                             ctx.fillStyle = c;
                             ctx.strokeStyle = c;
                         }
                    } else {
                        // Linear Gradient
                        // For a rect, we can estimate diagonal or horizontal
                        // Use local coords. Node bounds are around (0,0) to (w,h)
                        const width = node.size ? node.size[0] : 140;
                        const height = node.size ? node.size[1] : 60;
                        const grad = ctx.createLinearGradient(0, 0, width, height);
                        colors.forEach((c, i) => {
                             grad.addColorStop(i / (colors.length - 1), c);
                        });
                        // Apply global alpha for gradient?
                        // ctx.globalAlpha affects everything.
                        ctx.fillStyle = grad;
                        ctx.strokeStyle = grad;
                    }
                };
                
                const currentAlpha = ctx.globalAlpha;
                ctx.globalAlpha = breathingBrightness * breathAlpha;

                // 1. Cover Layer (Background behind highlight) - Optional, maybe not needed if we want transparent
                // createPath(cover_pad, 0);
                // ctx.fillStyle = "rgba(0,0,0,0.0)";
                // ctx.fill();

                // 2. Glow/Ambient Layer
                createPath(glow_pad, 0);
                setGradientStyle(gradientColors, 1.0);
                
                // Draw multiple strokes for glow effect
                // Optimized for performance and soft look
                const isSoft = true;
                
                if (isSoft) {
                    // Outer soft glow (very transparent)
                    ctx.lineWidth = (ambient_width + 4) * breathingSizeScale;
                    ctx.globalAlpha = 0.08 * breathingBrightness * breathAlpha;
                    ctx.stroke();

                    // Middle glow
                    ctx.lineWidth = main_width * breathingSizeScale;
                    ctx.globalAlpha = 0.3 * breathingBrightness * breathAlpha;
                    ctx.stroke();

                    // Core bright line
                    ctx.lineWidth = core_width * breathingSizeScale;
                    ctx.globalAlpha = 0.8 * breathingBrightness * breathAlpha;
                    ctx.stroke();
                } else {
                    // Legacy style
                    ctx.lineWidth = ambient_width * breathingSizeScale;
                    ctx.globalAlpha = 0.15 * breathingBrightness * breathAlpha;
                    ctx.stroke();
    
                    ctx.lineWidth = main_width * breathingSizeScale;
                    ctx.globalAlpha = 0.4 * breathingBrightness * breathAlpha;
                    ctx.stroke();
    
                    ctx.lineWidth = core_width * breathingSizeScale;
                    ctx.globalAlpha = 0.9 * breathingBrightness * breathAlpha;
                    ctx.stroke();
                }
                
                // Restore Alpha
                ctx.globalAlpha = currentAlpha;

                // 3. Time Display
                if (isRunning && timeEnabled) {
                    try {
                        ctx.save();
                        // Reset transform to identity to draw in screen space? 
                        // Or draw relative to node?
                        // Draw relative to node is better so it moves with node.
                        
                        const now = performance.now();
                        const elapsed = Math.max(0, now - runningStartTime);
                        const elapsedText = formatElapsed(elapsed);

                        // Larger font for better visibility
                        ctx.font = "bold 20px monospace";
                        const tm = ctx.measureText(elapsedText);
                        const txtW = tm.width;
                        const txtH = 20;
                        const pad = 6;
                        
                        const nodeW = (node.size && node.size[0]) || 140;
                        // Position: Top-Left of node
                        const textX = pad;
                        const textY = -LiteGraph.NODE_TITLE_HEIGHT - 10; 

                        // Background
                        ctx.beginPath();
                        ctx.fillStyle = `rgba(0, 0, 0, ${clamp01(timeBgOpacity, 0.55)})`;
                        if (ctx.roundRect) {
                            ctx.roundRect(textX - pad, textY - txtH, txtW + pad * 2, txtH + pad, 6);
                        } else {
                            ctx.rect(textX - pad, textY - txtH, txtW + pad * 2, txtH + pad);
                        }
                        ctx.fill();

                        // Text
                        ctx.fillStyle = timeColor;
                        ctx.shadowColor = `rgba(0, 0, 0, ${clamp01(timeShadowOpacity, 0.98)})`;
                        ctx.shadowBlur = 10 * r;
                        ctx.shadowOffsetX = 0;
                        ctx.shadowOffsetY = 2 * r;
                        ctx.textAlign = "left";
                        ctx.textBaseline = "bottom";
                        ctx.fillText(elapsedText, textX, textY);
                    } finally {
                        ctx.restore();
                    }
                }

            } catch (e) {
                console.error("Error in ComfyUI HAIGC Highlight:", e);
            } finally {
                ctx.restore();
            }
        };

        // Force a redraw when execution starts/progresses to ensure the highlight updates immediately
        const api = app.api;
        
        // Listen to the executing event to force canvas dirty
        api.addEventListener("executing", (e) => {
             try {
                 const detail = e?.detail || {};
                 const explicitId = detail.node_id || detail.nodeId || (detail.node && detail.node.id);
                 if (explicitId !== undefined && explicitId !== null) {
                     runningNodeId = explicitId.toString();
                     if (lastErrorNodeId === runningNodeId) {
                         lastErrorNodeId = null;
                     }
                     runningStartTime = performance.now();
                     lastRunningNodeId = runningNodeId;
                 } else {
                     runningNodeId = null;
                     lastRunningNodeId = null;
                     runningStartTime = 0;
                 }
             } catch(_) {
                 runningNodeId = null;
                 lastRunningNodeId = null;
                 runningStartTime = 0;
             }
             if (app.canvas) {
                 app.canvas.setDirty(true, true);
             }
             scheduleTick(0);
        });

        // Listen for execution errors to highlight the failed node immediately
        api.addEventListener("execution_error", (e) => {
            try {
                const detail = e?.detail || {};
                const explicitId = detail.node_id || detail.nodeId;
                if (explicitId !== undefined && explicitId !== null) {
                    lastErrorNodeId = explicitId.toString();
                    if (app.canvas) {
                        app.canvas.setDirty(true, true);
                    }
                    scheduleTick(0);
                }
            } catch (err) {
                console.error("Error handling execution_error in HAIGC Highlight:", err);
            }
        });

        const ensureMouseListener = () => {
            if (mouseListenerAttached) return;
            const canvasEl = app.canvas?.canvas || app.canvas?.el || app.canvas?.canvasEl;
            if (!canvasEl || !canvasEl.addEventListener) return;
            canvasEl.addEventListener("mousemove", () => {
                const now = performance.now();
                // Throttle mouse move handling to save resources (limit to ~5fps for detection)
                // We don't need high precision for "waking up" the breathing effect
                if (now - lastMouseMoveHandleTime < 200) return;
                lastMouseMoveHandleTime = now;

                if (lastMouseMoveTime) {
                    const interval = now - lastMouseMoveTime;
                    const newPeriod = Math.min(3000, Math.max(200, interval));
                    if (mouseBreathPeriodMs && mouseBreathPhaseStart) {
                        const elapsed = now - mouseBreathPhaseStart;
                        const phase = ((elapsed / mouseBreathPeriodMs) * Math.PI * 2) % (Math.PI * 2);
                        mouseBreathPhaseStart = now - (phase / (Math.PI * 2)) * newPeriod;
                    } else {
                        mouseBreathPhaseStart = now;
                    }
                    mouseBreathPeriodMs = newPeriod;
                } else {
                    mouseBreathPhaseStart = now;
                }
                lastMouseMoveTime = now;
                scheduleTick(0);
            });
            mouseListenerAttached = true;
        };
        const scheduleTick = (delay) => {
            if (tickHandle !== null) return;
            tickHandle = setTimeout(() => {
                tickHandle = null;
                ensureMouseListener(); 
                const now = performance.now();
                const hasRunning = app.canvas && (app.runningNodeId || runningNodeId) && highlightEnabled;
                const hasActiveHighlight = (now - lastHighlightTime) < 2000; // Keep alive for 2s after last highlight draw

                if (hasRunning || hasActiveHighlight) {
                    app.canvas.setDirty(true, true);
                }
                if (!hasRunning && !hasActiveHighlight) return;
                
                const recentMouse = now - lastMouseMoveTime < 300;
                const activeBreathing = breathingEnabled && (autoBreathingEnabled || recentMouse);
                // Refresh rate: 
                // - If breathing (auto or mouse), use 100ms (10fps) for low power consumption but visible animation
                // - If static, slow check (500ms)
                const nextDelay = activeBreathing ? 100 : 500;
                scheduleTick(nextDelay);
            }, Math.max(0, delay));
        };
        scheduleTick(0);
	}
});
