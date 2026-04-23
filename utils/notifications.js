// utils/notifications.js - 简易消息通知中心（本地存储）

const STORAGE_KEY = 'appNotifications'

function loadAll() {
  try {
    const list = wx.getStorageSync(STORAGE_KEY) || []
    return Array.isArray(list) ? list : []
  } catch (e) {
    console.warn('加载通知失败', e)
    return []
  }
}

function saveAll(list) {
  try {
    wx.setStorageSync(STORAGE_KEY, list || [])
  } catch (e) {
    console.warn('保存通知失败', e)
  }
}

// 新增一条通知
function addNotification(payload) {
  const now = new Date()
  const id = payload.id || `ntf_${now.getTime()}_${Math.floor(Math.random() * 1000)}`
  const item = {
    id,
    title: payload.title || '系统提醒',
    content: payload.content || '',
    type: payload.type || 'info', // info | warning | alert | ai
    createdAt: payload.createdAt || now.toISOString(),
    read: false,
    extra: payload.extra || null
  }
  const list = loadAll()
  list.unshift(item)
  // 最多保留100条
  saveAll(list.slice(0, 100))
  return item
}

function getNotifications() {
  return loadAll()
}

function getUnreadCount() {
  const list = loadAll()
  return list.filter(item => !item.read).length
}

function markAsRead(id) {
  const list = loadAll()
  const next = list.map(item => item.id === id ? { ...item, read: true } : item)
  saveAll(next)
}

function markAllRead() {
  const list = loadAll()
  const next = list.map(item => (item.read ? item : { ...item, read: true }))
  saveAll(next)
}

module.exports = {
  addNotification,
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllRead
}

