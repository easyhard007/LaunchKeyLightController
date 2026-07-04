// ==========================================
// 光学与物理灯光引擎 (Light & Color Engine)
// 当前模式: 上排8个Pad + 10ms隔行扫描(每次发4个) + 抛物线视觉修正
// ==========================================

const TOP_PADS = [96, 97, 98, 99, 100, 101, 102, 103]; 
// (下排暂不控制，但保留常数定义以备未来扩充)
const BOTTOM_PADS = [112, 113, 114, 115, 116, 117, 118, 119];

// === 核心设定 ===
const FADE_DURATION = 500;       // 衰减时间：500 毫秒
const MIDI_UPDATE_INTERVAL = 10; // 极限刷新间隔：10ms

// 全局状态库 (目前只用上排 8 个)
let globalPadColors = Array.from({length: 8}, () => ({
    baseHSL: { h: 0, s: 0, l: 0 },
    currentL: 0 
}));

let colorPicker = null;

// === 工具函数区 ===

function hslToRgb(h, s, l) {
    h /= 360; s /= 100; l /= 100;
    let r, g, b;
    if (s === 0) { r = g = b = l; } 
    else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1 / 3); g = hue2rgb(p, q, h); b = hue2rgb(p, q, h - 1 / 3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

// 亮度视觉修正曲线 (上凸抛物线: y = 1 - x^2)
function applyBrightnessCurve(linearL, baseL) {
    if (baseL <= 0 || linearL <= 0) return 0;
    let x = 1.0 - (linearL / baseL);
    let multiplier = 1.0 - (x * x);
    multiplier = Math.max(0, Math.min(1, multiplier));
    return baseL * multiplier;
}

// === 初始化系统 ===
function initColorPicker() {
    colorPicker = new iro.ColorPicker("#color-picker-container", {
        width: 180, 
        color: "#aa00ff", 
        layoutDirection: "horizontal", 
        layout: [
            { component: iro.ui.Wheel }, 
            { component: iro.ui.Slider, options: { sliderType: 'value', layoutDirection: 'vertical' } }
        ]
    });

    colorPicker.on('color:change', function(color) {
        const hsl = color.hsl; 
        for(let i = 0; i < 8; i++) {
            globalPadColors[i].baseHSL = { h: hsl.h, s: hsl.s, l: hsl.l };
        }
    });

    const hsl = colorPicker.color.hsl;
    for(let i = 0; i < 8; i++) {
        globalPadColors[i].baseHSL = { h: hsl.h, s: hsl.s, l: hsl.l };
        globalPadColors[i].currentL = 0; 
        renderDOMColor(i, { h: hsl.h, s: hsl.s, l: 0 }); 
    }
    
    requestAnimationFrame(engineLoop);
}

// === 外部触发：按下琴键 ===
function triggerPadLights() {
    for(let i = 0; i < 8; i++) {
        globalPadColors[i].currentL = globalPadColors[i].baseHSL.l; 
    }
    // 起音瞬间，全量发射 8 个灯，保证视觉无延迟爆发
    flushMidiBufferAll();
}

function forceSendCurrentColorToMidi() {
    if (colorPicker) triggerPadLights();
}

// === 渲染网页 UI ===
function renderDOMColor(index, hsl) {
    const lightDiv = document.getElementById(`vpad-light-${index}`);
    if(lightDiv) {
        let h = hsl.h, s = hsl.s, l = hsl.l;
        const stops = [
            `hsla(${h},${s}%,${l}%, 1) 0%`,
            `hsla(${h},${s}%,${l}%, 0.96) 10%`,
            `hsla(${h},${s}%,${l}%, 0.84) 30%`,
            `hsla(${h},${s}%,${l}%, 0.64) 68%`,
            `hsla(${h},${s}%,${l}%, 0.36) 96%`,
            `hsla(${h},${s}%,${l}%, 0) 120%`
        ].join(', ');
        lightDiv.style.background = `radial-gradient(circle farthest-corner at 50% 50%, ${stops})`;
    }
}

// =====================================
// 核心动画与驱动引擎
// =====================================
let lastFrameTime = performance.now();
let lastMidiSendTime = 0;
let renderFrameCounter = 0; // 隔行扫描计数器

function engineLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    let isAnyPadActive = false;
    let forceZeroFlush = false; 

    // 轨道 A：60Hz 视觉更新与 L 值衰减
    for (let i = 0; i < 8; i++) {
        let pad = globalPadColors[i];
        
        if (pad.currentL > 0) {
            isAnyPadActive = true;

            let decrement = (pad.baseHSL.l / FADE_DURATION) * deltaTime;
            pad.currentL -= decrement;
            
            if (pad.currentL <= 0) {
                pad.currentL = 0;
                forceZeroFlush = true; 
            }

            // UI 渲染应用抛物线修正
            let visualL = applyBrightnessCurve(pad.currentL, pad.baseHSL.l);
            renderDOMColor(i, { h: pad.baseHSL.h, s: pad.baseHSL.s, l: visualL });
        }
    }

    // 轨道 B：10ms 隔行扫描硬件通讯
    if (window.isRunning && window.midiOutput) {
        if (forceZeroFlush || (isAnyPadActive && currentTime - lastMidiSendTime >= MIDI_UPDATE_INTERVAL)) {
            
            // 翻转帧计数器 (0变1，1变0)
            renderFrameCounter = (renderFrameCounter + 1) % 2;

            if (forceZeroFlush) {
                // 如果有灯熄灭，破例发一次全量，绞杀残影
                flushMidiBufferAll();
            } else {
                // 正常衰减时，执行交错渲染
                flushMidiBufferInterlaced(renderFrameCounter);
            }
            
            lastMidiSendTime = currentTime;
        }
    }

    requestAnimationFrame(engineLoop);
}

// === 执行 MIDI 隔行发送 ===
function flushMidiBufferInterlaced(frame) {
    // 每次仅处理 8 个 Pad 中的 4 个 (i=0,2,4,6 或 i=1,3,5,7)
    for (let i = frame; i < 8; i += 2) {
        let pad = globalPadColors[i];
        
        let visualL = applyBrightnessCurve(pad.currentL, pad.baseHSL.l);
        let [r8, g8, b8] = hslToRgb(pad.baseHSL.h, pad.baseHSL.s, visualL);
        
        let r7 = Math.floor(r8 / 2);
        let g7 = Math.floor(g8 / 2);
        let b7 = Math.floor(b8 / 2);
        
        let padID = TOP_PADS[i];
        window.midiOutput.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x13, 0x01, 0x43, padID, r7, g7, b7, 0xF7]);
    }
}

// === 执行 MIDI 全量发送 (针对上排 8 个 Pad) ===
function flushMidiBufferAll() {
    for (let i = 0; i < 8; i++) {
        let pad = globalPadColors[i];
        
        let visualL = applyBrightnessCurve(pad.currentL, pad.baseHSL.l);
        let [r8, g8, b8] = hslToRgb(pad.baseHSL.h, pad.baseHSL.s, visualL);
        
        let r7 = Math.floor(r8 / 2);
        let g7 = Math.floor(g8 / 2);
        let b7 = Math.floor(b8 / 2);
        
        let padID = TOP_PADS[i];
        window.midiOutput.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x13, 0x01, 0x43, padID, r7, g7, b7, 0xF7]);
    }
}