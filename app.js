// app.js
const platform = require('./utils/platform.js')
const auth = require('./utils/auth.js')
const { getApiBaseUrl, isDevChannelToken, warnApiConnectionFailure } = require('./utils/config.js')

function logDevtoolsUrl(label, url) {
  try {
    if (!platform.isWeChatDevToolsPlatform()) return
    console.log(label, url)
  } catch (e) {}
}

App({
  onLaunch() {
    try {
      const p = platform.detectPlatform()
      this.globalData.platform = p
      this.globalData.liteMode = !!p.liteMode
    } catch (e) {
      this.globalData.platform = null
      this.globalData.liteMode = false
    }

    this.globalData.apiBaseUrl = getApiBaseUrl()
    this.checkLogin()
    setTimeout(() => {
      this.getUserLocation()
    }, 500)
  },

  onShow() {
    // 与 utils/config 同步（开发者工具内会固定本机地址；真机仍可读 apiBaseUrlOverride）
    this.globalData.apiBaseUrl = getApiBaseUrl()
  },

  globalData: {
    userInfo: null,
    accessToken: null,
    refreshToken: null,
    userId: null,
    location: null,
    // 见 utils/config.js；onLaunch 会再刷新一次
    apiBaseUrl: getApiBaseUrl(),
    showSeasonalInFridge: false, // 是否在冰箱页面显示应季食材
    platform: null,
    liteMode: false
  },

  // 检查登录状态
  checkLogin() {
    const { access, refresh } = auth.readStoredTokens()
    if (access) {
      this.globalData.accessToken = access
      this.globalData.refreshToken = refresh || null
      this.getUserInfo()
    } else {
      wx.reLaunch({
        url: '/packageUser/login/login'
      })
    }
  },

  // 微信登录（401 会多次触发；必须单飞：同一 code 只能换 token 一次，并发会 400 / Broken pipe）
  wxLogin() {
    if (this._wechatLoginInFlight) return
    this._wechatLoginInFlight = true

    const release = () => {
      this._wechatLoginInFlight = false
    }

    wx.login({
      success: (res) => {
        if (!res.code) {
          release()
          return
        }
        const loginUrl = `${this.globalData.apiBaseUrl}/users/login/`
        logDevtoolsUrl('[API] POST', loginUrl)
        wx.request({
          url: loginUrl,
          method: 'POST',
          header: { 'Content-Type': 'application/json' },
          data: {
            code: res.code
          },
          complete: release,
          success: (loginRes) => {
            const status = loginRes.statusCode
            const ok = status >= 200 && status < 300
            const body = auth.parseWxJsonBody(loginRes.data)

            if (!ok) {
              console.error('[wxLogin] HTTP 失败:', status, body)
              wx.showToast({
                title: auth.extractApiErrorMessage(body, status).slice(0, 18),
                icon: 'none'
              })
              return
            }

            const businessOk =
              body.code === 200 ||
              (body.code == null &&
                !!(body.access || body.access_token || body.token || body.data))

            if (!businessOk) {
              console.error('[wxLogin] 业务失败:', body)
              wx.showToast({
                title:
                  (body.message || body.msg || auth.extractApiErrorMessage(body, status)).slice(
                    0,
                    18
                  ),
                icon: 'none'
              })
              return
            }

            const payload = auth.normalizeLoginPayload(body)
            if (payload.access_token) {
              auth.persistSession(this, payload)
              if (payload.is_new_user) {
                wx.redirectTo({
                  url: '/packageUser/profile-edit/profile-edit'
                })
              } else {
                this.getUserInfo()
              }
            } else {
              console.error('[wxLogin] 无法解析 access_token，完整响应:', body)
              wx.showToast({
                title: '登录失败，未返回凭证',
                icon: 'none'
              })
            }
          },
          fail: (err) => {
            console.error('后端接口调用失败', err)
            wx.showToast({
              title: '登录失败，请重试',
              icon: 'none'
            })
          }
        })
      },
      fail: (err) => {
        console.error('wx.login 调用失败', err)
        release()
      }
    })
  },

  // 获取用户信息
  getUserInfo() {
    if (!this.globalData.accessToken) return
    if (isDevChannelToken(this.globalData.accessToken)) return

    const profileUrl = `${this.globalData.apiBaseUrl}/diet/profile/`
    logDevtoolsUrl('[API] GET', profileUrl)
    wx.request({
      url: profileUrl,
      method: 'GET',
      header: {
        'Authorization': `Bearer ${this.globalData.accessToken}`
      },
      success: (res) => {
        if (res.data && res.data.code === 200) {
          this.globalData.userInfo = res.data.data
        }
      },
      fail: (err) => {
        console.error('获取用户信息失败', err)
        warnApiConnectionFailure(err)
        // 静默失败，不影响应用使用
      }
    })
  },

  // 获取用户位置
  getUserLocation() {
    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        this.globalData.location = {
          latitude: res.latitude,
          longitude: res.longitude
        }
      },
      fail: (err) => {
        console.log('获取位置失败', err)
        // 静默失败，位置信息不是必需的
        // 可以后续在需要时再请求
      }
    })
  }
})
