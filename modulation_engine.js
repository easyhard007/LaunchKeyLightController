// ==========================================
// 终止式与特征和弦转调引擎 (Modulation Engine)
// 包含：硬性终止转调 (Hijack) & 信心动摇机制 (Degrade)
// ==========================================

let modulationDebounceTimer = null;
let lastStableChord = "";

// === 工具函数：音名位移 ===
function getTransposedPc(rootName, semitones) {
    const pc = Tonal.Note.chroma(rootName);
    return (pc + semitones) % 12;
}

// === 核心机制 A：洗脑向量表 (硬性转调) ===
function hijackPitchWeights(targetPcs) {
    for (let i = 0; i < 12; i++) {
        currentPitchWeights[i] = 0.0;
    }

    targetPcs.forEach(pc => {
        const template = SCALE_VECTORS[pc].vector;
        for (let i = 0; i < 12; i++) {
            currentPitchWeights[i] += template[i] * 5.0; 
        }
    });

    if (typeof refreshKeyboardUI === 'function') refreshKeyboardUI();

    const weightRow = document.getElementById('pitch-weights-row');
    if (weightRow) {
        weightRow.classList.remove('flash-highlight-bg');
        void weightRow.offsetWidth; 
        weightRow.classList.add('flash-highlight-bg');
    }
}

// === 核心机制 B：削弱向量表 (信心动摇 / 软性转调预备) ===
function weakenPitchWeights(multiplier) {
    for (let i = 0; i < 12; i++) {
        currentPitchWeights[i] *= multiplier;
    }
    
    if (typeof refreshKeyboardUI === 'function') refreshKeyboardUI();
    
    // 我们同样给它一个轻微的闪烁反馈，比如用橙色闪一下代表“受到冲击”
    // 注意：需要在 style.css 中补一个 flash-bg-orange 类，或者这里复用黄色的，我复用黄色的
    const weightRow = document.getElementById('pitch-weights-row');
    if (weightRow) {
        weightRow.classList.remove('flash-highlight-bg');
        void weightRow.offsetWidth; 
        weightRow.classList.add('flash-highlight-bg');
    }
}


// === 核心业务：分析和弦是否触发转调或动摇 ===
function evaluateModulation(chordName) {
    if (!chordName || globalScaleRoot === "-") return;

    const chord = Tonal.Chord.get(chordName);
    if (!chord || !chord.tonic) return;

    const chordRoot = chord.tonic; 
    const chordSuffix = chordName.substring(chordRoot.length);
    const chordPc = Tonal.Note.chroma(chordRoot);
    const scaleRootPc = Tonal.Note.chroma(globalScaleRoot); 

    const rootDiff = (chordPc - scaleRootPc + 12) % 12;

    // ----------------------------------------------------
    // 规则 (1): 异常属七和弦判定
    // ----------------------------------------------------
    if (chordSuffix === "7") {
        const allowedDom7 = [0, 2, 4, 5, 7, 9, 11, 10];
        if (!allowedDom7.includes(rootDiff)) {
            const targetA = (chordPc + 5) % 12;
            const targetB = (chordPc + 8) % 12;
            hijackPitchWeights([targetA, targetB]);
            return; 
        }
    }

    // ----------------------------------------------------
    // 规则 (2): 异常 maj7 和弦判定
    // ----------------------------------------------------
    if (chordSuffix === "maj7") {
        const allowedMaj7 = [0, 5];
        if (!allowedMaj7.includes(rootDiff)) {
            const targetA = chordPc;
            const targetB = (chordPc + 7) % 12;
            hijackPitchWeights([targetA, targetB]);
            return;
        }
    }

    // ----------------------------------------------------
    // 规则 (3): 同主音小调借用 / 平行调切换判定
    // ----------------------------------------------------
    let isModalInterchange = false;

    if (chordSuffix === "m" || chordSuffix === "m7") {
        if ([0, 5, 7].includes(rootDiff)) isModalInterchange = true;
    }
    else if (chordSuffix === "maj7" || chordSuffix === "") {
        if ([3, 8, 10].includes(rootDiff)) isModalInterchange = true;
    }
    else if (chordSuffix === "7") {
        if (rootDiff === 10) isModalInterchange = true;
    }

    if (isModalInterchange) {
        const targetA = (scaleRootPc + 3) % 12;
        hijackPitchWeights([targetA]);
        return;
    }

// ----------------------------------------------------
    // 规则 (4): 信心动摇机制 (半离调和弦降权)
    // ----------------------------------------------------
    
    // a. 弹奏了 #Im, #Im7, #IVm, #IVm7, VIIm, VIIm7 -> 衰减 0.5 倍
    // #I 对应 rootDiff = 1
    // #IV 对应 rootDiff = 6
    // VII 对应 rootDiff = 11
    if (chordSuffix === "m" || chordSuffix === "m7") {
        if ([1, 6, 11].includes(rootDiff)) {
            weakenPitchWeights(0.5);
            return;
        }
    }

    // b. 弹奏了 VIM, IIM -> 衰减 0.7 倍
    // 大三和弦 (空后缀)。VI 对应 rootDiff = 9, II 对应 rootDiff = 2
    if (chordSuffix === "") {
        if ([9, 2].includes(rootDiff)) {
            weakenPitchWeights(0.7);
            return;
        }
    }
}


// === 外部接口：供 index.html 调用的防抖触发器 ===
function checkAndApplyModulation(bestChordName) {
    if (!bestChordName) return;

    if (bestChordName !== lastStableChord) {
        lastStableChord = bestChordName;
        
        if (modulationDebounceTimer) {
            clearTimeout(modulationDebounceTimer);
        }

        modulationDebounceTimer = setTimeout(() => {
            evaluateModulation(lastStableChord);
        }, 300);
    }
}