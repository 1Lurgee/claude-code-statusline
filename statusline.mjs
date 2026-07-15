import { readFileSync } from 'fs';

// ── 常量定义 ──────────────────────────────────────────────────
const MAX_MODEL_NAME_LENGTH = 20;      // 模型名最大显示长度
const TRUNCATE_SUFFIX_LENGTH = 3;     // 截断后缀长度（...）
const CONTEXT_BAR_WIDTH = 10;         // 上下文进度条宽度
const MAX_EFFORT_DEPTH = 5;           // effort 对象最大嵌套深度（增加以支持更复杂的数据结构）
const DEFAULT_CONTEXT_PCT = 0;        // 默认上下文百分比
const EFFORT_DOT_COUNT = 5;           // effort 圆点数量

// ── 读取 stdin JSON ───────────────────────────────────────────
let d;
try {
  d = JSON.parse(readFileSync(0, 'utf8'));
} catch (error) {
  // 解析失败，输出错误信息到 stderr 并返回错误退出码
  process.stderr.write(`Statusline JSON 解析失败: ${error.message}\n`);
  process.exit(1);
}

// 顶层类型校验：必须是非空对象
if (typeof d !== 'object' || d === null || Array.isArray(d)) {
  process.stderr.write('Statusline 输入必须是非空对象\n');
  process.exit(1);  // 统一使用错误退出码
}

// 调试模式：输出原始数据结构
if (process.env.CLAUDE_STATUSLINE_DEBUG) {
  const debugOutput = JSON.stringify(d, null, 2);
  process.stdout.write(debugOutput, (err) => {
    if (err) {
      // 输出失败时记录到 stderr 并以错误码退出
      process.stderr.write(`调试输出失败: ${err.message}\n`);
      process.exit(1);
    }
    process.exit(0);
  });
}

// ── ANSI 兼容性检测 ───────────────────────────────────────────
const NO_COLOR = !!process.env.NO_COLOR;

const C = {
  RST:    NO_COLOR ? '' : '\x1b[0m',
  DIM:    NO_COLOR ? '' : '\x1b[2m',
  BLD:    NO_COLOR ? '' : '\x1b[1m',
  MUTED:  NO_COLOR ? '' : '\x1b[38;2;120;120;140m',
  TEXT:   NO_COLOR ? '' : '\x1b[38;2;210;210;220m',
  ACCENT: NO_COLOR ? '' : '\x1b[38;2;232;175;95m',
  GREEN:  NO_COLOR ? '' : '\x1b[38;2;80;200;120m',
  YELLOW: NO_COLOR ? '' : '\x1b[38;2;240;200;80m',
  RED:    NO_COLOR ? '' : '\x1b[38;2;220;80;80m',
  CYAN:   NO_COLOR ? '' : '\x1b[38;2;100;210;220m',
  BG:     NO_COLOR ? '' : '\x1b[48;2;30;30;36m',
  WRN:    NO_COLOR ? '' : '\x1b[38;2;255;160;60m',
};

const SEP = '·';
const DOT_ON = '●';
const DOT_OFF = '○';
const BLOCK = '█';
const BLOCK_EMPTY = '░';

