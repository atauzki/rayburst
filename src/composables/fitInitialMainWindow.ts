import { currentMonitor, getCurrentWindow, LogicalSize, primaryMonitor } from '@tauri-apps/api/window'
import { logger } from '@shared/logger'
import { app } from '../../src-tauri/tauri.conf.json'
import { systemWindowScale } from './useWindowScale'

/** Fits only the default geometry, before AppProviders applies the user's WebView zoom. */
export async function fitInitialMainWindow(keepWindowState: boolean): Promise<void> {
  if (keepWindowState) return

  try {
    const scale = await systemWindowScale()
    // Tauri already applies the monitor's DPI to logical sizes.
    if (scale === 1) return

    const defaults = app.windows.find(({ label }) => label === 'main')
    if (!defaults) return

    const monitor = (await currentMonitor()) ?? (await primaryMonitor())
    const workArea = monitor?.workArea.size.toLogical(monitor.scaleFactor)
    const { width, height } = defaults
    const fit = workArea ? Math.min(scale, workArea.width / width, workArea.height / height) : scale
    if (fit <= 0 || fit === 1) return

    const view = getCurrentWindow()
    if (await view.isVisible()) return
    await view.setSize(new LogicalSize(Math.round(width * fit), Math.round(height * fit)))
    if (defaults.center) await view.center()
  } catch (error) {
    logger.debug('MainWindow.fitInitialSize', error)
  }
}
