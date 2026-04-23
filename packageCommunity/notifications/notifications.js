const notifications = require('../../utils/notifications.js')

Page({
  data: {
    notifications: [],
    unreadCount: 0
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const list = notifications.getNotifications()
    const formatted = list.map(item => ({
      ...item,
      displayTime: this.formatTime(item.createdAt)
    }))
    this.setData({
      notifications: formatted,
      unreadCount: notifications.getUnreadCount()
    })
  },

  formatTime(iso) {
    if (!iso) return ''
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return ''
    const now = new Date()
    const diff = now - date
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    const h = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    return `${m}-${d} ${h}:${mm}`
  },

  markAllRead() {
    notifications.markAllRead()
    this.loadData()
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    notifications.markAsRead(id)
    this.loadData()
  }
})

