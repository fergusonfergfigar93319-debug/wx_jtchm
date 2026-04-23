// components/skeleton/skeleton.js
// 骨架屏组件 - 2025设计规范

Component({
  properties: {
    // 是否显示骨架屏
    loading: {
      type: Boolean,
      value: true
    },
    // 骨架屏配置项数组
    items: {
      type: Array,
      value: []
    },
    // 是否可见（用于控制显示隐藏）
    visible: {
      type: Boolean,
      value: true
    }
  },

  data: {
    // 内部状态
  },

  methods: {
    // 显示骨架屏
    show() {
      this.setData({
        visible: true,
        loading: true
      })
    },

    // 隐藏骨架屏
    hide() {
      this.setData({
        visible: false,
        loading: false
      })
    }
  }
})
