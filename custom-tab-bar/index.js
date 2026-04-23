Component({
  data: {
    selected: 0
  },

  lifetimes: {
    attached() {
      // 默认根据当前页面路径设置选中态（在组件刚创建时，可能还没有页面栈，需要做安全判断）
      const pages = getCurrentPages && getCurrentPages()
      if (pages && pages.length) {
        const current = pages[pages.length - 1]
        if (current && current.route) {
          this._setSelectedByPath(current.route)
        }
      }
    }
  },

  methods: {
    // 外部页面调用，手动设置当前选中 tab
    setSelected(index) {
      if (typeof index === 'number') {
        this.setData({ selected: index })
      }
    },

    _setSelectedByPath(path) {
      const map = {
        'pages/index/index': 0,
        'pages/fridge/fridge': 1,
        'pages/report/report': 2,
        'pages/profile/profile': 3
      }
      const index = map[path]
      if (index !== undefined) {
        this.setData({ selected: index })
      }
    },

    onTabTap(e) {
      const { index, path } = e.currentTarget.dataset
      if (this.data.selected === index) return

      wx.switchTab({ url: '/' + path })
      this.setData({ selected: index })
    }
  }
})

