import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LogicalSize, PhysicalSize } from '@tauri-apps/api/window'
import { fitInitialMainWindow } from '../fitInitialMainWindow'

const bridge = vi.hoisted(() => ({
  scaleFactor: vi.fn(),
  isVisible: vi.fn(),
  setSize: vi.fn(),
  center: vi.fn(),
  currentMonitor: vi.fn(),
  primaryMonitor: vi.fn(),
}))

vi.mock('@tauri-apps/api/window', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tauri-apps/api/window')>()),
  getCurrentWindow: () => bridge,
  currentMonitor: bridge.currentMonitor,
  primaryMonitor: bridge.primaryMonitor,
}))
vi.mock('@shared/logger', () => ({ logger: { debug: vi.fn() } }))

function monitor(width: number, height: number, scaleFactor = 1) {
  return { scaleFactor, workArea: { size: new PhysicalSize(width, height) } }
}

beforeEach(() => {
  vi.resetAllMocks()
  bridge.scaleFactor.mockResolvedValue(1)
  bridge.isVisible.mockResolvedValue(false)
  bridge.currentMonitor.mockResolvedValue(monitor(1920, 1040))
})

afterEach(() => vi.unstubAllGlobals())

describe('main window startup size', () => {
  it('fits the default geometry to system text scaling before showing', async () => {
    vi.stubGlobal('devicePixelRatio', 1.25)

    await fitInitialMainWindow(false)

    expect(bridge.setSize).toHaveBeenCalledWith(new LogicalSize(1335, 850))
    expect(bridge.setSize).toHaveBeenCalledBefore(bridge.center)
  })

  it('does not apply monitor DPI twice', async () => {
    vi.stubGlobal('devicePixelRatio', 2)
    bridge.scaleFactor.mockResolvedValue(2)

    await fitInitialMainWindow(false)

    expect(bridge.setSize).not.toHaveBeenCalled()
    expect(bridge.center).not.toHaveBeenCalled()
  })

  it('fits within the logical work area, even if a hidden window has no current monitor', async () => {
    vi.stubGlobal('devicePixelRatio', 3)
    bridge.scaleFactor.mockResolvedValue(2)
    bridge.currentMonitor.mockResolvedValue(null)
    bridge.primaryMonitor.mockResolvedValue(monitor(2560, 1600, 2))

    await fitInitialMainWindow(false)

    expect(bridge.setSize).toHaveBeenCalledWith(new LogicalSize(1256, 800))
  })

  it('leaves remembered and already visible geometry alone', async () => {
    vi.stubGlobal('devicePixelRatio', 1.25)
    await fitInitialMainWindow(true)
    expect(bridge.scaleFactor).not.toHaveBeenCalled()

    bridge.isVisible.mockResolvedValue(true)
    await fitInitialMainWindow(false)
    expect(bridge.setSize).not.toHaveBeenCalled()
  })

  it('allows startup to continue when resizing fails', async () => {
    vi.stubGlobal('devicePixelRatio', 1.25)
    bridge.setSize.mockRejectedValue(new Error('window unavailable'))

    await expect(fitInitialMainWindow(false)).resolves.toBeUndefined()
    expect(bridge.center).not.toHaveBeenCalled()
  })
})
