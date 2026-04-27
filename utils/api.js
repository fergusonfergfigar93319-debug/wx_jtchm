// utils/api.js - API服务层
const auth = require('./auth.js')
const util = require('./util.js')
const platform = require('./platform.js')
const { warnApiConnectionFailure } = require('./config.js')
const app = getApp()

function logDevtoolsApi(method, fullUrl, extra) {
  try {
    if (!platform.isWeChatDevToolsPlatform()) return
    if (extra) {
      console.log('[API]', method, fullUrl, extra)
    } else {
      console.log('[API]', method, fullUrl)
    }
  } catch (e) {}
}

/** wx.request 的 fail（未建立 HTTP 连接）时拼接 errMsg，便于区分域名、拒连、超时等 */
function buildRequestFailMessage(err) {
  const msg = err && err.errMsg ? String(err.errMsg).trim() : ''
  let text = msg ? `网络请求失败：${msg}` : '网络请求失败'
  if (/url not in domain|不在以下合法域名|not in domain list/i.test(msg)) {
    text +=
      '。请在开发者工具「详情 → 本地设置」勾选不校验合法域名；上线需在微信后台配置 request 合法域名。'
  } else if (
    /CONNECTION_REFUSED|connection refused|ECONNREFUSED|无法连接|Failed to connect/i.test(msg)
  ) {
    text +=
      '。请确认本机已启动后端（如 http://0.0.0.0:8000），真机预览请将 utils/config.js 中 DEV_HOST 改为电脑局域网 IP，或 wx.setStorageSync("apiBaseUrlOverride", "http://IP:8000/api/v1")。'
  } else if (/timeout|timed out|ETIMEDOUT/i.test(msg)) {
    text += '。请检查网络或后端是否响应过慢。'
  }
  return text
}

// 请求封装
function request(url, method = 'GET', data = {}, needAuth = true) {
  const app = getApp()
  const API_BASE = app.globalData.apiBaseUrl

  return new Promise((resolve, reject) => {
    const header = {
      'Content-Type': 'application/json'
    }

    // needAuth 时务必带 Bearer：globalData 可能与 Storage 不同步（仅编译子包、时序等），先从 Storage 回填
    if (needAuth) {
      if (!app.globalData.accessToken) {
        const { access, refresh } = auth.readStoredTokens()
        if (access) {
          app.globalData.accessToken = access
          if (refresh) app.globalData.refreshToken = refresh
        }
      }
      if (!app.globalData.accessToken) {
        try {
          wx.reLaunch({ url: '/packageUser/login/login' })
        } catch (e) {}
        reject(new Error('请先登录'))
        return
      }
      header['Authorization'] = `Bearer ${app.globalData.accessToken}`
    }

    const fullUrl = `${API_BASE}${url}`
    logDevtoolsApi(method, fullUrl)

    wx.request({
      url: fullUrl,
      method: method,
      data: data,
      header: header,
      success: (res) => {
        const status = res.statusCode
        const ok = status >= 200 && status < 300

        if (status === 401) {
          auth.clearSession(app)
          app.wxLogin()
          const body = auth.parseWxJsonBody(res.data)
          reject(
            new Error(
              auth.extractApiErrorMessage(body, status) || '登录已过期，请重新登录'
            )
          )
          return
        }

        if (!ok) {
          const body = auth.parseWxJsonBody(res.data)
          reject(new Error(auth.extractApiErrorMessage(body, status)))
          return
        }

        if (status === 204 || res.data === '' || res.data == null) {
          resolve({})
          return
        }

        const body = auth.parseWxJsonBody(res.data)
        if (body.code === 200) {
          let payload = body.data !== undefined ? body.data : body
          if (payload === null || payload === undefined) {
            payload = {}
          }
          resolve(payload)
        } else if (body.code === 401) {
          auth.clearSession(app)
          app.wxLogin()
          reject(new Error('登录已过期，请重新登录'))
        } else {
          reject(
            new Error(
              body.message || body.msg || auth.extractApiErrorMessage(body, status)
            )
          )
        }
      },
      fail: (err) => {
        logDevtoolsApi(method, fullUrl, err && err.errMsg ? String(err.errMsg) : 'fail')
        warnApiConnectionFailure(err)
        reject(new Error(buildRequestFailMessage(err)))
      }
    })
  })
}

