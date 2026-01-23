# ComfyUI HAIGC Highlight Extension

[English](#english)

## 简介
本扩展用于在 ComfyUI 中突出显示当前正在运行的节点，提供更醒目的高亮边框与呼吸灯效果，适合节点较多的工作流快速定位执行位置。

## 功能特性
- 覆盖官方运行高亮框，整体更醒目
- 呼吸灯效果可调节
- 支持单色与渐变色高亮
- 支持自定义高亮强度与周期

## 安装
将本仓库放入 ComfyUI 的 `custom_nodes` 目录：
```
ComfyUI/
└── custom_nodes/
    └── Comfyui-HAIGC-Extension/
```

## 使用方式
1. 启动 ComfyUI
2. 打开 Settings（设置）
3. 在设置中找到 `HAIGC 高亮` 相关选项进行调整

## 设置说明
- **HAIGC 高亮：呼吸灯**  
  开启或关闭呼吸效果

- **HAIGC 高亮：呼吸周期 (s)**  
  单位为秒，支持浮点数

- **HAIGC 高亮：呼吸强度**  
  范围 0–100，数值越大起伏越明显

- **HAIGC 高亮：颜色设置**  
  - 单色：输入 `#22FF22`  
  - 渐变：输入 `#FF0000,#0000FF`  
  - 也可使用拾色器与预设快速选择

## 常见问题
- **颜色无法改变**  
  请确认修改后刷新页面或重新启动 ComfyUI，确保扩展文件被重新加载。

- **高亮不显示**  
  确认扩展目录是否放在 `custom_nodes` 中，并确认 `__init__.py` 已加载。

## 作者
- 作者：HAIGC  
- 微信：HAIGC1994

## 相关链接
- 工作流体验地址：`https://www.runninghub.cn/post/2014536001888198657/inviteCode=rh-v1127`
- 推荐 ComfyUI 云平台，通过这个地址注册送 1000 点算力：`https://www.runninghub.cn/user-center/1887871050510716930/webapp?inviteCode=rh-v1127`
- 已注册还未绑定邀请码可绑定邀请码：rh-v1127 赠送 1000 点算力

---

<details>
<summary><strong>English (Click to Expand)</strong></summary>

<a id="english"></a>

## Overview
This extension highlights the currently running node in ComfyUI with a strong neon outline and breathing effect, making it easier to locate execution points in large graphs.

## Features
- Fully covers the official running highlight
- Adjustable breathing animation
- Supports solid and gradient colors
- Configurable strength and period

## Installation
Place this repository inside ComfyUI’s `custom_nodes` folder:
```
ComfyUI/
└── custom_nodes/
    └── Comfyui-HAIGC-Extension/
```

## Usage
1. Start ComfyUI
2. Open Settings
3. Locate `HAIGC Highlight` settings and customize

## Settings
- **HAIGC Highlight: Breathing**  
  Enables or disables breathing animation

- **HAIGC Highlight: Breathing Period (s)**  
  In seconds, supports float values

- **HAIGC Highlight: Breathing Strength**  
  Range 0–100, higher means stronger pulse

- **HAIGC Highlight: Color Setting**  
  - Solid color: `#22FF22`  
  - Gradient: `#FF0000,#0000FF`  
  - You can also use the color picker and presets

## FAQ
- **Color does not change**  
  Refresh the page or restart ComfyUI to reload the extension.

- **Highlight not visible**  
  Ensure the extension is placed in `custom_nodes` and `__init__.py` is loaded.

## Author
- Author: HAIGC  
- WeChat: HAIGC1994

## Links
- Workflow demo: `https://www.runninghub.ai/post/2014536001888198657/inviteCode=rh-v1127`
- Recommended ComfyUI cloud platform (get 1000 compute credits on signup): `https://www.runninghub.ai/user-center/1887871050510716930/webapp?inviteCode=rh-v1127`
- If already registered, bind invite code rh-v1127 to receive 1000 compute credits

</details>
