# AGENTS.md

EasyEDA Pro (立创EDA专业版) 扩展「DRC 语音提醒」：原理图/PCB DRC 检测后按错误/警告数播放本地语音提示（未选文件时用系统 TTS 兜底；无问题则播「咸鱼翻身啦！」）。支持播放倍速与播放次数（按数量/只播一次）设置。

## 开发命令

- 安装依赖：`npm install`（node >= 20.17，本机已验证）
- 构建/打包：`npm run build` → 产出 `build/dist/<name>_v<version>.eext`
- 代码检查：`npm run lint`（仅 lint `src/`；`iframe/index.html` 内联 JS 不受 lint）

## 架构（来自官方 SDK 脚手架 pro-api-sdk）

- `extension.json`：`headerMenus[].menuItems[].registerFn` 按名称关联 `src/index.ts` 导出的函数。本扩展在 home/sch/pcb 三个菜单注册 `openDrcVoiceWindow`。
- `src/index.ts`：入口，`openDrcVoiceWindow()` 用 `eda.sys_IFrame.openIFrame('/iframe/index.html', 440, 480, id, {title})` 打开窗口。
- `iframe/index.html`：真正的 UI（按钮 + 倍速/次数设置 + 语音文件夹加载）。**iframe 可直接调用全局 `eda` 对象**（无需 postMessage）；用 `(typeof eda !== 'undefined') ? eda : window.parent.eda` 兜底。
- DRC：`eda.sch_Drc.check(true, false, true)` → `Array<ISCH_DrcError>`（`type` ∈ fatalError/error/warn）；`eda.pcb_Drc.check(true, false, true)` → `Array<any>`，PCB 项 `type` 字段需运行时确认。
- 语音文件：`wav/` 目录（仓库根），命名 `sch-error.wav`/`sch-warning.wav`/`pcb-error.wav`/`pcb-warning.wav`（可选 `pass.wav`）。加载与持久化：
  - 选择：`window.showDirectoryPicker()`（File System Access API），不可用时回退隐藏 `<input type="file" webkitdirectory multiple>`。
  - 持久化：选中的音频文件以 Blob 存入 IndexedDB（`drc-voice-alert` 库，键 `wav:<slot>`），重开窗口 `initFromSaved()` 自动读取（不依赖路径/权限，网页版/客户端通用）。
  - 兜底：`speechSynthesis` 播对应语句（`u.rate = 倍速`）。
- DRC 计数：`check(..., true)` 结果按规则聚合，实际违规数取条目的 `count` 字段（运行时实测 `{type:'error', count:7}`）；无 `count` 时取 `primitives.length`，再无则按 1 计。`type` ∈ fatalError/error/warn。
- 播放：优先 Web Audio（`AudioContext` 在点击手势内 `resume()` 解锁，`BufferSource.playbackRate = 倍速`），避免自动播放策略只放第一声；HTMLAudio 仅作 AudioContext 不可用时的兜底。
- 倍速：`BufferSource.playbackRate`（音频）/`utterance.rate`（TTS）；次数：`count`=按错误/警告数循环，`once`=每类只播一次。
- 打包模型：`.edaignore` 排除 `/src/`、`/wav/` 之外的仓库文件但保留 `dist/` 与 `iframe/`；首包时 `build/packaged.ts` 自动写入 32 位 `uuid` 到 extension.json。`wav/` 和 `AGENTS.md` 等不在包内。

## 导入与调试

- 导入：编辑器 V2「设置 → 扩展 → 扩展管理器… → 导入」；V3「高级 → 扩展管理器… → 导入」，选择 `.eext`。
- 调试：编辑器 URL 加 `?cll=debug`，连按 F12 三次开控制台；iframe 内 `console.log` 可见。
- 改动后需 `npm run build` 重新打包再导入；version 字段需递增。

## 注意

- 本仓库路径含非 ASCII（`DRC杂鱼`），官方不推荐；如 npm/构建异常优先排查路径问题。
- 音频播放依赖用户点击触发（浏览器自动播放策略，需在点击手势内解锁 `AudioContext`）；对象 URL 用 `URL.createObjectURL` 生成，更换文件时需 revoke 旧 URL。
- `sys_FileSystem.readFileFromFileSystem` / `existsPathInFileSystem` 仅客户端有效且需「外部交互权限」，网页版只能走 `openReadFolderDialog`（扩展已不依赖它们，改用 File System Access API）。
