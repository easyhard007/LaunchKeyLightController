// ==========================================
// 光学与物理灯光引擎 (Light & Color Engine)
// 依赖：iro.js
// 依赖全局变量：midiOutput, isRunning (由 index.html 提供)
// ==========================================

const TOP_PADS = [96, 97, 98, 99, 100, 101, 102, 103]; 
const BOTTOM_PADS = [112, 113, 114, 115, 116, 117, 118, 119];
const ALL_PADS = [...TOP_PADS, ...BOTTOM_PADS];

let globalPadColors = Array.from({length: 16}, () => ({r: 0, g: 0, b: 0}));

let colorPicker = null;
let midiSendTimeout = null;
let pendingMidiUpdates = new Set(); 

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
        const rgb = color.rgb; 
        for(let i = 0; i < 16; i++) {
            updatePadColorState(i, rgb.r, rgb.g, rgb.b);
        }
    });
    
    const rgb = colorPicker.color.rgb;
    for(let i = 0; i < 16; i++) {
        updatePadColorState(i, rgb.r, rgb.g, rgb.b);
    }
}

function updatePadColorState(index, r8, g8, b8) {
    globalPadColors[index] = { r: r8, g: g8, b: b8 };
    
    const lightDiv = document.getElementById(`vpad-light-${index}`);
    if(lightDiv) {
        // 饱满平滑的抛物线衰减曲线：y = 1 - x^2
        const stops = [
            `rgba(${r8},${g8},${b8}, 1) 0%`,
            `rgba(${r8},${g8},${b8}, 0.96) 10%`,
            `rgba(${r8},${g8},${b8}, 0.84) 30%`,
            `rgba(${r8},${g8},${b8}, 0.64) 68%`,
            `rgba(${r8},${g8},${b8}, 0.36) 96%`,
            // 核心修改：把完全变黑的截止点拉伸到 120% 的位置！
            // 这意味着在四个角落 (大概 100% 的位置)，还残存着一点极其微弱的物理漫反射光。
            `rgba(${r8},${g8},${b8}, 0) 120%`
        ].join(', ');
        
        // 使用 farthest-corner，配合 120% 外扩衰减，达成最终物理拟真
        lightDiv.style.background = `radial-gradient(circle farthest-corner at 50% 50%, ${stops})`;
    }

    if(window.isRunning && window.midiOutput) {
        queueMidiSend(index, r8, g8, b8);
    }
}

function queueMidiSend(index, r8, g8, b8) {
    pendingMidiUpdates.add(index);
    if (!midiSendTimeout) {
        midiSendTimeout = setTimeout(() => flushMidiBuffer(), 30);
    }
}

function flushMidiBuffer() {
    midiSendTimeout = null;
    if (!window.isRunning || !window.midiOutput) {
        pendingMidiUpdates.clear();
        return;
    }
    pendingMidiUpdates.forEach(index => {
        let color = globalPadColors[index];
        let r7 = Math.floor(color.r / 2);
        let g7 = Math.floor(color.g / 2);
        let b7 = Math.floor(color.b / 2);
        let padID = index < 8 ? TOP_PADS[index] : BOTTOM_PADS[index - 8];
        
        window.midiOutput.send([0xF0, 0x00, 0x20, 0x29, 0x02, 0x13, 0x01, 0x43, padID, r7, g7, b7, 0xF7]);
    });
    pendingMidiUpdates.clear();
}

function forceSendCurrentColorToMidi() {
    if (!colorPicker) return;
    const rgb = colorPicker.color.rgb;
    for(let i = 0; i < 16; i++) {
        updatePadColorState(i, rgb.r, rgb.g, rgb.b);
    }
}