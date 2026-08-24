/**
 * 入口文件 / Entry File
 *
 * DRC 语音提醒扩展入口：
 * 顶部菜单（首页 / 原理图 / PCB）-> "DRC 语音提醒..." -> 打开内联框架窗口。
 *
 * 主线程常驻监听 PCB 实时 DRC：EDA 启动完成后注册监听，实时 DRC 检出违规时
 * 写入 SYS_Storage 待播报数据，iframe 轮询读取并播放（主线程无法播放音频）。
 */

const IFRAME_ID = 'drc-voice-alert-window';
const REALTIME_DRC_ENABLED_KEY = 'realtimeDrcEnabled';
const PENDING_REALTIME_DRC_KEY = 'pendingRealtimeDrc';
const REALTIME_DRC_EVENT_ID = 'drc-voice-alert-realtime';

/**
 * 扩展激活生命周期：EDA 启动完成后调用。
 * 在此注册 PCB 实时 DRC 事件监听，实现「安装后常驻」。
 */
export function activate(_status?: 'onStartupFinished', _arg?: string): void {
	if (typeof eda === 'undefined')
		return;
	if (!eda.pcb_Event || typeof eda.pcb_Event.addRealTimeDrcResultEventListener !== 'function')
		return;

	try {
		eda.pcb_Event.addRealTimeDrcResultEventListener(REALTIME_DRC_EVENT_ID, 'all', (_eventType, props) => {
			handleRealTimeDrc(props).catch((e: unknown) => {
				console.error('[DRC 语音提醒] 处理实时 DRC 结果失败：', e);
			});
		});
	}
	catch (e) {
		console.error('[DRC 语音提醒] 注册实时 DRC 监听失败：', e);
	}
}

/**
 * 实时 DRC 违规回调：开关开启时，将违规计数写入 SYS_Storage，
 * 并确保 iframe 窗口存在（不存在则隐藏式打开，供后台轮询播放）。
 */
async function handleRealTimeDrc(props: unknown): Promise<void> {
	if (!props || !Array.isArray(props) || !props[0])
		return;

	const config = eda.sys_Storage.getExtensionUserConfig(REALTIME_DRC_ENABLED_KEY);
	if (config === false)
		return;

	const raw = (props[0] as { drcResult?: unknown }).drcResult;
	if (raw === undefined || raw === null)
		return;

	const { errors, warnings } = classifyViolations(raw);
	if (errors === 0 && warnings === 0)
		return;

	// 确保窗口存在（不存在则隐藏式打开，iframe 后台轮询待播报）
	const exist = await eda.sys_IFrame.isIFrameAlreadyExist(IFRAME_ID);
	if (!exist) {
		await eda.sys_IFrame.openIFrame('/iframe/index.html', 320, 200, IFRAME_ID, {
			title: 'DRC 语音提醒',
			minimizeButton: true,
			x: 99999,
			y: 99999,
		});
		await eda.sys_IFrame.hideIFrame(IFRAME_ID);
	}

	await eda.sys_Storage.setExtensionUserConfig(PENDING_REALTIME_DRC_KEY, { errors, warnings });
}

/**
 * 打开插件窗口：已存在则显示（恢复），否则新建。
 */
export async function openDrcVoiceWindow(): Promise<void> {
	const alreadyExist = await eda.sys_IFrame.isIFrameAlreadyExist(IFRAME_ID);
	if (alreadyExist) {
		await eda.sys_IFrame.showIFrame(IFRAME_ID);
		return;
	}

	await eda.sys_IFrame.openIFrame('/iframe/index.html', 440, 480, IFRAME_ID, {
		title: 'DRC 语音提醒',
		minimizeButton: true,
		maximizeButton: true,
		grayscaleMask: false,
	});
}

/**
 * 统计违规：按条目 type 聚合，违规数取 count 字段，其次 primitives.length，再按 1 计。
 */
function classifyViolations(list: unknown): { errors: number; warnings: number } {
	let errors = 0;
	let warnings = 0;
	if (!Array.isArray(list))
		return { errors, warnings };
	for (const item of list) {
		const obj = item as { type?: string; count?: number; primitives?: Array<unknown> };
		const type = typeof obj?.type === 'string' ? obj.type.toLowerCase() : '';
		const count = itemCount(obj);
		if (type === 'warn' || type === 'warning') {
			warnings += count;
		}
		else {
			errors += count;
		}
	}
	return { errors, warnings };
}

function itemCount(item: { count?: number; primitives?: Array<unknown> }): number {
	if (item && typeof item.count === 'number' && item.count > 0)
		return item.count;
	if (item && Array.isArray(item.primitives) && item.primitives.length > 0)
		return item.primitives.length;
	return 1;
}
