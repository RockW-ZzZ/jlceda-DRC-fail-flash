/**
 * 入口文件 / Entry File
 *
 * DRC 语音提醒扩展入口：
 * 顶部菜单（首页 / 原理图 / PCB）-> "DRC 语音提醒..." -> 打开内联框架窗口。
 */
// eslint-disable-next-line unused-imports/no-unused-vars
export function activate(status?: 'onStartupFinished', arg?: string): void {}

const IFRAME_ID = 'drc-voice-alert-window';

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