// 预编译正则表达式（性能优化）
const ANSI_CSI = /\x1b\[[0-9;]*[a-zA-Z]/g;      // CSI 序列：\x1b[...
const ANSI_OSC = /\x1b\][^\x07]*\x07/g;          // OSC 序列：\x1b]...\x07
const ANSI_OTHER = /\x1b[^[a-zA-Z0-9]/g;         // 其他转义序列
const CONTROL_CHARS = /[\x00-\x1f\x7f-\x9f]/g;   // 控制字符

/**
 * 清除字符串中的 ANSI 转义序列和控制字符（防止注入）
 * 处理所有类型的 ANSI 序列：CSI、OSC 和其他转义序列
 * @param {any} str - 输入字符串
 * @returns {string} - 清理后的字符串
 */
function stripAnsi(str) {
  return String(str)
    .replace(ANSI_CSI, '')    // 清除 CSI 序列（光标移动、颜色等）
    .replace(ANSI_OSC, '')    // 清除 OSC 序列（窗口标题等）
    .replace(ANSI_OTHER, '')  // 清除其他转义序列
    .replace(CONTROL_CHARS, '');  // 清除所有控制字符
}

/**
 * 安全截断字符串，正确处理多字节字符（如中文）
 * @param {string} str - 输入字符串
 * @param {number} maxLength - 最大长度
 * @returns {string} - 截断后的字符串
 */
function safeTruncate(str, maxLength) {
  if (str.length <= maxLength) return str;
  // 使用 Array.from 正确处理多字节字符
  const chars = Array.from(str);
  if (chars.length <= maxLength) return str;
  return chars.slice(0, maxLength - TRUNCATE_SUFFIX_LENGTH).join('') + '...';
}

/**
 * 精简模型名（通用正则解析）
 * 自动从模型 ID 中提取家族名和版本号，无需维护硬编码映射表
 * @param {string} raw - 原始模型名
 * @returns {string} - 精简后的模型名
 *
 * 支持的格式：
 * - claude-opus-4-8-20250712 → Opus 4.8
 * - claude-sonnet-5-20250514 → Sonnet 5
 * - claude-haiku-4-5-20251001 → Haiku 4.5
 * - gpt-4o → gpt-4o（截断显示）
 */
function shortModel(raw) {
  if (!raw) return '—';

  // 通用模式：提取 <family>[-<major>[.<minor>]] 中的关键部分
  // 版本号支持多位数主版本（1-2位）+ 可选小版本（1位），避免匹配到8位日期后缀
  const m = raw.match(/(?:claude[-_ ])?(opus|sonnet|haiku|fable|mythos)(?:[-_ ](\d{1,2}(?:[-._]\d)?))/i);
  if (m) {
    const family = m[1].charAt(0).toUpperCase() + m[1].slice(1).toLowerCase();
    const ver = m[2]?.replace(/[-_]/g, '.') ?? '';
    return ver ? `${family} ${ver}` : family;
  }

  // 非 Claude 模型：截断防止破坏布局
  return safeTruncate(raw, MAX_MODEL_NAME_LENGTH);
}

// ── Effort 圆点（5 级）────────────────────────────────────────
const EFFORT_LEVELS = { low: 1, medium: 2, high: 3, xhigh: 4, max: 5 };

const EFFORT_COLORS = {
  low:    C.MUTED,
  medium: C.TEXT,
  high:   C.ACCENT,
  xhigh:  C.YELLOW,
  max:    C.RED,
};

/**
 * 生成 effort 级别的圆点显示
 * @param {string} level - effort 级别
 * @returns {string|null} - 圆点字符串或 null（未知级别）
 */
function effortDots(level) {
  // 类型验证：确保 level 为字符串
  if (typeof level !== 'string') return null;
  const n = EFFORT_LEVELS[level];
  if (n === undefined) return null;  // 未知级别，由调用方处理
  // 边界检查：确保 n 在有效范围内
  const clamped = Math.max(0, Math.min(EFFORT_DOT_COUNT, n));
  return DOT_ON.repeat(clamped) + DOT_OFF.repeat(EFFORT_DOT_COUNT - clamped);
}

function effortColor(level) {
  return EFFORT_COLORS[level] ?? C.WRN;
}

// ── 统一颜色阈值逻辑 ─────────────────────────────────────────
// 所有上下文相关着色共用同一套阈值
function contextColor(pct) {
  if (pct < 30) return 'red';
  if (pct < 60) return 'yellow';
  return 'green';
}

function colorForLevel(level) {
  switch (level) {
    case 'red':    return C.RED;
    case 'yellow': return C.YELLOW;
    case 'green':  return C.GREEN;
    default:       return C.GREEN;
  }
}

/**
 * 生成上下文进度条
 * @param {number} pct - 百分比（0-100）
 * @param {number} width - 进度条宽度（必须为正整数）
 * @returns {string} - 进度条字符串
 */
function contextBar(pct, width = CONTEXT_BAR_WIDTH) {
  if (!Number.isFinite(pct)) pct = DEFAULT_CONTEXT_PCT;  // 防御性：NaN/Infinity 归零
  pct = Math.max(0, Math.min(100, pct));
  // 确保 width 为正整数
  const validWidth = Math.max(1, Math.floor(width));
  // 使用精确的整数计算避免浮点精度问题
  const filled = Math.min(validWidth, Math.floor(pct * validWidth / 100));
  const level = contextColor(pct);
  const fillColor = colorForLevel(level);

  // 预计算常用颜色序列
  const filledBlock = fillColor + BLOCK + C.RST + C.BG;
  const emptyBlock = C.MUTED + BLOCK_EMPTY + C.RST + C.BG;

  // 使用数组收集片段后一次性 join（性能优化）
  const segments = [];
  for (let i = 1; i <= width; i++) {
    segments.push(i <= filled ? filledBlock : emptyBlock);
  }
  return segments.join('');
}

// ── 从数据中提取字段 ──────────────────────────────────────────

// 模型名（清除 ANSI 转义序列防止注入）
const modelName = stripAnsi(shortModel(
  d.model?.display_name ??
  d.model?.name ??
  d.model?.id ??
  d.model ??
  d.model_name ??
  ''
));

/**
 * 从嵌套对象中提取 effort 值
 * @param {any} raw - 原始 effort 数据，可能是嵌套对象
 * @returns {string|null|{unknown: string}} - 标准化的 effort 值或 null
 *
 * 支持的数据结构：
 * - 直接字符串值: "high"
 * - 嵌套对象: { level: "high" } 或 { value: { level: "high" } }
 * - 最多支持 MAX_EFFORT_DEPTH 层嵌套深度
 */
function extractEffort(raw) {
  if (raw === undefined || raw === null) return null;

  // 类型检查：如果原始值已经是字符串，直接处理
  if (typeof raw === 'string') {
    if (raw === '') return null;
    const normalized = raw.toLowerCase().trim();
    if (normalized in EFFORT_LEVELS) return normalized;
    return { unknown: normalized };
  }

  // 非对象类型：返回 null
  if (typeof raw !== 'object' || raw === null) return null;

  let value = raw;
  // 递归解包对象，最多 MAX_EFFORT_DEPTH 层防止无限递归
  for (let depth = 0; depth < MAX_EFFORT_DEPTH && typeof value === 'object' && value !== null; depth++) {
    // 防止数组遍历
    if (Array.isArray(value)) break;
    value = value.level ?? value.value ?? value.name ?? value.current ?? value.effort ?? null;
  }

  if (typeof value !== 'string' || value === '') return null;

  const normalized = value.toLowerCase().trim();
  if (normalized in EFFORT_LEVELS) return normalized;

  // 未知值：返回带警告标记
  return { unknown: normalized };
}

const rawEffort = d.effort ?? d.effort_level ?? d.effortLevel ?? d.model?.effort ?? d.settings?.effort;
const effortResult = extractEffort(rawEffort);

// 上下文百分比（缺失时返回 null，范围钳制到 0-100）
const rawPct = d.context_window?.remaining_percentage ??
               d.contextWindow?.remainingPercentage ??
               d.context?.remaining_percentage ??
               d.context_remaining_pct;
const rawNum = rawPct != null ? Number(rawPct) : null;
// 数值验证：排除 NaN/Infinity，但保留 0（0% 是有效的上下文百分比）
// 使用 Number.isFinite 确保只接受有效有限数字
const contextPct = rawNum != null && Number.isFinite(rawNum)
  ? Math.max(0, Math.min(100, Math.round(rawNum)))
  : null;

// 当前目录（清除 ANSI 转义序列防止注入）
const cwd = stripAnsi(d.workspace?.current_dir ?? d.cwd ?? '');

// ── 渲染 ─────────────────────────────────────────────────────
// 使用数组收集片段后一次性 join（性能优化）
const parts = [];
parts.push(C.BG);

// 目录
if (cwd) {
  parts.push(`${C.CYAN} ${cwd} ${C.RST}${C.BG}`);
  parts.push(`${C.MUTED}${SEP} ${C.RST}${C.BG}`);
}

// 模型名
parts.push(`${C.ACCENT}${C.BLD} ${modelName} ${C.RST}${C.BG}`);
parts.push(`${C.MUTED} ${SEP} ${C.RST}${C.BG}`);

// Effort 指示器
if (effortResult === null) {
  // 未传 effort：灰色占位
  parts.push(`${C.MUTED} ${DOT_OFF.repeat(EFFORT_DOT_COUNT)} — ${C.RST}${C.BG}`);
} else if (typeof effortResult === 'object' && effortResult.unknown) {
  // 未知 effort 值：黄色警告
  parts.push(`${C.WRN} ${DOT_OFF.repeat(EFFORT_DOT_COUNT)} ?${effortResult.unknown}? ${C.RST}${C.BG}`);
} else {
  // 正常 effort
  const dots = effortDots(effortResult);
  const eColor = effortColor(effortResult);
  parts.push(`${eColor} ${dots} ${C.MUTED}${effortResult} ${C.RST}${C.BG}`);
}

parts.push(`${C.MUTED} ${SEP} ${C.RST}${C.BG}`);

// 上下文进度条
if (contextPct === null) {
  // 未传上下文：灰色占位
  parts.push(` ${C.MUTED}${BLOCK_EMPTY.repeat(CONTEXT_BAR_WIDTH)} ——${C.RST}${C.BG}`);
} else {
  const bar = contextBar(contextPct);
  const pColor = colorForLevel(contextColor(contextPct));
  parts.push(` ${bar} ${pColor}${contextPct}%${C.RST}${C.BG}`);
}

parts.push('  ' + C.RST);

process.stdout.write(parts.join(''));
