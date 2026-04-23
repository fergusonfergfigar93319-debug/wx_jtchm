// packageUser/login/login.js
const api = require('../../utils/api.js')
const auth = require('../../utils/auth.js')
const {
  ENABLE_DEV_CHANNEL_LOGIN,
  DEV_CHANNEL_TOKEN
} = require('../../utils/config.js')
const app = getApp()

Page({
  data: {
    logging: false,
    showSuccessOverlay: false,
    showDevChannel: ENABLE_DEV_CHANNEL_LOGIN
  },

  noop() {},

  onLoad(options) {
    this.redirectUrl = options.redirect || ''
  },

  /** 开发者通道：写入占位 token，进入首页检查功能（接口仍可能失败） */
  onDevChannelEnter() {
    if (!ENABLE_DEV_CHANNEL_LOGIN) return
    auth.clearSession(app)
    auth.persistSession(app, { access_token: DEV_CHANNEL_TOKEN })
    wx.setStorageSync('devChannelLogin', true)
    wx.showToast({ title: '已进入开发者模式', icon: 'none', duration: 1800 })
    setTimeout(() => {
      if (this.redirectUrl) {
        wx.redirectTo({ url: this.redirectUrl })
      } else {
        wx.switchTab({ url: '/pages/index/index' })
      }
    }, 400)
  },

  async onWxLogin() {
    if (this.data.logging) return
    this.setData({ logging: true })

    try {
      const [loginRes] = await Promise.all([
        new Promise((resolve, reject) => {
          wx.login({
            success: resolve,
            fail: reject
          })
        })
      ])

      if (!loginRes || !loginRes.code) {
        wx.showToast({ title: '获取登录态失败', icon: 'none' })
        return
      }

      const data = await api.login(loginRes.code)
      const access_token = data.access_token
      const refresh_token = data.refresh_token
      const isNewUser = data.is_new_user === true

      if (!access_token) {
        wx.showToast({ title: '登录失败，未返回凭证', icon: 'none' })
        return
      }

      wx.removeStorageSync('devChannelLogin')
      auth.persistSession(app, {
        access_token,
        refresh_token,
        user_id: data.user_id
      })

      const goAfterSuccess = () => {
        if (isNewUser) {
          wx.redirectTo({ url: '/packageUser/profile-edit/profile-edit?from=register' })
        } else {
          app.getUserInfo()
          if (this.redirectUrl) {
            wx.redirectTo({ url: this.redirectUrl })
          } else {
            wx.switchTab({ url: '/pages/index/index' })
          }
        }
      }

      this.setData({ logging: false, showSuccessOverlay: true })
      this._successNavigateTimer = setTimeout(() => {
        this._successNavigateTimer = null
        this.setData({ showSuccessOverlay: false })
        goAfterSuccess()
      }, 920)
    } catch (e) {
      console.error('登录失败', e)
      wx.showToast({
        title: e.message && e.message.length < 20 ? e.message : '登录失败，请重试',
        icon: 'none'
      })
    } finally {
      if (!this.data.showSuccessOverlay) {
        this.setData({ logging: false })
      }
    }
  },

  onUnload() {
    if (this._successNavigateTimer) {
      clearTimeout(this._successNavigateTimer)
      this._successNavigateTimer = null
    }
  },

  onAgreement() {
    wx.showToast({ title: '用户协议页面开发中', icon: 'none' })
  },

  onPrivacy() {
    wx.showToast({ title: '隐私政策页面开发中', icon: 'none' })
  }
})
