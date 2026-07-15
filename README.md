# Claude Code Statusline

一个简洁美观的 Claude Code 状态栏脚本，显示模型信息、effort 级别和上下文使用情况。

## 效果预览

```text
[目录] · [模型名] · ●●●○○ high · ██████░░░░ 60%
```

## 功能特性

- 🎨 **彩色输出** - 支持 ANSI 256 色，视觉效果清晰
- 📊 **上下文进度条** - 实时显示上下文使用百分比
- ⚡ **Effort 指示器** - 5 级圆点显示当前 effort 级别
- 🔧 **模型名精简** - 自动提取并精简模型名称（如 `claude-opus-4-8-20250712` → `Opus 4.8`）
- 🛡️ **安全防护** - 清除 ANSI 转义序列，防止注入攻击
- ♿ **无障碍支持** - 支持 `NO_COLOR` 环境变量

## 安装配置

### 方式一：全局配置（推荐）

#### 第 1 步：下载脚本

将 `statusline.mjs` 复制到 Claude Code 配置目录：

```bash
# macOS / Linux
cp statusline.mjs ~/.claude/statusline.mjs

# Windows (PowerShell)
Copy-Item statusline.mjs $env:USERPROFILE\.claude\statusline.mjs
```

#### 第 2 步：配置 settings.json

编辑 Claude Code 的用户配置文件 `~/.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/.claude/statusline.mjs"
  }
}
```

**Windows 用户注意**：路径使用正斜杠或双反斜杠：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node C:/Users/你的用户名/.claude/statusline.mjs"
  }
}
```

#### 第 3 步：验证配置

重新启动 Claude Code 或开始新的对话，状态栏将自动显示在界面底部。

---

### 方式二：项目级配置

如果你想为特定项目使用不同的状态栏：

#### 第 1 步：将脚本放入项目

```bash
# 在项目根目录创建 .claude 文件夹
mkdir -p .claude

# 复制脚本到项目
cp statusline.mjs .claude/statusline.mjs
```

#### 第 2 步：配置项目设置

编辑项目中的 `.claude/settings.json`：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node .claude/statusline.mjs"
  }
}
```

---

### 方式三：克隆仓库直接使用

```bash
# 克隆到本地
git clone https://github.com/1Lurgee/claude-code-statusline.git ~/claude-code-statusline

# 配置 settings.json
```

然后在 `~/.claude/settings.json` 中设置：

```json
{
  "statusLine": {
    "type": "command",
    "command": "node ~/claude-code-statusline/statusline.mjs"
  }
}
```

## 数据格式

脚本通过 stdin 接收 JSON 数据，支持以下字段：

| 字段路径 | 类型 | 说明 |
| --- | --- | --- |
| `model.display_name` | string | 模型显示名称（优先级最高） |
| `model.name` | string | 模型名称 |
| `model.id` | string | 模型 ID |
| `effort` | string | effort 级别：`low`/`medium`/`high`/`xhigh`/`max` |
| `context_window.remaining_percentage` | number | 上下文剩余百分比 (0-100) |
| `context_window.used_percentage` | number | 上下文已使用百分比 |
| `workspace.current_dir` | string | 当前工作目录 |

### 测试脚本

```bash
# macOS / Linux
echo '{"model":{"display_name":"claude-opus-4-8-20250712"},"effort":"high","context_window":{"remaining_percentage":65},"workspace":{"current_dir":"/home/user/project"}}' | node ~/.claude/statusline.mjs

# Windows (PowerShell)
'{\"model\":{\"display_name\":\"claude-opus-4-8-20250712\"},\"effort\":\"high\",\"context_window\":{\"remaining_percentage\":65}}' | node $env:USERPROFILE\.claude\statusline.mjs
```

## 环境变量

| 变量 | 说明 |
| --- | --- |
| `NO_COLOR` | 设置后禁用所有颜色输出（符合 [no-color.org](https://no-color.org) 标准） |
| `CLAUDE_STATUSLINE_DEBUG` | 设置后输出原始 JSON 数据用于调试 |

### 调试模式

```bash
# 启用调试，查看 Claude Code 传入的原始数据
CLAUDE_STATUSLINE_DEBUG=1 echo '...' | node statusline.mjs
```

## 自定义配置

### 颜色配置

修改脚本顶部的 `C` 对象来自定义颜色（使用 RGB 格式）：

```javascript
const C = {
  ACCENT: '\x1b[38;2;232;175;95m',  // 强调色（橙色）
  GREEN:  '\x1b[38;2;80;200;120m',  // 绿色
  YELLOW: '\x1b[38;2;240;200;80m',  // 黄色
  RED:    '\x1b[38;2;220;80;80m',   // 红色
  CYAN:   '\x1b[38;2;100;210;220m', // 青色
  BG:     '\x1b[48;2;30;30;36m',    // 背景色
};
```

### 上下文阈值配置

修改 `contextColor` 函数调整颜色阈值：

```javascript
function contextColor(pct) {
  if (pct < 30) return 'red';     // 低于 30% 显示红色
  if (pct < 60) return 'yellow';  // 低于 60% 显示黄色
  return 'green';                 // 60% 以上显示绿色
}
```

### 进度条宽度

修改 `CONTEXT_BAR_WIDTH` 常量调整进度条宽度：

```javascript
const CONTEXT_BAR_WIDTH = 10;  // 默认 10 个字符宽度
```

## 常见问题

### Q: 状态栏没有显示？

1. 确认 `~/.claude/settings.json` 文件存在且格式正确
2. 确认 Node.js 已安装：`node --version`
3. 检查脚本路径是否正确
4. 尝试重启 Claude Code

### Q: 颜色显示异常？

- 确保终端支持 256 色或 TrueColor
- Windows 用户建议使用 Windows Terminal
- 如需禁用颜色，设置环境变量：`NO_COLOR=1`

### Q: 如何恢复默认状态栏？

从 `~/.claude/settings.json` 中删除 `statusLine` 配置项即可。

## 许可证

[MIT License](LICENSE)
