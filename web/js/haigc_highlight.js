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
        let breathingEnabled = true;
        let autoBreathingEnabled = true;
        let breathingPeriodMs = 1885;
        let breathingStrength = 60;
        let breathingColor = "#22FF22";
        let breathingSizeScale = 1;
        let breathingBrightness = 1;
        let timeEnabled = true;
        let timeColor = "#22FF22";
        let timeBgOpacity = 0.55;
        let timeShadowOpacity = 0.98;
        let runningNodeId = null;
        let runningStartTime = 0;
        let lastRunningNodeId = null;
        let lastMouseMoveTime = 0;
        let mouseBreathPeriodMs = 0;
        let mouseBreathPhaseStart = 0;
        let mouseListenerAttached = false;
        let tickHandle = null;

        if (app.ui?.settings?.addSetting) {
            const highlightSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Enabled",
                name: "HAIGC 高亮：高亮框",
                type: "boolean",
                defaultValue: true,
                onChange(value) {
                    highlightEnabled = coerceBool(value, true);
                    app.graph?.setDirtyCanvas?.(true, true);
                },
            });
            highlightEnabled = coerceBool(highlightSetting?.value, true);

            const enabledSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Breathing.Enabled",
                name: "HAIGC 高亮：呼吸灯",
                type: "boolean",
                defaultValue: true,
                onChange(value) {
                    breathingEnabled = coerceBool(value, true);
                    app.graph?.setDirtyCanvas?.(true, true);
                },
            });
            breathingEnabled = coerceBool(enabledSetting?.value, true);

            const autoBreathingSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Breathing.Auto",
                name: "HAIGC 高亮：自动呼吸",
                type: "boolean",
                defaultValue: true,
                onChange(value) {
                    autoBreathingEnabled = coerceBool(value, true);
                    app.graph?.setDirtyCanvas?.(true, true);
                },
            });
            autoBreathingEnabled = coerceBool(autoBreathingSetting?.value, true);

            const periodSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Breathing.PeriodMs",
                name: "HAIGC 高亮：呼吸周期 (s)",
                defaultValue: 1885,
                type: () => {
                    const id = "HAIGC-Highlight-Breathing-PeriodMs";
                    const input = $el("input", {
                        id,
                        type: "number",
                        min: 0.1,
                        step: 0.1,
                        value: (coerceNumber(periodSetting.value, 1885) / 1000).toFixed(1),
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
            breathingPeriodMs = coerceNumber(periodSetting?.value, 1885);

            const strengthSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Breathing.Strength",
                name: "HAIGC 高亮：呼吸强度",
                defaultValue: 60,
                type: () => {
                    const id = "HAIGC-Highlight-Breathing-Strength";
                    const input = $el("input", {
                        id,
                        type: "number",
                        min: 0,
                        max: 100,
                        step: 1,
                        value: coerceNumber(strengthSetting.value, 60),
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
            breathingStrength = coerceNumber(strengthSetting?.value, 60);

            const sizeSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Breathing.Size",
                name: "HAIGC 高亮：呼吸大小",
                defaultValue: 1,
                type: () => {
                    const id = "HAIGC-Highlight-Breathing-Size";
                    const input = $el("input", {
                        id,
                        type: "number",
                        min: 0.2,
                        max: 3,
                        step: 0.1,
                        value: coerceNumber(sizeSetting.value, 1),
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
                            if (val > 3) val = 3;
                            breathingSizeScale = val;
                            app.graph?.setDirtyCanvas?.(true, true);
                        },
                        onchange: (e) => {
                            let val = coerceNumber(e.target.value, 1);
                            if (val < 0.2) val = 0.2;
                            if (val > 3) val = 3;
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
                    if (val > 3) val = 3;
                    breathingSizeScale = val;
                    app.graph?.setDirtyCanvas?.(true, true);
                },
            });
            breathingSizeScale = coerceNumber(sizeSetting?.value, 1);

            const brightnessSetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Breathing.Brightness",
                name: "HAIGC 高亮：呼吸亮度",
                defaultValue: 1,
                type: () => {
                    const id = "HAIGC-Highlight-Breathing-Brightness";
                    const input = $el("input", {
                        id,
                        type: "number",
                        min: 0,
                        max: 2,
                        step: 0.1,
                        value: coerceNumber(brightnessSetting.value, 1),
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
            breathingBrightness = coerceNumber(brightnessSetting?.value, 1);

            const colorSettingId = "HAIGC.Highlight.Breathing.Color";
            const colorSetting = app.ui.settings.addSetting({
                id: colorSettingId,
                name: "HAIGC 高亮：颜色设置",
                defaultValue: "#22FF22",
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
                        value: colorSetting?.value || breathingColor || "#22FF22",
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

                    const currVal = colorSetting?.value || breathingColor || "#22FF22";
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

                    const presets = [
                        createPreset("#22FF22", "默认绿"),
                        createPreset("#FF0000", "红"),
                        createPreset("#0088FF", "蓝"),
                        createPreset("#FF0000,#FFFF00", "火"),
                        createPreset("#00FFFF,#FF00FF", "赛博"),
                        createPreset("#0000FF,#00FFFF", "海洋"),
                        createPreset("#FF0000,#FFFF00,#00FF00,#00FFFF,#0000FF,#FF00FF", "彩虹")
                    ];

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
                            ...presets
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
                defaultValue: true,
                onChange(value) {
                    timeEnabled = coerceBool(value, true);
                    app.graph?.setDirtyCanvas?.(true, true);
                },
            });
            timeEnabled = coerceBool(timeEnabledSetting?.value, true);

            const timeColorSettingId = "HAIGC.Highlight.Time.Color";
            const timeColorSetting = app.ui.settings.addSetting({
                id: timeColorSettingId,
                name: "HAIGC 高亮：时间颜色",
                defaultValue: "#22FF22",
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
            timeColor = normalizeHex(timeColorSetting?.value || timeColor || "#22FF22", "#22FF22");

            const timeBgOpacitySetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Time.BgOpacity",
                name: "HAIGC 高亮：时间背景透明度",
                defaultValue: 0.55,
                type: () => {
                    const id = "HAIGC-Highlight-Time-BgOpacity";
                    const input = $el("input", {
                        id,
                        type: "number",
                        min: 0,
                        max: 1,
                        step: 0.05,
                        value: clamp01(timeBgOpacitySetting.value, 0.55).toFixed(2),
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
            timeBgOpacity = clamp01(timeBgOpacitySetting?.value, 0.55);

            const timeShadowOpacitySetting = app.ui.settings.addSetting({
                id: "HAIGC.Highlight.Time.ShadowOpacity",
                name: "HAIGC 高亮：时间阴影透明度",
                defaultValue: 0.98,
                type: () => {
                    const id = "HAIGC-Highlight-Time-ShadowOpacity";
                    const input = $el("input", {
                        id,
                        type: "number",
                        min: 0,
                        max: 1,
                        step: 0.05,
                        value: clamp01(timeShadowOpacitySetting.value, 0.98).toFixed(2),
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
            timeShadowOpacity = clamp01(timeShadowOpacitySetting?.value, 0.98);
        }

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
            if (!isRunning) return;
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

                const official_pad = 0;
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
                        const pulse = (Math.sin((now / period) * Math.PI * 2) + 1) / 2;
                        breathAlpha = minAlpha + pulse * (1 - minAlpha);
                    } else if (lastMouseMoveTime) {
                        const recentMouse = now - lastMouseMoveTime < 80;
                        if (recentMouse) {
                            const mousePeriod = Math.max(50, mouseBreathPeriodMs || period);
                            const elapsed = now - (mouseBreathPhaseStart || now);
                            const pulse = (Math.sin((elapsed / mousePeriod) * Math.PI * 2) + 1) / 2;
                            breathAlpha = minAlpha + pulse * (1 - minAlpha);
                        } else {
                            breathAlpha = 1.0;
                        }
                    }
                }

                // Parse Colors
                let strokeStyle;
                let shadowColor;
                const colorStr = (typeof breathingColor === 'string' ? breathingColor : "#22FF22");
                let colors = [];
                try {
                     colors = colorStr.split(",").map(c => c.trim()).filter(c => c);
                } catch(e) {
                     colors = ["#22FF22"];
                }
                if (colors.length === 0) colors = ["#22FF22"];

                if (colors.length > 1 && node.size && node.size.length >= 2) {
                    // Linear Gradient
                    // Gradient from top-left to bottom-right of the node
                    try {
                        const grad = ctx.createLinearGradient(0, 0, node.size[0], node.size[1]);
                        colors.forEach((c, i) => {
                                grad.addColorStop(i / (colors.length - 1), c);
                        });
                        strokeStyle = grad;
                    } catch (e) {
                        strokeStyle = colors[0];
                    }
                    shadowColor = colors[0]; // Shadow cannot be gradient, pick first color
                } else {
                    strokeStyle = colors[0];
                    shadowColor = strokeStyle;
                }

                const sizeScale = Math.max(0.2, breathingSizeScale || 1);
                const brightness = Math.max(0, breathingBrightness || 1);
                const brightnessAlpha = Math.min(1, brightness);
                const brightnessBlur = Math.max(0.2, brightness);

                // Layer 1: Cover official highlight (no dark mask)
                ctx.save();
                try {
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    createPath(cover_pad, top_padding_adjustment);
                    ctx.lineWidth = cover_width * r * sizeScale;
                    ctx.strokeStyle = strokeStyle;
                    ctx.shadowBlur = 0;
                    ctx.globalAlpha = 0.95 * brightnessAlpha;
                    ctx.stroke();
                } finally {
                    ctx.restore();
                }

                // Layer 2: Ambient Glow
                ctx.save();
                try {
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    createPath(glow_pad, top_padding_adjustment);
                    ctx.lineWidth = ambient_width * r * sizeScale;
                    ctx.strokeStyle = shadowColor; 
                    ctx.shadowColor = shadowColor;
                    ctx.shadowBlur = 40 * r * sizeScale * brightnessBlur;
                    ctx.globalAlpha = 0.35 * breathAlpha * brightnessAlpha;
                    ctx.stroke();
                } finally {
                    ctx.restore();
                }

                // Layer 3: Main Body
                ctx.save();
                try {
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    createPath(glow_pad, top_padding_adjustment);
                    ctx.lineWidth = main_width * r * sizeScale;
                    ctx.strokeStyle = strokeStyle;
                    ctx.shadowColor = shadowColor;
                    ctx.shadowBlur = 18 * r * sizeScale * brightnessBlur;
                    ctx.globalAlpha = 0.85 * breathAlpha * brightnessAlpha;
                    ctx.stroke();
                } finally {
                    ctx.restore();
                }

                // Layer 4: Inner Core
                ctx.save();
                try {
                    ctx.lineJoin = "round";
                    ctx.lineCap = "round";
                    createPath(glow_pad, top_padding_adjustment);
                    ctx.lineWidth = core_width * r * sizeScale;
                    ctx.strokeStyle = "#FFFFFF"; // White core
                    ctx.shadowBlur = 5 * r * sizeScale * brightnessBlur;
                    ctx.shadowColor = "#FFFFFF";
                    ctx.globalAlpha = 1.0 * brightnessAlpha;
                    ctx.stroke();
                } finally {
                    ctx.restore();
                }
                if (timeEnabled) {
                    const nowMs = performance.now();
                    if (!runningStartTime) runningStartTime = nowMs;
                    const elapsedText = formatElapsed(nowMs - runningStartTime);
                    ctx.save();
                    try {
                        const fontSize = Math.max(11, 12 * r);
                        ctx.font = `bold ${fontSize}px monospace`;
                        ctx.textAlign = "left";
                        ctx.textBaseline = "bottom";
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
                        const outsideOffset = ambient_width * r * sizeScale * 0.5 + 6 * r;
                        const textX = bounds.x + 6 * r;
                        const textY = bounds.y - outsideOffset;
                        const textWidth = ctx.measureText(elapsedText).width;
                        const paddingX = 4 * r;
                        const paddingY = 2 * r;
                        const bgHeight = fontSize + paddingY * 2;
                        const bgWidth = textWidth + paddingX * 2;
                        const bgX = textX - paddingX;
                        const bgY = textY - bgHeight + 2 * r;
                        ctx.save();
                        ctx.fillStyle = `rgba(0, 0, 0, ${clamp01(timeBgOpacity, 0.55)})`;
                        ctx.shadowColor = "rgba(0, 0, 0, 0.7)";
                        ctx.shadowBlur = 8 * r;
                        ctx.shadowOffsetX = 0;
                        ctx.shadowOffsetY = 1 * r;
                        if (ctx.roundRect) {
                            ctx.beginPath();
                            ctx.roundRect(bgX, bgY, bgWidth, bgHeight, bgHeight / 2);
                            ctx.fill();
                        } else {
                            const radius = bgHeight / 2;
                            const right = bgX + bgWidth;
                            const bottom = bgY + bgHeight;
                            ctx.beginPath();
                            ctx.moveTo(bgX + radius, bgY);
                            ctx.lineTo(right - radius, bgY);
                            ctx.arc(right - radius, bgY + radius, radius, -Math.PI / 2, Math.PI / 2);
                            ctx.lineTo(bgX + radius, bottom);
                            ctx.arc(bgX + radius, bgY + radius, radius, Math.PI / 2, (Math.PI * 3) / 2);
                            ctx.closePath();
                            ctx.fill();
                        }
                        ctx.restore();
                        ctx.fillStyle = normalizeHex(timeColor, "#22FF22");
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
        const ensureMouseListener = () => {
            if (mouseListenerAttached) return;
            const canvasEl = app.canvas?.canvas || app.canvas?.el || app.canvas?.canvasEl;
            if (!canvasEl || !canvasEl.addEventListener) return;
            canvasEl.addEventListener("mousemove", () => {
                const now = performance.now();
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
                if (hasRunning) {
                    app.canvas.setDirty(true, true);
                }
                if (!hasRunning) return;
                const recentMouse = now - lastMouseMoveTime < 80;
                const activeBreathing = breathingEnabled && (autoBreathingEnabled || recentMouse);
                const nextDelay = activeBreathing ? 33 : 200;
                scheduleTick(nextDelay);
            }, Math.max(0, delay));
        };
        scheduleTick(0);
	}
});