/** 后端可能返回 avatar / avatar_url / headimgurl 等，统一为 avatar 供页面绑定 */
function normalizeUserProfile(raw) {
  if (raw == null || typeof raw !== 'object') {
    return raw == null ? {} : raw
  }
  const extracted = util.extractAvatarUrlFromPayload(raw)
  if (extracted) {
    return Object.assign({}, raw, { avatar: extracted })
  }
  const v =
    raw.avatar ||
    raw.avatar_url ||
    raw.url ||
    raw.headimgurl ||
    raw.head_img
  const hasAvatarField =
    Object.prototype.hasOwnProperty.call(raw, 'avatar') ||
    Object.prototype.hasOwnProperty.call(raw, 'avatar_url') ||
    Object.prototype.hasOwnProperty.call(raw, 'url') ||
    Object.prototype.hasOwnProperty.call(raw, 'headimgurl') ||
    Object.prototype.hasOwnProperty.call(raw, 'head_img')
  if (v !== undefined && v !== null && v !== '') {
    return Object.assign({}, raw, { avatar: v })
  }
  if (hasAvatarField && (v === '' || v === null)) {
    return Object.assign({}, raw, { avatar: '' })
  }
  return raw
}

// API接口定义
const api = {
  // ========== 用户相关 ==========
  // 微信登录：单独封装，统一解析 res.data（字符串/CamelCase/嵌套 data）避免取错字段
  async login(code) {
    const API_BASE = getApp().globalData.apiBaseUrl
    return new Promise((resolve, reject) => {
      wx.request({
        url: `${API_BASE}/users/login/`,
        method: 'POST',
        header: { 'Content-Type': 'application/json' },
        data: { code: code },
        success: (res) => {
          const status = res.statusCode
          const ok = status >= 200 && status < 300
          const body = auth.parseWxJsonBody(res.data)

          if (!ok) {
            if (status === 400 || status === 401) {
              console.error('[api.login] 登录接口 HTTP', status, body)
            }
            reject(new Error(auth.extractApiErrorMessage(body, status)))
            return
          }

          const businessOk =
            body.code === 200 ||
            (body.code == null &&
              !!(body.access || body.access_token || body.token || body.data))

          if (!businessOk) {
            reject(
              new Error(
                body.message ||
                  body.msg ||
                  auth.extractApiErrorMessage(body, status) ||
                  '登录失败'
              )
            )
            return
          }

          const payload = auth.normalizeLoginPayload(body)
          if (payload.access_token) {
            resolve(payload)
          } else {
            console.error('[api.login] 无法解析 access_token，完整响应:', body)
            reject(new Error('未返回凭证'))
          }
        },
        fail: (err) => {
          warnApiConnectionFailure(err)
          reject(new Error(buildRequestFailMessage(err)))
        }
      })
    })
  },

  // 退出登录（后端将 refresh_token 拉黑）
  async logout(refreshToken) {
    const rt =
      refreshToken != null && refreshToken !== ''
        ? refreshToken
        : app.globalData.refreshToken
    return await request('/users/logout/', 'POST', { refresh_token: rt }, true)
  },

  // 获取用户档案（统一走 /diet/profile/）；附带 _t 减轻中间层缓存旧头像
  async getUserProfile() {
    const raw = await request('/diet/profile/', 'GET', { _t: Date.now() })
    return normalizeUserProfile(raw)
  },

  // 更新用户信息
  async updateUserProfile(data) {
    const raw = await request('/diet/profile/', 'PATCH', data)
    return normalizeUserProfile(raw)
  },

  // 获取其他用户公开信息（用于用户主页）
  async getUserProfileById(userId) {
    return await request(`/users/${userId}/profile/`, 'GET')
  },

  // 关注/取消关注用户
  async toggleFollowUser(userId, isFollow) {
    const method = isFollow ? 'POST' : 'DELETE'
    return await request(`/users/${userId}/follow/`, method)
  },

  // 获取用户发布的动态列表
  async getUserPosts(userId, page = 1, pageSize = 20) {
    return await request(`/users/${userId}/posts/`, 'GET', { page, page_size: pageSize })
  },

  // 上传头像（后端统一走档案更新接口）
  async uploadAvatar(filePath) {
    return new Promise((resolve, reject) => {
      const API_BASE = getApp().globalData.apiBaseUrl
      const accessToken = app.globalData.accessToken
      wx.uploadFile({
        url: `${API_BASE}/diet/profile/`,
        filePath: filePath,
        name: 'avatar',
        header: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        },
        success: async (res) => {
          const status = res.statusCode
          if (status < 200 || status >= 300) {
            reject(new Error(`上传失败（HTTP ${status}）`))
            return
          }
          try {
            const data = JSON.parse(res.data)
            if (data.code === 200) {
              let profile = normalizeUserProfile(data.data || data)
              if (!util.extractAvatarUrlFromPayload(profile)) {
                try {
                  const fresh = await request('/diet/profile/', 'GET', { _t: Date.now() })
                  profile = normalizeUserProfile(fresh)
                } catch (e) {
                  console.warn('[uploadAvatar] 上传成功但未解析到头像，刷新 GET /diet/profile/ 失败', e)
                }
              }
              resolve(profile)
            } else {
              reject(new Error(data.message || data.msg || '上传失败'))
            }
          } catch (e) {
            reject(new Error('解析响应失败'))
          }
        },
        fail: (err) => {
          warnApiConnectionFailure(err)
          reject(new Error(buildRequestFailMessage(err)))
        }
      })
    })
  },

  // ========== 推荐相关 ==========
  // 搜索推荐（智能搜餐）
  async searchRecommend(params) {
    return await request('/diet/search/', 'POST', params)
  },
  
  // ========== 转盘相关 ==========
  // 转盘筛选（三级递进）
  async wheelStep(step, data = {}) {
    return await request('/diet/wheel/', 'POST', { step, ...data })
  },

  // 获取转盘选项（与多步接口统一：step 约定为 1）
  async getWheelItems(lat, lng) {
    const result = await request('/diet/wheel/', 'POST', { step: 1, lat, lng })
    return result.items || result
  },

  // ========== 冰箱相关 ==========
  // 获取冰箱清单
  async getFridgeItems() {
    const result = await request('/diet/fridge/', 'GET')
    return result.items || result
  },

  // 添加食材
  async addFridgeItem(data) {
    return await request('/diet/fridge/', 'POST', data)
  },

  // 更新食材
  async updateFridgeItem(id, data) {
    return await request(`/diet/fridge/${id}/`, 'PATCH', data)
  },

  // 删除食材
  async deleteFridgeItem(id) {
    return await request(`/diet/fridge/${id}/`, 'DELETE')
  },

  // 批量更新冰箱（兼容旧接口）
  async syncFridge(operation, items) {
    return await request('/diet/fridge/sync/', 'POST', {
      operation,
      items
    })
  },

  // ========== 饮食记录相关 ==========
  // 记录摄入
  async logIntake(data) {
    // 确保 source_type 是数字类型
    const payload = {
      ...data,
      source_type: typeof data.source_type === 'string' ? parseInt(data.source_type) : data.source_type
    }
    return await request('/diet/log/', 'POST', payload)
  },
  
  // 偏好操作（收藏/拉黑）
  async setPreference(data) {
    return await request('/diet/preference/', 'POST', data)
  },

  // 获取今日摘要
  async getDailySummary(date) {
    // 如果没有明确传入日期，则不携带 date 参数，让后端默认取「今天」
    const params = {}
    if (date) {
      params.date = date
    }
    return await request('/diet/summary/', 'GET', params)
  },

  // 获取日报/周报数据（含时间轴，支持营养素/份量/备注等细节）
  async getReportData(startDate, endDate) {
    return await request('/diet/report/weekly/', 'GET', { start_date: startDate, end_date: endDate })
  },

  // 更新单条摄入记录（餐次、食物名、营养素、份量、备注等）
  async updateIntake(id, data) {
    return await request(`/diet/log/${id}/`, 'PATCH', data)
  },

  // 获取单条摄入记录详情
  async getIntakeDetail(id) {
    return await request(`/diet/log/${id}/`, 'GET')
  },

  // 删除单条摄入记录
  async deleteIntake(id) {
    return await request(`/diet/log/${id}/`, 'DELETE')
  },
  
  // 获取月报日历
  async getMonthlyCalendar(year, month) {
    return await request('/diet/report/calendar/', 'GET', { year, month })
  },
  
  // 获取历史趋势
  async getHistoryTrend() {
    return await request('/diet/report/history/', 'GET')
  },

  // 获取周报数据
  async getWeeklyReport(startDate, endDate) {
    return await request('/diet/report/weekly/', 'GET', { start_date: startDate, end_date: endDate })
  },

  // ========== 图表数据接口（由后端生成） ==========
  // 获取日报图表数据
  async getDailyChartData(date) {
    return await request('/diet/report/charts/daily/', 'GET', { date })
  },

  // 获取周报图表数据
  async getWeeklyChartData(startDate, endDate) {
    return await request('/diet/report/charts/weekly/', 'GET', { start_date: startDate, end_date: endDate })
  },

  // 获取体重趋势图表数据
  async getWeightChartData(days = 7) {
    return await request('/diet/report/charts/weight/', 'GET', { days })
  },

  // ========== 菜谱相关 ==========
  // 获取菜谱详情
  async getRecipeDetail(id) {
    return await request(`/diet/recipe/${id}/`, 'GET')
  },
  
  // ========== 商家相关 ==========
  // 获取商家详情
  async getRestaurantDetail(id) {
    return await request(`/diet/restaurant/${id}/`, 'GET')
  },

  // 收藏菜谱（聚合到 /diet/preference/）
  async favoriteRecipe(id) {
    return await request('/diet/preference/', 'POST', {
      target_type: 'recipe',
      target_id: id,
      action: 'favorite'
    })
  },

  // 拉黑菜谱（聚合到 /diet/preference/）
  async blockRecipe(id) {
    return await request('/diet/preference/', 'POST', {
      target_type: 'recipe',
      target_id: id,
      action: 'block'
    })
  },

  // ========== 收藏相关 ==========
  // 获取收藏列表（「全部」不传 type，避免部分后端对 type=all 分支写错导致 500）
  async getFavorites(type = 'all') {
    if (type && type !== 'all') {
      return await request('/diet/favorites/', 'GET', { type })
    }
    return await request('/diet/favorites/', 'GET', {})
  },

  // 收藏餐厅（聚合到 /diet/preference/）
  async favoriteRestaurant(id) {
    return await request('/diet/preference/', 'POST', {
      target_type: 'restaurant',
      target_id: id,
      action: 'favorite'
    })
  },

  // 取消收藏（通用，聚合到 /diet/preference/）
  async unfavorite(id, type) {
    const targetType = type === 'recipe' ? 'recipe' : 'restaurant'
    return await request('/diet/preference/', 'POST', {
      target_type: targetType,
      target_id: id,
      action: 'unfavorite'
    })
  },

  // ========== AI营养师相关 ==========
  /**
   * 营养分析 / 报告洞察
   * @param {string|Object} dateOrPayload 兼容：仅日期字符串（日报），或 body 对象（可含 period、range_start、range_end、summary 等，供周/月报 LLM）
   */
  async getNutritionAnalysis(dateOrPayload) {
    const body =
      typeof dateOrPayload === 'string'
        ? { date: dateOrPayload }
        : { ...dateOrPayload }
    return await request('/diet/ai-nutritionist/analyze/', 'POST', body)
  },

  // 获取实时建议
  async getRealTimeAdvice(context) {
    return await request('/diet/ai-nutritionist/advice/', 'POST', context)
  },

  // AI智能问答
  async askAI(question, context) {
    return await request('/diet/ai-nutritionist/ask/', 'POST', {
      question,
      ...context
    })
  },

  /**
   * 流式问答（SSE / chunked）。
   * 约定：POST /diet/ai-nutritionist/ask/stream/，响应 text/event-stream，事件行 data: {...JSON}，
   * 字段支持 delta / text / content；结束可为 data: [DONE] 或 JSON 内 done: true。
   * 若基础库不支持 chunked、或接口不可用，Promise reject（页面回退 askAI + 打字机）。
   */
  askAIStream(question, context, handlers) {
    const app = getApp()
    const API_BASE = app.globalData.apiBaseUrl
    if (!app.globalData.accessToken) {
      const { access, refresh } = auth.readStoredTokens()
      if (access) {
        app.globalData.accessToken = access
        if (refresh) app.globalData.refreshToken = refresh
      }
    }
    const h = handlers || {}
    const onDelta = typeof h.onDelta === 'function' ? h.onDelta : null
    const onDone = typeof h.onDone === 'function' ? h.onDone : null
    const onError = typeof h.onError === 'function' ? h.onError : null
    const onRequestTask = typeof h.onRequestTask === 'function' ? h.onRequestTask : null

    if (!wx.canIUse || !wx.canIUse('request.enableChunked')) {
      return Promise.reject(new Error('STREAM_UNSUPPORTED'))
    }

    return new Promise((resolve, reject) => {
      let decoder = new TextDecoder('utf-8')
      let sseBuffer = ''
      let finished = false
      let streamed = false
      let suggestions = []

      const safeDone = (extra) => {
        if (finished) return
        finished = true
        const sug = (extra && extra.suggestions) || suggestions
        if (onDone) onDone({ suggestions: sug })
        resolve({ suggestions: sug })
      }

      const safeFail = (err) => {
        if (finished) return
        finished = true
        const e = err instanceof Error ? err : new Error(String(err || 'STREAM_FAILED'))
        if (onError) onError(e)
        reject(e)
      }

      const processBlock = (block) => {
        const lines = block.split(/\r?\n/)
        for (const line of lines) {
          if (!line.startsWith('data:')) continue
          const payload = line.slice(5).trim()
          if (payload === '[DONE]') {
            safeDone({ suggestions })
            return
          }
          try {
            const j = JSON.parse(payload)
            const delta =
              j.delta ??
              j.delta_text ??
              j.text ??
              j.content ??
              ''
            if (delta && onDelta) onDelta(String(delta))
            if (j.suggestions && Array.isArray(j.suggestions)) suggestions = j.suggestions
            if (j.answer && !delta && onDelta) onDelta(String(j.answer))
            if (j.done) {
              safeDone({ suggestions })
              return
            }
          } catch (parseErr) {
            if (payload && onDelta) onDelta(payload)
          }
        }
      }

      const flushBuffer = () => {
        sseBuffer += decoder.decode()
        let idx
        while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
          const block = sseBuffer.slice(0, idx)
          sseBuffer = sseBuffer.slice(idx + 2)
          if (block.trim()) processBlock(block)
        }
      }

      const task = wx.request({
        url: `${API_BASE}/diet/ai-nutritionist/ask/stream/`,
        method: 'POST',
        header: {
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          Authorization: app.globalData.accessToken
            ? `Bearer ${app.globalData.accessToken}`
            : ''
        },
        data: { question, ...context },
        enableChunked: true,
        success(res) {
          if (res.statusCode === 401) {
            auth.clearSession(app)
            app.wxLogin()
            safeFail(new Error('登录已过期，请重新登录'))
            return
          }
          if (res.statusCode < 200 || res.statusCode >= 300) {
            safeFail(new Error(`HTTP ${res.statusCode}`))
            return
          }
          try {
            flushBuffer()
            if (sseBuffer.trim()) processBlock(sseBuffer)
          } catch (e) {
            // ignore flush errors
          }
          if (!streamed && res.data != null && res.data !== '') {
            try {
              const body = auth.parseWxJsonBody(res.data)
              if (body && body.code === 200) {
                const payload = body.data !== undefined ? body.data : body
                const answer = payload.answer || payload.text || ''
                const sug = payload.suggestions || []
                if (answer && onDelta) onDelta(String(answer))
                safeDone({ suggestions: sug })
                return
              }
            } catch (e) {
              // not JSON
            }
          }
          safeDone({ suggestions })
        },
        fail(err) {
          warnApiConnectionFailure(err)
          safeFail(new Error(buildRequestFailMessage(err)))
        }
      })

      if (!task || typeof task.onChunkReceived !== 'function') {
        if (task && typeof task.abort === 'function') {
          try {
            task.abort()
          } catch (e) {}
        }
        safeFail(new Error('STREAM_UNSUPPORTED'))
        return
      }

      if (onRequestTask) onRequestTask(task)

      task.onChunkReceived((res) => {
        streamed = true
        try {
          const u8 = new Uint8Array(res.data)
          sseBuffer += decoder.decode(u8, { stream: true })
          let idx
          while ((idx = sseBuffer.indexOf('\n\n')) !== -1) {
            const block = sseBuffer.slice(0, idx)
            sseBuffer = sseBuffer.slice(idx + 2)
            if (block.trim()) processBlock(block)
          }
        } catch (e) {
          safeFail(e)
        }
      })
    })
  },

  // 上传AI附件（图片/文档等）
  // 约定后端接口：POST /diet/ai-nutritionist/upload/  form-data: file
  // 返回：{ url, name, mime_type, size }（或 data 字段包含这些）
  async uploadAttachment(filePath, name = 'file') {
    return new Promise((resolve, reject) => {
      const API_BASE = getApp().globalData.apiBaseUrl
      const accessToken = app.globalData.accessToken
      wx.uploadFile({
        url: `${API_BASE}/diet/ai-nutritionist/upload/`,
        filePath,
        name: 'file',
        formData: { name },
        header: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            if (data.code === 200) {
              const payload = data.data !== undefined ? data.data : data
              resolve(payload)
            } else {
              reject(new Error(data.message || data.msg || '上传失败'))
            }
          } catch (e) {
            reject(new Error('解析响应失败'))
          }
        },
        fail: (err) => reject(err)
      })
    })
  },

  /**
   * 社区发帖用：把本地临时路径上传为服务端可访问的 URL。
   * 优先 POST /diet/community/upload/（字段 file）；若接口未部署（404/405）则回退到 /diet/ai-nutritionist/upload/。
   */
  async uploadCommunityImage(filePath) {
    const API_BASE = getApp().globalData.apiBaseUrl
    const accessToken = app.globalData.accessToken
    const header = {
      Authorization: accessToken ? `Bearer ${accessToken}` : ''
    }

    const parseBody = (res) => {
      const status = res.statusCode
      let data
      try {
        data = JSON.parse(res.data)
      } catch (e) {
        return { status, err: new Error('解析响应失败') }
      }
      if (status >= 200 && status < 300 && data.code === 200) {
        const payload = data.data !== undefined ? data.data : data
        const url = payload.url || payload.image_url || payload.image
        if (url) return { status, url: String(url) }
        return { status, err: new Error('上传成功但未返回图片地址') }
      }
      return { status, err: new Error(data.message || data.msg || `上传失败（HTTP ${status}）`) }
    }

    const tryCommunity = () =>
      new Promise((resolve, reject) => {
        wx.uploadFile({
          url: `${API_BASE}/diet/community/upload/`,
          filePath,
          name: 'file',
          header,
          success: (res) => {
            const status = res.statusCode
            if (status === 404 || status === 405) {
              reject(new Error('FALLBACK_COMMUNITY_UPLOAD'))
              return
            }
            const parsed = parseBody(res)
            if (parsed.url) resolve(parsed.url)
            else reject(parsed.err || new Error('上传失败'))
          },
          fail: (err) => {
            warnApiConnectionFailure(err)
            reject(new Error(buildRequestFailMessage(err)))
          }
        })
      })

    try {
      return await tryCommunity()
    } catch (e) {
      if (e && e.message === 'FALLBACK_COMMUNITY_UPLOAD') {
        const payload = await api.uploadAttachment(filePath, 'community')
        const u = payload.url || payload.image_url
        if (u) return String(u)
        throw new Error('上传成功但未返回图片地址')
      }
      throw e
    }
  },

  // 获取健康预警
  async getHealthWarnings() {
    return await request('/diet/ai-nutritionist/warnings/', 'GET')
  },

  // ========== 食材识别相关 ==========
  // 上传图片并识别食材（用于冰箱添加）
  async recognizeIngredient(imagePath) {
    return new Promise((resolve, reject) => {
      const API_BASE = getApp().globalData.apiBaseUrl
      const accessToken = app.globalData.accessToken
      wx.uploadFile({
        url: `${API_BASE}/diet/ingredient/recognize/`,
        filePath: imagePath,
        name: 'image',
        header: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            const httpOk = res.statusCode >= 200 && res.statusCode < 300
            if (httpOk && data.code === 200) {
              resolve(data.data || data)
            } else {
              const msg =
                data.message ||
                data.msg ||
                (data.data && typeof data.data === 'object' && data.data.message) ||
                '识别失败'
              reject(new Error(msg))
            }
          } catch (e) {
            reject(new Error('解析响应失败'))
          }
        },
        fail: (err) => {
          warnApiConnectionFailure(err)
          reject(new Error(buildRequestFailMessage(err)))
        }
      })
    })
  },

  // ========== 拍图识热量相关 ==========
  // 上传图片并识别食物
  async recognizeFood(imagePath) {
    return new Promise((resolve, reject) => {
      const API_BASE = getApp().globalData.apiBaseUrl
      const accessToken = app.globalData.accessToken
      wx.uploadFile({
        url: `${API_BASE}/diet/ai/food-recognition/`,
        filePath: imagePath,
        name: 'image',
        header: {
          'Authorization': accessToken ? `Bearer ${accessToken}` : ''
        },
        success: (res) => {
          try {
            const data = JSON.parse(res.data)
            const httpOk = res.statusCode >= 200 && res.statusCode < 300
            if (httpOk && data.code === 200) {
              resolve(data.data || data)
            } else {
              const msg =
                data.message ||
                data.msg ||
                (data.data && typeof data.data === 'object' && data.data.message) ||
                '识别失败'
              reject(new Error(msg))
            }
          } catch (e) {
            reject(new Error('解析响应失败'))
          }
        },
        fail: (err) => {
          warnApiConnectionFailure(err)
          reject(new Error(buildRequestFailMessage(err)))
        }
      })
    })
  },

  // ========== 健康挑战赛相关 ==========
  // 获取挑战任务列表
  async getChallengeTasks(type, status) {
    return await request('/diet/challenge/tasks/', 'GET', { type, status })
  },

  // 获取挑战详情
  async getChallengeDetail(challengeId) {
    return await request(`/diet/challenge/tasks/${challengeId}/`, 'GET')
  },

  // 加入挑战
  async joinChallenge(challengeId) {
    return await request(`/diet/challenge/tasks/${challengeId}/join/`, 'POST')
  },

  // 获取我的挑战进度
  async getMyChallengeProgress(status, challengeId) {
    return await request('/diet/challenge/progress/', 'GET', { status, challenge_id: challengeId })
  },

  // 检查挑战进度
  async checkChallengeProgress(progressId) {
    return await request(`/diet/challenge/progress/${progressId}/check/`, 'POST')
  },

  // 退出挑战
  async abandonChallenge(progressId) {
    return await request(`/diet/challenge/progress/${progressId}/abandon/`, 'POST')
  },

  // 更新任务进度（保留兼容性）
  async updateTaskProgress(taskId, progress) {
    return await request(`/diet/challenge/tasks/${taskId}/progress/`, 'POST', { progress })
  },

  // 获取成就列表
  async getAchievements() {
    return await request('/diet/achievements/', 'GET')
  },

  // 获取排行榜
  async getLeaderboard(type = 'weekly', scope = 'global') {
    return await request('/diet/challenge/leaderboard/', 'GET', { type, scope })
  },

  // ========== 智能购物清单相关 ==========
  // 生成购物清单
  async generateShoppingList(data) {
    return await request('/diet/shopping-list/generate/', 'POST', data)
  },

  // 获取采购地点推荐
  async getShoppingStores(lat, lng, radius = 3000) {
    return await request('/diet/shopping-list/stores/', 'GET', { lat, lng, radius })
  },

  // ========== 健康补救相关 ==========
  // 获取补救方案
  async getRemedySolutions(scenario) {
    return await request('/diet/remedy/solutions/', 'GET', { scenario })
  },

  // 添加到计划
  async addRemedyToPlan(remedyId) {
    return await request('/diet/remedy/add-to-plan/', 'POST', { remedy_id: remedyId })
  },

  // 收藏/取消收藏补救方案
  async toggleRemedyFavorite(remedyId) {
    return await request('/diet/remedy/favorite/', 'POST', { remedy_id: remedyId })
  },

  // 获取使用历史
  async getRemedyUsageHistory(page = 1, pageSize = 20) {
    return await request('/diet/remedy/usage-history/', 'GET', { page, page_size: pageSize })
  },

  // ========== 碳足迹相关 ==========
  // 获取今日碳足迹
  async getCarbonFootprint(date) {
    return await request('/diet/carbon/footprint/', 'GET', { date })
  },

  // 获取本周碳足迹
  async getWeeklyCarbonFootprint(startDate, endDate) {
    return await request('/diet/carbon/footprint/weekly/', 'GET', { start_date: startDate, end_date: endDate })
  },

  // 获取碳足迹历史趋势
  async getCarbonHistory() {
    return await request('/diet/carbon/footprint/history/', 'GET')
  },

  // 获取环保建议
  async getCarbonSuggestions() {
    return await request('/diet/carbon/suggestions/', 'GET')
  },

  // 获取环保成就
  async getCarbonAchievements() {
    return await request('/diet/carbon/achievements/', 'GET')
  },

  // ========== 运动相关 ==========
  // 保存运动记录
  async saveWorkout(data) {
    return await request('/diet/workout/save/', 'POST', data)
  },

  // 获取今日运动统计
  async getTodayWorkoutStats() {
    return await request('/diet/workout/today-stats/', 'GET')
  },

  // 获取运动历史
  async getWorkoutHistory(page = 1, pageSize = 20) {
    return await request('/diet/workout/history/', 'GET', { page, page_size: pageSize })
  },

  // 获取运动详情
  async getWorkoutDetail(id) {
    return await request(`/diet/workout/${id}/`, 'GET')
  },

  // ========== 社区分享相关 ==========
  // 获取社区动态列表（order: latest | hot）
  async getCommunityFeed(page = 1, pageSize = 10, order = 'latest') {
    return await request('/diet/community/feed/', 'GET', { page, page_size: pageSize, order })
  },

  // 收藏/取消收藏帖子
  async toggleCommunitySave(feedId, isSave) {
    const method = isSave ? 'POST' : 'DELETE'
    return await request(`/diet/community/feed/${feedId}/save/`, method)
  },

  // 举报帖子
  async reportCommunityPost(feedId) {
    return await request(`/diet/community/feed/${feedId}/report/`, 'POST')
  },

  // 获取帖子详情（论坛讨论页）
  async getCommunityFeedDetail(feedId) {
    return await request(`/diet/community/feed/${feedId}/`, 'GET')
  },

  // 获取菜谱分享列表
  async getCommunityRecipes(page = 1, pageSize = 10) {
    return await request('/diet/community/recipes/', 'GET', { page, page_size: pageSize })
  },

  // 获取商家分享列表
  async getCommunityRestaurants(page = 1, pageSize = 10) {
    return await request('/diet/community/restaurants/', 'GET', { page, page_size: pageSize })
  },

  // 发布社区分享
  async publishCommunityShare(data) {
    return await request('/diet/community/share/', 'POST', data)
  },

  // 点赞/取消点赞
  async toggleCommunityLike(feedId, isLiked) {
    const method = isLiked ? 'POST' : 'DELETE'
    return await request(`/diet/community/feed/${feedId}/like/`, method)
  },

  // 获取评论列表
  async getCommunityComments(feedId) {
    return await request(`/diet/community/feed/${feedId}/comments/`, 'GET')
  },

  // 添加评论
  async addCommunityComment(feedId, content) {
    return await request(`/diet/community/feed/${feedId}/comments/`, 'POST', { content })
  }
}

module.exports = api
