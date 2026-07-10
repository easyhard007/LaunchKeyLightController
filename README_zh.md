# 🎹 Launchkey Light Station MK4

<p align="center">
  <a href="README.md">English</a> | <b>简体中文</b>
</p>

> 专为 **Novation Launchkey 25/37/49/61 MK4 (常规版和mini版)** 系列开发的 Web MIDI 视觉与和声分析工作站。

## ✨ 核心功能

- **实时和声分析**：通过捕获 MIDI 输入，实时分析用户弹奏的音符，判定当前和弦及所在调性。
- **T/S/D 功能色彩反馈**：将识别出的和弦归类为主（T）、下属（S）、属（D）等功能组，并在 Launchkey 的打击垫上映射对应的颜色。
- **硬件级灯光控制**：利用 Web MIDI API 发送 SysEx 系统专有信息，直接接管 Launchkey MK4 的打击垫灯光，实现低延迟的视觉同步。
- **动态视觉引擎**：内置基于 WebGL 的极光背景，背景色彩和流动强度会根据当前和弦色彩与弹奏力度包络进行实时反馈。
- **PWA 与离线支持**：采用毛玻璃（Glassmorphism）响应式 UI 设计。支持添加到移动设备主屏幕，且支持完全脱机运行。

## ⚙️ 使用说明

1. **连接设备**：通过 USB 或 OTG 线将 Launchkey MK4 连接至手机、平板或电脑。
2. **打开网页**：使用 Chrome 或 Safari 浏览器访问 [在线演示](https://easyhard007.github.io/LaunchkeyLightController/)。
   * *提示：建议点击浏览器菜单中的“添加到主屏幕”，以获得全屏体验。*
3. **配置端口**：
   - 点击界面左下角的 `?` 悬浮按钮进入设置面板。
   - 选择对应的设备尺寸型号。
   - 在下拉菜单中选择 **DAW 端口**（例如 `MIDIIN2` 或 `Launchkey DAW`）。*请注意避开普通的 MIDI 输入端口。*
4. **启动控制**：点击 **“启动”**。Launchkey 上的打击垫会闪烁两次白光，代表系统已成功接管硬件。
5. **开始弹奏**：弹奏和弦，观察屏幕界面与硬件打击垫基于和声功能的灯光变化。

## 🛠️ 技术实现

- **和声算法补丁**：基于 `Tonal.js` 开发。加入了高音修剪（Top-note Pruning）与基于低音音程的双音推断逻辑，以解决原生库在处理省略音和弦（Shell Voicings）时的局限性。
- **双轨渲染与节流**：将 UI 渲染循环（60Hz）与 MIDI SysEx 发送循环（限制为 30Hz）解耦。通过脏数据比对（Dirty-state Caching）减少不必要的 USB 通信，避免硬件卡顿。
- **非对称平滑包络**：对 MIDI 力度应用起音快、衰减慢的指数平滑算法，模拟自然的物理余光消散效果。

## 📜 开源协议
Apache-2.0 license
