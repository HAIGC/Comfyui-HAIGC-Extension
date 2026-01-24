# ComfyUI HAIGC Highlight Extension

[English](#english)

## 简介
本扩展用于在 ComfyUI 中突出显示当前正在运行的节点，提供更醒目的高亮边框、呼吸灯效果及运行时间显示，适合节点较多的工作流快速定位执行位置。

## 功能特性
- **高亮优化**：覆盖官方运行高亮框，整体更醒目，支持柔和光晕效果。
- **时间显示**：在节点左上角实时显示运行耗时（格式：00:00s）。
- **状态反馈**：
  - 🟢 **运行中**：自定义颜色的呼吸灯（默认白色 #fafafa）。
  - 🟣 **报错**：节点运行失败时显示紫色呼吸灯框（#9932CC），快速定位错误。
  - 🔴 **缺少输入**：检测到必要输入未连接时显示红色提示。
- **萤火虫呼吸**：采用拟合萤火虫发光的呼吸算法，光效更自然。
- **性能模式**：深度优化的低功耗模式，极低资源占用（静止时近乎零消耗）。
- **个性化设置**：支持自定义颜色（单色/渐变）、呼吸频率、大小、亮度等。

## 安装
将本仓库放入 ComfyUI 的 `custom_nodes` 目录：
```
ComfyUI/
└── custom_nodes/
    └── Comfyui-HAIGC-Extension/
```

## 使用方式
1. 启动 ComfyUI。
2. 打开 Settings（设置）。
3. 在设置中找到 `HAIGC 高亮` 相关选项进行调整。

## 设置说明
- **HAIGC 高亮：鼠标触发呼吸**  
  开启后，当鼠标移动时会触发轻微的呼吸效果（默认关闭以节省资源）。
  
- **HAIGC 高亮：自动呼吸**  
  开启后，高亮框会持续自动呼吸（默认关闭）。

- **HAIGC 高亮：呼吸周期 (s)**  
  呼吸动画的快慢，单位为秒。

- **HAIGC 高亮：呼吸大小/亮度**  
  调节光晕的扩散范围和亮度倍率。

- **HAIGC 高亮：颜色设置**  
  - 单色：输入 `#fafafa`  
  - 渐变：输入 `#FF0000,#0000FF`  
  - 内置多种预设（赛博、火焰、彩虹等）供快速选择。

## 常见问题
- **颜色无法改变**  
  请确认修改后刷新页面或重新启动 ComfyUI，确保扩展文件被重新加载。

- **呼吸灯不亮**  
  默认情况下“自动呼吸”和“鼠标触发”均为关闭状态，只有在节点运行时才会亮起。如需常亮请在设置中开启“自动呼吸”。

## 作者
- 作者：HAIGC  
- 微信：HAIGC1994

## 相关链接
- 工作流体验地址：https://www.runninghub.cn/post/2014536001888198657/inviteCode=rh-v1127
- 推荐 ComfyUI 云平台，通过这个地址注册送 1000 点算力：https://www.runninghub.cn/user-center/1887871050510716930/webapp?inviteCode=rh-v1127
- 已注册还未绑定邀请码可绑定邀请码：rh-v1127 赠送 1000 点算力

---

<details>
<summary><strong>English</strong></summary>

<a id="english"></a>

## Overview
This extension highlights the currently running node in ComfyUI with a strong neon outline, breathing effect, and execution timer, making it easier to locate execution points in large graphs.

## Features
- **Enhanced Highlight**: Stronger and softer neon outline than the official one.
- **Timer Display**: Real-time execution timer displayed at the top-left of the node.
- **Status Feedback**:
  - 🟢 **Running**: Custom colored breathing light (Default: #fafafa).
  - 🟣 **Error**: Purple breathing light (#9932CC) for failed nodes.
  - 🔴 **Missing Input**: Red highlight for nodes with missing required inputs.
- **Firefly Breathing**: Natural breathing animation algorithm mimicking firefly light patterns.
- **Performance Mode**: Optimized for low power consumption with minimal resource usage.
- **Customization**: Fully configurable colors (solid/gradient), breathing speed, size, and brightness.

## Installation
Place this repository inside ComfyUI’s `custom_nodes` folder:
```
ComfyUI/
└── custom_nodes/
    └── Comfyui-HAIGC-Extension/
```

## Usage
1. Start ComfyUI.
2. Open Settings.
3. Locate `HAIGC Highlight` settings and customize.

## Settings
- **HAIGC Highlight: Mouse Trigger Breathing**  
  Enable subtle breathing effect on mouse movement (Default: Off).

- **HAIGC Highlight: Auto Breathing**  
  Enable continuous breathing animation (Default: Off).

- **HAIGC Highlight: Breathing Period (s)**  
  Speed of the breathing animation.

- **HAIGC Highlight: Color Setting**  
  - Solid color: `#fafafa`  
  - Gradient: `#FF0000,#0000FF`  
  - Presets available.

</details>
