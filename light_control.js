// ==========================================
// 光学与物理灯光引擎 (Light & Color Engine v5.3)
// 完美融合版：恢复色环UI + 动效16ms + 发送33ms限速解耦
// ==========================================

const TOP_PADS = [96, 97, 98, 99, 100, 101, 102, 103]; 
const BOTTOM_PADS = [112, 113, 114, 115, 116, 117, 118, 119];

const FADE_DURATION = 500;       
const ANIMATION_TICK = 16;       // 约 60Hz 动效帧率 (UI推波极速)
const MIDI_SEND_TICK = 33;       // 约 30Hz 硬件发送门限 (保护 MIDI 不卡)
const IDLE_LIGHTNESS = 0; 

// === 非对称平滑引擎参数 (保留用户的精调参数) ===
let smoothedVolume = 0.0;       
const ALPHA_DECAY = 0.9;        // 下降平滑
const BETA_ATTACK = 0.7;        // 爆发平滑

// globalPadColors: 用于 UI 和 MIDI 发送的绝对显示颜色
let globalPadColors = Array.from({length: 16}, () => ({ h: 0, s: 0, l: 0 }));

// padLightSources: 独立光源池 (当前只用 padLightSources[0] 作为发起源)
window.padLightSources = Array.from({length: 16}, () => ({
    userHSL: { h: 0, s: 0, l: 0 },
    envelope: 0 
}));

let colorPicker = null;

// === Driver 层：脏数据缓存 ===
let lastSentColors = Array.from({length: 16}, () => ({ r: -1, g: -1, b: -1 }));

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

// 真正受限的 MIDI 派发器 (结合了脏数据过滤)
function flushMidiDriver() {
    if (!window.isRunning || !window.midiOutput) return;

    for (let i = 0; i < 8; i++) { 
        let color = globalPadColors[i];
        let [r8, g8, b8] = hslToRgb(color.h, color.s, color.l);
        
        let r7 = Math.floor(r8 / 2);
        let g7 = Math.floor(g8 / 2);
        let b7 = Math.floor(b8 / 2);

        // 脏数据拦截
        if (r7 !== lastSentColors[i].r || g7 !== lastSentColors[i].g || b7 !== lastSentColors[i].b) {
            window.midiOutput.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x13, 0x01, 0x43, TOP_PADS[i], r7, g7, b7, 0xF7]);
            lastSentColors[i] = { r: r7, g: g7, b: b7 };
        }
    }
}

// 笛卡尔坐标系 HSL 插值
function interpolateHSL(source, target, progress) {
    progress = Math.max(0, Math.min(1, progress));
    let h1 = source.h, s1 = source.s;
    let h2 = target.h, s2 = target.s;
    
    if (s1 < 1) h1 = h2;
    if (s2 < 1) h2 = h1;

    const h1Rad = h1 * (Math.PI / 180);
    const h2Rad = h2 * (Math.PI / 180);
    
    const x1 = s1 * Math.cos(h1Rad);
    const y1 = s1 * Math.sin(h1Rad);
    const x2 = s2 * Math.cos(h2Rad);
    const y2 = s2 * Math.sin(h2Rad);
    
    const currentX = x1 + (x2 - x1) * progress;
    const currentY = y1 + (y2 - y1) * progress;
    
    let currentS = Math.sqrt(currentX * currentX + currentY * currentY);
    let currentH = Math.atan2(currentY, currentX) * (180 / Math.PI);
    if (currentH < 0) currentH += 360;
    
    let currentL = source.l + (target.l - source.l) * progress;
    
    return { h: currentH, s: currentS, l: currentL };
}

// === 动效模块 (Wave Animator) ===
function applyWaveEffect() {
    for (let i = 7; i >= 1; i--) {
        let prevPad = globalPadColors[i - 1];
        let currentPad = globalPadColors[i];
        // 0.4 保留自身惯性，0.6 接收前方的光波
        globalPadColors[i] = interpolateHSL(currentPad, prevPad, 0.6);
    }
}

// === 恢复：调色盘渲染 ===
function initColorPicker() {
    colorPicker = new iro.ColorPicker("#color-picker-container", {
        width: 180, 
        color: "#aa00ff", // 初始占位颜色
        layout: [ { component: iro.ui.Wheel } ]
    });

    // 绘制 TSD 外层 SVG
    setTimeout(() => {
        if (typeof initTSDOverlay === 'function') initTSDOverlay();
    }, 100);
    
    // 初始化颜色数组
    const hsl = colorPicker.color.hsl;
    window.padLightSources[0].userHSL = { h: hsl.h, s: hsl.s, l: 100 };
    
    requestAnimationFrame(engineLoop);
}

