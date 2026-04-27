const { getCustomNavBarMetrics } = require('../../utils/custom-nav.js')

Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    isScrolled: {
      type: Boolean,
      value: false
    }
  },

  data: {
    statusBarHeight: 20,
    navContentHeight: 44,
    totalNavHeight: 64
  },

  lifetimes: {
    attached() {
      const m = getCustomNavBarMetrics()
      this.setData({
        statusBarHeight: m.statusBarHeight,
        navContentHeight: m.navContentHeight,
        totalNavHeight: m.total
      })
    }
  }
})
