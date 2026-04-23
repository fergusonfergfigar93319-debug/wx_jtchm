// pages/profile-edit/profile-edit.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

/** 本地临时路径不应写入 PATCH，避免后端报错 */
function isPersistableAvatarUrl(s) {
  if (!s || typeof s !== 'string') return false
  if (s.indexOf('wxfile://') === 0) return false
  if (/^https?:\/\/tmp\//i.test(s)) return false
  return true
}

/** 内置默认头像（企鹅图为用户素材，其余由 scripts/generate-default-avatars.js 生成） */
const DEFAULT_AVATAR_LIST = [
  { id: 'penguin', name: '企鹅少女', path: '/images/avatars/default-penguin.png' },
  { id: 'salad', name: '轻食沙拉', path: '/images/avatars/default-salad.png' },
  { id: 'rice', name: '温暖米饭', path: '/images/avatars/default-rice.png' },
  { id: 'citrus', name: '鲜果活力', path: '/images/avatars/default-citrus.png' }
]

Page({
  data: {
    defaultAvatars: DEFAULT_AVATAR_LIST,
    userInfo: {},
    nickname: '',
    signature: '', // 个性签名
    height: '',
    weight: '',
    targetWeight: '',
    dailyKcalLimit: '',
    goalType: 'maintain', // maintain: 维持, lose: 减脂, gain: 增肌
    goalTypeIndex: 0,
    goalTypes: [
      { value: 'maintain', label: '维持体重' },
      { value: 'lose', label: '减脂' },
      { value: 'gain', label: '增肌' }
    ],
    uploadingAvatar: false // 头像上传中
  },

  onLoad() {
    this.loadUserProfile()
  },

  // 加载用户信息
  async loadUserProfile() {
    try {
      util.showLoading('加载中...')
      const profile = await api.getUserProfile()
      
      const goalType = profile.goal_type || 'maintain'
      const goalTypeIndex = this.data.goalTypes.findIndex(item => item.value === goalType)
      
      const avatarStr = util.extractAvatarUrlFromPayload(profile)
      this.setData({
        userInfo: Object.assign({}, profile, { avatar: avatarStr }),
        nickname: profile.nickname || '',
        signature: profile.signature || '',
        height: profile.height || '',
        weight: profile.weight || '',
        targetWeight: profile.target_weight || '',
        dailyKcalLimit: profile.daily_kcal_limit || '',
        goalType: goalType,
        goalTypeIndex: goalTypeIndex >= 0 ? goalTypeIndex : 0
      })
    } catch (error) {
      console.error('加载用户信息失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      util.hideLoading()
    }
  },

  // 选择内置默认头像
  selectDefaultAvatar(e) {
    if (this.data.uploadingAvatar) {
      util.showToast('头像上传中，请稍候...')
      return
    }
    const path = e.currentTarget.dataset.path
    if (!path) return
    this.setData({
      'userInfo.avatar': path
    })
    util.showToast('已切换，保存后生效', 'none', 1600)
  },

  // 从相册/相机选择头像
  chooseAvatar() {
    if (this.data.uploadingAvatar) {
      util.showToast('头像上传中，请稍候...')
      return
    }

    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success: async (res) => {
        const tempFilePath = res.tempFilePaths[0]
        
        // 先显示预览
        this.setData({
          'userInfo.avatar': tempFilePath,
          uploadingAvatar: true
        })
        
        try {
          util.showLoading('上传头像中...')
          
          // 上传头像到服务器
          const result = await api.uploadAvatar(tempFilePath)
          const avatarUrl = util.extractAvatarUrlFromPayload(result)
          if (!avatarUrl) {
            // 上传已成功但响应里无 URL：保留本地临时图，用户点「保存」走 PATCH 写库；api 内已尝试 GET 刷新
            this.setData({
              uploadingAvatar: false
            })
            util.hideLoading()
            util.showToast('已上传，请点击保存同步资料', 'none', 2200)
            return
          }

          this.setData({
            'userInfo.avatar': avatarUrl,
            uploadingAvatar: false
          })

          util.hideLoading()
          util.showSuccess('头像上传成功')
        } catch (error) {
          console.error('上传头像失败', error)
          this.setData({
            uploadingAvatar: false
          })
          util.hideLoading()
          const errorMsg = error.message || '上传失败，请重试'
          util.showToast(errorMsg.length > 15 ? '上传失败，请重试' : errorMsg)
        }
      },
      fail: (err) => {
        const msg = (err && err.errMsg) || ''
        if (msg.indexOf('cancel') !== -1) {
          return
        }
        console.error('选择头像失败', err)
        util.showToast('选择头像失败')
      }
    })
  },

  // 输入昵称
  onNicknameInput(e) {
    this.setData({
      nickname: e.detail.value
    })
  },

  // 输入个性签名
  onSignatureInput(e) {
    this.setData({
      signature: e.detail.value
    })
  },

  // 输入身高
  onHeightInput(e) {
    this.setData({
      height: e.detail.value
    })
  },

  // 输入体重
  onWeightInput(e) {
    this.setData({
      weight: e.detail.value
    })
  },

  // 输入目标体重
  onTargetWeightInput(e) {
    this.setData({
      targetWeight: e.detail.value
    })
  },

  // 输入每日目标
  onDailyKcalInput(e) {
    this.setData({
      dailyKcalLimit: e.detail.value
    })
  },

  // 选择目标类型
  onGoalTypeChange(e) {
    const index = parseInt(e.detail.value)
    const goalType = this.data.goalTypes[index].value
    
    this.setData({
      goalTypeIndex: index,
      goalType: goalType
    })
    
    // 根据目标类型自动调整每日卡路里
    const weight = parseFloat(this.data.weight) || 0
    if (weight > 0) {
      let suggestedKcal = 0
      if (goalType === 'lose') {
        // 减脂：基础代谢 * 1.2 - 300
        suggestedKcal = Math.round((weight * 22) * 1.2 - 300)
      } else if (goalType === 'gain') {
        // 增肌：基础代谢 * 1.5 + 300
        suggestedKcal = Math.round((weight * 22) * 1.5 + 300)
      } else {
        // 维持：基础代谢 * 1.3
        suggestedKcal = Math.round((weight * 22) * 1.3)
      }
      
      if (suggestedKcal > 0) {
        this.setData({
          dailyKcalLimit: suggestedKcal
        })
      }
    }
  },

  // 保存
  async saveProfile() {
    // 验证数据
    if (!this.data.nickname || this.data.nickname.trim() === '') {
      util.showToast('请输入昵称')
      return
    }

    if (this.data.height && (this.data.height < 50 || this.data.height > 250)) {
      util.showToast('请输入有效的身高（50-250cm）')
      return
    }

    if (this.data.weight && (this.data.weight < 20 || this.data.weight > 300)) {
      util.showToast('请输入有效的体重（20-300kg）')
      return
    }

    let loadingShown = false
    try {
      util.showLoading('保存中...')
      loadingShown = true

      const updateData = {
        nickname: this.data.nickname.trim(),
        signature: this.data.signature ? this.data.signature.trim() : null,
        height: this.data.height ? parseFloat(this.data.height) : null,
        weight: this.data.weight ? parseFloat(this.data.weight) : null,
        target_weight: this.data.targetWeight ? parseFloat(this.data.targetWeight) : null,
        daily_kcal_limit: this.data.dailyKcalLimit ? parseInt(this.data.dailyKcalLimit) : null,
        goal_type: this.data.goalType
      }
      
      // 如果头像已更新，也包含在更新数据中（兼容只认 avatar_url 的后端）；不写本地临时路径
      const av = util.extractAvatarUrlFromPayload(this.data.userInfo)
      if (av && isPersistableAvatarUrl(av)) {
        updateData.avatar = av
        updateData.avatar_url = av
      }

      const result = await api.updateUserProfile(updateData)
      const resultObj = result && typeof result === 'object' ? result : {}
      const savedAvatar =
        resultObj.avatar ||
        resultObj.avatar_url ||
        updateData.avatar ||
        this.data.userInfo.avatar ||
        ''

      try {
        const app = getApp()
        if (app.globalData.userInfo) {
          app.globalData.userInfo = Object.assign({}, app.globalData.userInfo, resultObj)
          if (savedAvatar) {
            app.globalData.userInfo.avatar = savedAvatar
          }
        }
      } catch (e) {
        // ignore
      }

      // 立即刷新「我的」页头像：避免仅依赖 GET 时字段为空或缓存导致不更新
      const pages = getCurrentPages()
      const prevPage = pages[pages.length - 2]
      const isProfile =
        prevPage &&
        prevPage.route &&
        prevPage.route.indexOf('profile/profile') >= 0
      if (isProfile && savedAvatar) {
        prevPage._pendingAvatarUrl = savedAvatar
        const ui = prevPage.data.userInfo || {}
        prevPage.setData({
          userInfo: Object.assign({}, ui, { avatar: savedAvatar }),
          avatarSrc: util.withAvatarCacheBust(savedAvatar)
        })
        prevPage._lottieAvatarInited = false
      }
      if (isProfile && typeof prevPage.loadUserProfile === 'function') {
        setTimeout(() => prevPage.loadUserProfile(false), 0)
      }

      // showToast/showSuccess 会结束 loading；须先 hideLoading，否则 finally 再次 hide 会触发「必须配对」警告
      if (loadingShown) {
        util.hideLoading()
        loadingShown = false
      }

      // 根据文档，保存成功后显示 BMR 更新提示
      const bmr = resultObj.bmr || resultObj.daily_kcal_limit || updateData.daily_kcal_limit
      if (bmr) {
        util.showSuccess(`BMR 已更新: ${bmr} kcal`)
      } else {
        util.showSuccess('保存成功')
      }

      // 延迟返回，让用户看到成功提示
      setTimeout(() => {
        wx.navigateBack()
      }, 1500)
    } catch (error) {
      console.error('保存失败', error)
      if (loadingShown) {
        util.hideLoading()
        loadingShown = false
      }
      util.showToast('保存失败，请重试')
    }
  }
})