// === 渲染主循环 ===
let lastFrameTime = performance.now();
let lastEngineTick = 0; 
let lastMidiSendTick = 0; // 新增：独立的 MIDI 发送计时器

function engineLoop(currentTime) {
    const deltaTime = currentTime - lastFrameTime;
    lastFrameTime = currentTime;

    // ==========================================
    // 1. 触发并更新虚拟钢琴引擎
    // ==========================================
    if (typeof updateVirtualPianoEngine === 'function') {
        updateVirtualPianoEngine(currentTime);
    }

    // ==========================================
    // 2. 经过不对称平滑引擎处理 (消除抖动)
    // ==========================================
    let rawVolume = window.virtualAudioVolume || 0;
    
    if (rawVolume > smoothedVolume) {
        smoothedVolume = smoothedVolume * BETA_ATTACK + rawVolume * (1 - BETA_ATTACK);
    } else {
        smoothedVolume = smoothedVolume * ALPHA_DECAY + rawVolume * (1 - ALPHA_DECAY);
    }
    if (smoothedVolume < 0.005) smoothedVolume = 0.0;

    // ==========================================
    // 3. 将平滑后的能量进行“向上压缩映射”注入光源
    // ==========================================
    let sourcePad = window.padLightSources[0];
    
    let compressedVolume = Math.pow(smoothedVolume, 0.4);
    sourcePad.envelope = Math.max(0, Math.min(1.0, compressedVolume)); 

    const MAX_LIGHTNESS = 60;
    
    let currentL = IDLE_LIGHTNESS + (MAX_LIGHTNESS - IDLE_LIGHTNESS) * sourcePad.envelope;
    let currentS = sourcePad.userHSL.s * sourcePad.envelope;
    
    globalPadColors[0] = { h: sourcePad.userHSL.h, s: currentS, l: currentL };

    let isAnyPadActive = (sourcePad.envelope > 0);
    let forceIdleFlush = false;
    
    if (!window.isRunning) {
        forceIdleFlush = true; 
    } else {
        isAnyPadActive = true; 
    }

    // ==========================================
    // 4. 动效模块 (按 16ms 极速推波，保证网页UI丝滑)
    // ==========================================
    if (currentTime - lastEngineTick >= ANIMATION_TICK) {
        applyWaveEffect();
        lastEngineTick = currentTime;
    }

	// 渲染网页 UI (使用用户的发光参数)
    for (let i = 0; i < 8; i++) {
        const lightDiv = document.getElementById(`vpad-light-${i}`);
        if(lightDiv) {
            let h = globalPadColors[i].h, s = globalPadColors[i].s, l = globalPadColors[i].l;
            
            // 【核心修复】：必须先把 HSL 转换为 RGB，再传给你的 rgba 字符串！
            let [r8, g8, b8] = hslToRgb(h, s, l);
            
            const stops = [
                `rgba(${r8},${g8},${b8}, 1) 0%`,
                `rgba(${r8},${g8},${b8}, 0.96) 10%`,
                `rgba(${r8},${g8},${b8}, 0.84) 30%`,
                `rgba(${r8},${g8},${b8}, 0.64) 68%`,
                `rgba(${r8},${g8},${b8}, 0.36) 96%`,
                `rgba(${r8},${g8},${b8}, 0) 120%`
            ].join(', ');
            
            lightDiv.style.background = `radial-gradient(circle farthest-corner at 50% 50%, ${stops})`;
        }
    }

    // ==========================================
    // 5. 【核心修复】发射器 (受 MIDI_SEND_TICK 33ms 限速保护)
    // ==========================================
    if (window.isRunning && window.midiOutput) {
        // 只有到了 33ms 门限，或者需要强制关灯时，才触发 flushMidiDriver()
        if (forceIdleFlush || (isAnyPadActive && currentTime - lastMidiSendTick >= MIDI_SEND_TICK)) {
            flushMidiDriver();
            lastMidiSendTick = currentTime;
        }
    }

    requestAnimationFrame(engineLoop);
}