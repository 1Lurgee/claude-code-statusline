# Claude Code Statusline

一个简洁美观的 Claude Code 状态栏脚本，显示模型信息、effort 级别和上下文使用情况。

## 效果预览

```
[目录] · [模型名] · ●●●○○ high · ██████░░░░ 60%
```

## 功能特性

- 🎨 **彩色输出** - 支持 ANSI 256 色，视觉效果清晰
- 📊 **上下文进度条** - 实时显示上下文使用百分比
- ⚡ **Effort 指示器** - 5 级圆点显示当前 effort 级别
- 🔧 **模型名精简** - 自动提取并精简模型名称
- 🛡️ **安全防护** - 清除 ANSI 转义序列，防止注入攻击
- ♿ **无障碍支持** - 支持 `NO_COLOR` 环境变量

## 安装

1. 克隆仓库：
```bash
git clone https://github.com/yourusername/claude-code-statusline.git
cd claude-code-statusline
```

2. 在 Claude Code 配置中设置 statusline 脚本路径：
```json
{
  "statusLine": "node /path/to/statusline.mjs"
}
```

## 使用方法

脚本通过 stdin 接收 JSON 数据，输出格式化的状态栏：

```bash
echo '{"model":{"name":"claude-opus-4-8-20250712"},"effort":"high","context_window":{"remaining_percentage":65}}' | node statusline.mjs
```

## 数据格式

脚本支持以下 JSON 字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `model.name` | string | 模型名称 |
| `model.display_name` | string | 显示名称（优先级更高）|
| `effort` | string | effort 级别：low/medium/high/xhigh/max |
| `context_window.remaining_percentage` | number | 上下文剩余百分比 (0-100) |
| `workspace.current_dir` | string | 当前工作目录 |

## 环境变量

| 变量 | 说明 |
|------|------|
| `NO_COLOR` | 设置后禁用所有颜色输出 |
| `CLAUDE_STATUSLINE_DEBUG` | 设置后输出原始 JSON 数据用于调试 |

## 自定义

### 颜色配置

修改脚本顶部的 `C` 对象来自定义颜色：

```javascript
const C = {
  ACCENT: '\x1b[38;2;232;175;95m',  // 强调色
  GREEN:  '\x1b[38;2;80;200;120m',  // 绿色
  YELLOW: '\x1b[38;2;240;200;80m',  // 黄色
  RED:    '\x1b[38;2;220;80;80m',   // 红色
  // ...
};
```

### 阈值配置

修改 `contextColor` 函数调整上下文百分比的颜色阈值：

```javascript
function contextColor(pct) {
  if (pct < 30) return 'red';
  if (pct < 60) return 'yellow';
  return 'green';
}
```

## 许可证

MIT License
