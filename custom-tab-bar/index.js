Component({
  data: {
    selected: 0
  },

  lifetimes: {
    attached() {
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
      if (index === undefined || !path) return
      if (this.data.selected === index) return

      wx.switchTab({ url: '/' + path })
      this.setData({ selected: index })
    },

    onCenterTap() {
      wx.navigateTo({ url: '/packageAI/ai-chat/ai-chat' })
    }
  }
})
