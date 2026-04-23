/**
 * 鉴权：access_token / refresh_token 存储与读写
 * 与后端 /users/login/、/users/logout/ 约定一致
 */
const STORAGE_ACCESS = 'access_token'
const STORAGE_REFRESH = 'refresh_token'
const STORAGE_USER_ID = 'user_id'
/** 旧版 key，启动时若存在则迁移到 access_token */
const LEGACY_TOKEN = 'token'

/**
 * wx.request 的 res.data 可能是 JSON 字符串（与 Content-Type / 基础库有关）
 * 若解析失败则退回原始 raw，便于上层按业务码分支
 */
function parseWxJsonBody(raw) {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw)
    } catch (e) {
      return raw
    }
  }
  return raw || {}
}

/**
 * 登录成功体：{ code:200, data:{ access_token, refresh_token, user_id, is_new_user? } }
 * 兼容标准 data、与 body 同级字段、大小写别名、历史 token 字段
 */
function normalizeLoginPayload(body) {
  const b = body && typeof body === 'object' ? body : {}
  let data = b.data || b || {}
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data)
    } catch (e) {
      data = {}
    }
  }
  if (data == null || typeof data !== 'object') {
    data = {}
  }
  const access_token =
    data.access_token ||
    data.access ||
    data.accessToken ||
    data.token ||
    b.access_token ||
    b.access ||
    ''
  const refresh_token =
    data.refresh_token ||
    data.refresh ||
    data.refreshToken ||
    b.refresh_token ||
    b.refresh ||
    ''
  const user_id =
    data.user_id != null ? data.user_id : data.userId != null ? data.userId : b.user_id != null ? b.user_id : null
  const is_new_user =
    data.is_new_user === true ||
    data.isNewUser === true ||
    b.is_new_user === true ||
    b.isNewUser === true
  return { access_token, refresh_token, user_id, is_new_user }
}

function readStoredTokens() {
  let access = ''
  let refresh = ''
  try {
    access = wx.getStorageSync(STORAGE_ACCESS) || ''
    refresh = wx.getStorageSync(STORAGE_REFRESH) || ''
    if (!access) {
      const legacy = wx.getStorageSync(LEGACY_TOKEN)
      if (legacy) {
        access = legacy
        wx.setStorageSync(STORAGE_ACCESS, legacy)
        wx.removeStorageSync(LEGACY_TOKEN)
      }
    }
  } catch (e) {
    // ignore
  }
  return { access, refresh }
}

/** @param app getApp() @param {{ access_token?: string; refresh_token?: string; user_id?: number }} payload */
function persistSession(app, payload) {
  const { access_token, refresh_token, user_id } = payload || {}
  if (access_token != null && access_token !== '') {
    app.globalData.accessToken = access_token
    try {
      wx.setStorageSync(STORAGE_ACCESS, access_token)
    } catch (e) {
      // ignore
    }
  }
  if (refresh_token != null && refresh_token !== '') {
    app.globalData.refreshToken = refresh_token
    try {
      wx.setStorageSync(STORAGE_REFRESH, refresh_token)
    } catch (e) {
      // ignore
    }
  }
  if (user_id != null) {
    app.globalData.userId = user_id
    try {
      wx.setStorageSync(STORAGE_USER_ID, user_id)
    } catch (e) {
      // ignore
    }
  }
}

/** @param app getApp() */
function clearSession(app) {
  app.globalData.accessToken = null
  app.globalData.refreshToken = null
  app.globalData.userId = null
  try {
    wx.removeStorageSync(STORAGE_ACCESS)
    wx.removeStorageSync(STORAGE_REFRESH)
    wx.removeStorageSync(STORAGE_USER_ID)
    wx.removeStorageSync(LEGACY_TOKEN)
  } catch (e) {
    // ignore
  }
}

/**
 * 从 DRF / 小程序统一包装体中取出可读错误文案（HTTP 非 2xx 或业务失败）
 */
function extractApiErrorMessage(body, statusCode) {
  const b = body && typeof body === 'object' ? body : {}
  if (b.message) return String(b.message)
  if (b.msg) return String(b.msg)
  if (typeof b.detail === 'string') return b.detail
  if (Array.isArray(b.detail) && b.detail[0]) return String(b.detail[0])
  if (b.non_field_errors && b.non_field_errors[0]) return String(b.non_field_errors[0])
  const key = Object.keys(b).find((k) => Array.isArray(b[k]) && b[k][0])
  if (key) return `${key}: ${b[key][0]}`
  if (statusCode) return `请求失败 (${statusCode})`
  return '请求失败'
}

module.exports = {
  readStoredTokens,
  persistSession,
  clearSession,
  parseWxJsonBody,
  normalizeLoginPayload,
  extractApiErrorMessage,
  STORAGE_ACCESS,
  STORAGE_REFRESH
}
