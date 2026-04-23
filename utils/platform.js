function safeLower(v) {
  try {
    return String(v || '').toLowerCase()
  } catch (e) {
    return ''
  }
}

/**
 * 替代已废弃的 wx.getSystemInfoSync：合并设备与窗口信息（基础库 3.7.0+）。
 * 用于取 pixelRatio、windowWidth、benchmarkLevel、totalMemory 等。
 */
function getWindowMetricsSafe() {
  try {
    if (typeof wx.getWindowInfo === 'function' && typeof wx.getDeviceInfo === 'function') {
      const w = wx.getWindowInfo()
      const d = wx.getDeviceInfo()
      return Object.assign({}, d, w)
    }
  } catch (e) {}
  return {
    pixelRatio: 2,
    windowWidth: 375,
    windowHeight: 667,
    screenWidth: 375,
    screenHeight: 667,
    platform: 'devtools',
    system: '',
    brand: '',
    model: ''
  }
}

/**
 * 是否为微信开发者工具（模拟器）。勿使用已废弃的 wx.getSystemInfoSync。
 */
function isWeChatDevToolsPlatform() {
  const isDev = (p) => safeLower(p) === 'devtools'
  try {
    if (typeof wx.getDeviceInfo === 'function') {
      const d = wx.getDeviceInfo()
      if (d && isDev(d.platform)) return true
    }
  } catch (e) {}
  try {
    if (typeof wx.getAppBaseInfo === 'function') {
      const a = wx.getAppBaseInfo()
      if (a && isDev(a.platform)) return true
    }
  } catch (e2) {}
  try {
    if (typeof wx.getWindowInfo === 'function') {
      const w = wx.getWindowInfo()
      if (w && isDev(w.platform)) return true
    }
  } catch (e3) {}
  return false
}

function detectPlatform() {
  const s = getWindowMetricsSafe()

  const platformRaw = safeLower(s.platform || '')
  const systemRaw = safeLower(s.system || '')
  const brandRaw = safeLower(s.brand || '')
  const modelRaw = safeLower(s.model || '')

  const isHarmonyOS =
    platformRaw.includes('harmony') ||
    systemRaw.includes('harmony') ||
    modelRaw.includes('harmony') ||
    (brandRaw.includes('huawei') && systemRaw.includes('hmos'))

  const benchmarkLevel =
    typeof s.benchmarkLevel === 'number' ? s.benchmarkLevel : null

  const isLowPerf = typeof benchmarkLevel === 'number' ? benchmarkLevel <= 15 : false

  const canUse = {
    getDeviceInfo: typeof wx.getDeviceInfo === 'function',
    getWindowInfo: typeof wx.getWindowInfo === 'function',
    getSystemSetting: typeof wx.getSystemSetting === 'function',
    createSelectorQuery: typeof wx.createSelectorQuery === 'function',
    setStorage: typeof wx.setStorage === 'function',
    setStorageSync: typeof wx.setStorageSync === 'function'
  }

  return {
    isHarmonyOS,
    isLowPerf,
    liteMode: !!(isHarmonyOS || isLowPerf),
    benchmarkLevel,
    deviceInfo: s,
    systemInfo: s,
    canUse
  }
}

module.exports = {
  detectPlatform,
  getWindowMetricsSafe,
  isWeChatDevToolsPlatform
}
