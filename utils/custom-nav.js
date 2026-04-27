/**
 * 与 components/custom-nav-bar 共用：安全区 + 与胶囊对齐的导航条高度
 * @returns {{ statusBarHeight: number, navContentHeight: number, total: number }} 单位 px
 */
function getCustomNavBarMetrics() {
  try {
    const sys = wx.getSystemInfoSync() || {}
    const statusBarHeight = sys.statusBarHeight > 0 ? sys.statusBarHeight : 20
    const menu = wx.getMenuButtonBoundingClientRect
      ? wx.getMenuButtonBoundingClientRect()
      : null
    let navContentHeight = 44
    if (menu && menu.height > 0 && menu.top > 0) {
      navContentHeight = menu.height + (menu.top - statusBarHeight) * 2
    }
    return {
      statusBarHeight,
      navContentHeight,
      total: statusBarHeight + navContentHeight
    }
  } catch (e) {
    return { statusBarHeight: 20, navContentHeight: 44, total: 64 }
  }
}

module.exports = {
  getCustomNavBarMetrics
}
