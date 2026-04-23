// pages/community/community.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    currentTab: 'feed', // feed, recipe, restaurant
    feedList: [],
    displayFeedList: [], // 动态列表（经搜索、排序后展示）
    recipeList: [],
    restaurantList: [],
    loading: false,
    hasMore: true,
    page: 1,
    pageSize: 10,
    searchKeyword: '',
    feedSortOrder: 'latest', // latest | hot
    hotTags: [
      { id: '1', label: '# 减脂', keyword: '减脂' },
      { id: '2', label: '# 快手菜', keyword: '快手' },
      { id: '3', label: '# 轻食', keyword: '轻食' },
      { id: '4', label: '# 低卡', keyword: '低卡' },
      { id: '5', label: '# 运动', keyword: '运动' },
      { id: '6', label: '# 跑步', keyword: '跑步' },
      { id: '7', label: '# 健身', keyword: '健身' }
    ],
    
    // 发布相关
    showPublishModal: false,
    publishContent: '',
    publishContentLength: 0, // 分享内容字数，用于展示
    publishImages: [], // 用户选择的图片临时路径，最多 9 张
    canAddMoreImages: true, // 是否还可添加图片（最多 9 张）
    publishType: 'meal', // recipe, restaurant, meal, sport
    publishing: false,
    sportType: 'run',
    sportDuration: '',
    sportDistance: '',
    sportCalories: '',
    hasContentToPublish: false, // 有文字或图片时可发布
    showEmojiPanel: false,
    emojiList: ['😀', '😊', '🥰', '😋', '😎', '👍', '👏', '❤️', '🔥', '🍎', '🥗', '🍳', '🥘', '🍕', '🍜', '🥟', '🍰', '☕', '🥤', '🍽️', '🌟', '💪', '🙌', '😄', '🥳'],
    shareId: '',
    shareName: '',
    shareImage: '',
    
    // 评论相关
    showCommentsModal: false,
    currentFeedId: null,
    currentComments: [],
    commentText: '',
    commenting: false
  },

  onLoad(options) {
    // 支持从外部传入tab参数
    const tab = options.tab || 'feed'
    this.setData({ currentTab: tab })
    
    // 如果从其他页面跳转过来分享，自动打开发布弹窗
    if (options.share === 'true') {
      const shareType = options.type || 'recipe' // recipe, restaurant, meal
      const shareId = options.id || ''
      const shareName = options.name || ''
      const shareImage = options.image || ''
      
      this.setData({
        publishType: shareType,
        shareId: shareId,
        shareName: shareName,
        shareImage: shareImage
      })
      
      // 延迟打开弹窗，确保页面已渲染
      setTimeout(() => {
        this.showPublishModal()
        // 自动填充内容
        if (shareName) {
          let content = ''
          if (shareType === 'recipe') {
            content = `今天做了这道${shareName}，推荐给大家～`
          } else if (shareType === 'restaurant') {
            content = `这家${shareName}真的很不错，健康又美味！`
          }
          this.setData({ publishContent: content })
        }
      }, 300)
    }
    
    this.loadData()
  },

  onShow() {
    // 每次显示时刷新
    this.loadData(false)
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.setData({ page: 1, hasMore: true })
    this.loadData(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 上拉加载更多
  onReachBottom() {
    if (this.data.hasMore && !this.data.loading) {
      this.loadMore()
    }
  },

  // 加载数据
  async loadData(showLoading = true) {
    try {
      if (showLoading) {
        util.showLoading('加载中...')
        this.setData({ loading: true })
      }

      const { currentTab } = this.data
      
      if (currentTab === 'feed') {
        await this.loadFeedList(true)
      } else if (currentTab === 'recipe') {
        await this.loadRecipeList(true)
      } else if (currentTab === 'restaurant') {
        await this.loadRestaurantList(true)
      }
    } catch (error) {
      console.error('加载数据失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      if (showLoading) {
        util.hideLoading()
      }
      this.setData({ loading: false })
    }
  },

  // 加载更多
  async loadMore() {
    if (this.data.loading || !this.data.hasMore) return
    
    this.setData({ loading: true })
    const { currentTab } = this.data
    
    try {
      if (currentTab === 'feed') {
        await this.loadFeedList(false)
      } else if (currentTab === 'recipe') {
        await this.loadRecipeList(false)
      } else if (currentTab === 'restaurant') {
        await this.loadRestaurantList(false)
      }
    } catch (error) {
      console.error('加载更多失败', error)
      util.showToast('加载失败，请重试')
    } finally {
      this.setData({ loading: false })
    }
  },

  // 加载动态列表
  async loadFeedList(reset = false) {
    try {
      const page = reset ? 1 : this.data.page + 1
      const order = this.data.feedSortOrder
      const result = await api.getCommunityFeed(page, this.data.pageSize, order)
      
      const feedList = reset ? result.list : [...this.data.feedList, ...result.list]
      
      this.setData({ feedList, page, hasMore: result.has_more || false })
      this._updateDisplayFeedList()
    } catch (error) {
      console.error('加载动态列表失败', error)
      throw error
    }
  },

  // 根据搜索关键词与排序更新展示列表
  _updateDisplayFeedList() {
    const { feedList, searchKeyword, feedSortOrder } = this.data
    let list = [...(feedList || [])]
    const kw = (searchKeyword || '').trim().toLowerCase()
    if (kw) {
      list = list.filter(item => {
        const content = (item.content || '').toLowerCase()
        const name = (item.user && item.user.nickname || '').toLowerCase()
        const related = (item.related_item && item.related_item.name || '').toLowerCase()
        return content.includes(kw) || name.includes(kw) || related.includes(kw)
      })
    }
    if (feedSortOrder === 'hot') {
      list.sort((a, b) => (b.like_count || 0) - (a.like_count || 0))
    }
    this.setData({ displayFeedList: list })
  },

  onSearchInput(e) {
    const searchKeyword = e.detail.value || ''
    this.setData({ searchKeyword })
    this._updateDisplayFeedList()
  },

  onSearchConfirm(e) {
    this.setData({ searchKeyword: (e.detail.value || '').trim() })
    this._updateDisplayFeedList()
  },

  onSearchBlur() {
    // 可选：失焦时保持列表，不额外操作
  },

  clearSearch() {
    this.setData({ searchKeyword: '' })
    this._updateDisplayFeedList()
  },

  setFeedSort(e) {
    const order = e.currentTarget.dataset.order
    if (order === this.data.feedSortOrder) return
    this.setData({ feedSortOrder: order, page: 1, hasMore: true })
    this.loadFeedList(true)
  },

  applyHotTag(e) {
    const keyword = e.currentTarget.dataset.keyword
    this.setData({ searchKeyword: keyword })
    this._updateDisplayFeedList()
  },

  // 帖子更多菜单：收藏、举报
  showPostMenu(e) {
    const item = e.currentTarget.dataset.item
    if (!item) return
    wx.showActionSheet({
      itemList: [(item.is_saved ? '取消收藏' : '收藏'), '举报'],
      success: (res) => {
        if (res.tapIndex === 0) this._toggleSavePost(item.id, item.is_saved)
        if (res.tapIndex === 1) this._reportPost(item.id)
      }
    })
  },

  async _toggleSavePost(feedId, isSaved) {
    try {
      await api.toggleCommunitySave(feedId, !isSaved)
      const feedList = this.data.feedList.map(x => x.id === feedId ? { ...x, is_saved: !isSaved } : x)
      this.setData({ feedList })
      this._updateDisplayFeedList()
      util.showToast(isSaved ? '已取消收藏' : '已收藏', 'success')
    } catch (err) {
      util.showToast('操作失败')
    }
  },

  _reportPost(feedId) {
    wx.showModal({
      title: '举报',
      content: '确定要举报该动态吗？',
      success: (res) => {
        if (res.confirm) {
          api.reportCommunityPost(feedId).then(() => {
            util.showToast('已提交举报', 'success')
          }).catch(() => util.showToast('提交失败'))
        }
      }
    })
  },

  // 加载菜谱分享列表
  async loadRecipeList(reset = false) {
    try {
      const page = reset ? 1 : this.data.page + 1
      const result = await api.getCommunityRecipes(page, this.data.pageSize)
      const rawList = result.list || []
      const mapped = rawList.map((entry) => {
        if (!entry || !entry.recipe) return entry
        return {
          ...entry,
          recipe: {
            ...entry.recipe,
            image: util.resolveRecipeCoverUrl(entry.recipe)
          }
        }
      })
      const recipeList = reset ? mapped : [...this.data.recipeList, ...mapped]
      
      this.setData({
        recipeList,
        page,
        hasMore: result.has_more || false
      })
    } catch (error) {
      console.error('加载菜谱分享列表失败', error)
      throw error
    }
  },

  // 加载商家分享列表
  async loadRestaurantList(reset = false) {
    try {
      const page = reset ? 1 : this.data.page + 1
      const result = await api.getCommunityRestaurants(page, this.data.pageSize)
      
      const restaurantList = reset ? result.list : [...this.data.restaurantList, ...result.list]
      
      this.setData({
        restaurantList,
        page,
        hasMore: result.has_more || false
      })
    } catch (error) {
      console.error('加载商家分享列表失败', error)
      throw error
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.currentTab) return
    
    this.setData({ 
      currentTab: tab,
      page: 1,
      hasMore: true
    })
    this.loadData()
  },

  // 显示发布弹窗（从分享入口进入时保留 shareId/shareName/shareImage 与已填内容）
  showPublishModal() {
    const { shareId, shareName, shareImage, publishType } = this.data
    const fromShare = !!(shareId && shareName)
    const publishContent = fromShare ? (this.data.publishContent || '') : ''
    const publishImages = fromShare ? (this.data.publishImages || []) : []
    const hasContentToPublish = !!(
      (publishContent && publishContent.trim()) ||
      publishImages.length > 0 ||
      fromShare
    )
    this.setData({
      showPublishModal: true,
      publishContent,
      publishContentLength: (publishContent || '').length,
      publishImages,
      canAddMoreImages: publishImages.length < 9,
      publishType: publishType || 'meal',
      hasContentToPublish,
      showEmojiPanel: false
    })
  },

  // 隐藏发布弹窗
  hidePublishModal() {
    this.setData({
      showPublishModal: false,
      publishImages: [],
      canAddMoreImages: true,
      showEmojiPanel: false,
      sportType: 'run',
      sportDuration: '',
      sportDistance: '',
      sportCalories: ''
    })
  },

  // 展开/收起表情面板
  toggleEmojiPanel() {
    this.setData({ showEmojiPanel: !this.data.showEmojiPanel })
  },

  // 在内容中插入表情（用 index 取表情，避免 data 属性里 emoji 异常）
  insertEmoji(e) {
    const raw = e.currentTarget.dataset.index
    const index = typeof raw === 'number' ? raw : parseInt(raw, 10)
    const list = this.data.emojiList || []
    const emoji = list[index]
    if (emoji == null || Number.isNaN(index)) return
    let publishContent = (this.data.publishContent || '') + emoji
    const maxLen = 500
    if (publishContent.length > maxLen) {
      publishContent = publishContent.slice(0, maxLen)
    }
    const hasContentToPublish = !!(
      publishContent.trim() ||
      (this.data.publishImages && this.data.publishImages.length > 0)
    )
    const len = publishContent.length
    // 受控 textarea 在真机插入后常会立刻收到「旧值」的 input，覆盖表情；记录插入时刻供 onContentInput 丢弃脏事件
    this._emojiInsertedAt = Date.now()
    this.setData({ publishContent, publishContentLength: len, hasContentToPublish }, () => {
      if (typeof wx !== 'undefined' && wx.nextTick) {
        wx.nextTick(() => {
          this.setData({ publishContent, publishContentLength: len })
        })
      }
    })
  },

  // 选择要上传的图片（相册/拍照，最多 9 张）
  choosePublishImage() {
    const that = this
    const remain = 9 - (that.data.publishImages || []).length
    if (remain <= 0) return
    // 优先使用 chooseImage，兼容性更好；部分基础库支持 chooseMedia 多选
    const opts = {
      count: remain,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera'],
      success(res) {
        const paths = res.tempFilePaths || []
        if (!paths.length) return
        const prev = that.data.publishImages || []
        const publishImages = prev.concat(paths).slice(0, 9)
        that.setData({ publishImages, hasContentToPublish: true, canAddMoreImages: publishImages.length < 9 })
      },
      fail(err) {
        if (err && err.errMsg && !/cancel|canceled/i.test(err.errMsg)) {
          util.showToast(err.errMsg || '选择图片失败')
        }
      }
    }
    if (typeof wx.chooseImage === 'function') {
      wx.chooseImage(opts)
    } else if (typeof wx.chooseMedia === 'function') {
      wx.chooseMedia({
        count: remain,
        mediaType: ['image'],
        sourceType: ['album', 'camera'],
        success(res) {
          const files = (res.tempFiles || []).map(function(f) { return f.tempFilePath })
          const prev = that.data.publishImages || []
          const publishImages = prev.concat(files).slice(0, 9)
          that.setData({ publishImages, hasContentToPublish: true, canAddMoreImages: publishImages.length < 9 })
        },
        fail: opts.fail
      })
    } else {
      util.showToast('当前环境不支持选择图片')
    }
  },

  // 移除已选图片
  removePublishImage(e) {
    const index = e.currentTarget.dataset.index
    const publishImages = this.data.publishImages.filter((_, i) => i !== index)
    const hasContentToPublish = !!(
      (this.data.publishContent && this.data.publishContent.trim()) ||
      publishImages.length > 0
    )
    this.setData({ publishImages, hasContentToPublish, canAddMoreImages: true })
  },

  // 输入内容
  onContentInput(e) {
    const next = e.detail.value || ''
    const cur = this.data.publishContent || ''
    // 插入表情后 ~120ms 内若收到比当前 data 更短的值，多为受控 textarea 的滞后 input（真机常见），忽略以免抹掉表情
    if (this._emojiInsertedAt && Date.now() - this._emojiInsertedAt < 120) {
      if (next.length < cur.length && cur.startsWith(next) && next.length > 0) {
        return
      }
    }
    this._emojiInsertedAt = 0
    const publishContent = next
    const publishContentLength = publishContent.length
    const hasContentToPublish = !!(
      (publishContent && publishContent.trim()) ||
      (this.data.publishImages && this.data.publishImages.length > 0)
    )
    this.setData({ publishContent, publishContentLength, hasContentToPublish })
  },

  // 选择分享类型（仅选中类型，不跳转）
  selectShareType(e) {
    const type = e.currentTarget.dataset.type
    this.setData({ publishType: type })
  },

  setSportType(e) {
    this.setData({ sportType: e.currentTarget.dataset.type })
  },
  onSportDurationInput(e) {
    this.setData({ sportDuration: e.detail.value })
  },
  onSportDistanceInput(e) {
    this.setData({ sportDistance: e.detail.value })
  },
  onSportCaloriesInput(e) {
    this.setData({ sportCalories: e.detail.value })
  },

  // 去选择要分享的菜谱（从菜谱详情页可带参返回）
  goPickRecipe() {
    wx.navigateTo({
      url: '/packageCook/cook/cook?from=share'
    })
  },

  // 去选择要分享的商家（从商家详情页可带参返回）
  goPickRestaurant() {
    wx.navigateTo({
      url: '/packageRestaurant/restaurant/restaurant?from=share'
    })
  },

  // 提交发布
  async submitPublish() {
    const { publishContent, publishImages, publishType, shareId, shareName, shareImage, sportType, sportDuration, sportDistance, sportCalories } = this.data
    const hasText = publishContent && publishContent.trim()
    const hasImages = publishImages && publishImages.length > 0
    if (!hasText && !hasImages) {
      util.showToast('请填写分享内容或添加图片')
      return
    }

    try {
      this.setData({ publishing: true })
      
      const shareData = {
        content: publishContent,
        type: publishType
      }
      
      if (shareId && (publishType === 'recipe' || publishType === 'restaurant')) {
        shareData.related_id = shareId
        shareData.related_name = shareName
        shareData.related_image = shareImage
      }
      
      if (publishType === 'sport') {
        const typeNames = { run: '跑步', fitness: '健身', cycle: '骑行', swim: '游泳', other: '其他' }
        shareData.sport_info = {
          sport_type: sportType,
          type_name: typeNames[sportType] || '运动',
          duration: sportDuration ? parseInt(sportDuration, 10) : null,
          distance: sportDistance ? parseFloat(sportDistance) : null,
          calories: sportCalories ? parseInt(sportCalories, 10) : null
        }
      }
      
      if (publishImages && publishImages.length > 0) {
        const imageUrls = []
        for (let i = 0; i < publishImages.length; i++) {
          const url = await api.uploadCommunityImage(publishImages[i])
          imageUrls.push(url)
        }
        shareData.images = imageUrls
        shareData.image = imageUrls[0]
      }
      
      const newPost = await api.publishCommunityShare(shareData)
      
      util.showToast('内容正在审核中，通过后将展示', 'none', 2800)
      this.hidePublishModal()
      
      this.setData({
        shareId: '',
        shareName: '',
        shareImage: '',
        publishImages: [],
        canAddMoreImages: true,
        sportType: 'run',
        sportDuration: '',
        sportDistance: '',
        sportCalories: ''
      })
      
      if (newPost && newPost.id) {
        const feedList = this.data.feedList || []
        this.setData({ feedList: [newPost].concat(feedList) }, () => this._updateDisplayFeedList())
      } else {
        this.setData({ page: 1, hasMore: true })
        await this.loadFeedList(true)
      }
    } catch (error) {
      console.error('发布失败', error)
      util.showToast('发布失败，请重试')
    } finally {
      this.setData({ publishing: false })
    }
  },

  // 点赞/取消点赞
  async toggleLike(e) {
    const id = e.currentTarget.dataset.id
    const feedList = this.data.feedList
    const index = feedList.findIndex(item => item.id === id)
    
    if (index === -1) return
    
    const item = feedList[index]
    const isLiked = !item.is_liked
    
    // 乐观更新
    feedList[index] = {
      ...item,
      is_liked: isLiked,
      like_count: isLiked ? (item.like_count || 0) + 1 : Math.max(0, (item.like_count || 0) - 1)
    }
    this.setData({ feedList })
    this._updateDisplayFeedList()
    wx.vibrateShort()
    
    try {
      await api.toggleCommunityLike(id, isLiked)
    } catch (error) {
      console.error('点赞失败', error)
      // 回滚
      feedList[index] = item
      this.setData({ feedList })
      util.showToast('操作失败，请重试')
    }
  },

  // 显示评论
  async showComments(e) {
    const id = e.currentTarget.dataset.id
    this.setData({ 
      showCommentsModal: true,
      currentFeedId: id,
      commentText: ''
    })
    
    try {
      const comments = await api.getCommunityComments(id)
      this.setData({ currentComments: comments })
    } catch (error) {
      console.error('加载评论失败', error)
      util.showToast('加载评论失败')
    }
  },

  // 隐藏评论弹窗
  hideCommentsModal() {
    this.setData({ 
      showCommentsModal: false,
      currentFeedId: null,
      currentComments: [],
      commentText: ''
    })
  },

  // 输入评论
  onCommentInput(e) {
    this.setData({ commentText: e.detail.value })
  },

  // 提交评论
  async submitComment() {
    const { commentText, currentFeedId } = this.data
    
    if (!commentText.trim()) {
      util.showToast('请输入评论内容')
      return
    }

    try {
      this.setData({ commenting: true })
      
      const newComment = await api.addCommunityComment(currentFeedId, commentText)
      
      // 添加到评论列表
      const currentComments = [...this.data.currentComments, newComment]
      this.setData({ 
        currentComments,
        commentText: ''
      })
      
      // 更新动态的评论数
      const feedList = this.data.feedList
      const index = feedList.findIndex(item => item.id === currentFeedId)
      if (index !== -1) {
        feedList[index].comment_count = (feedList[index].comment_count || 0) + 1
        this.setData({ feedList })
      }
      
      util.showToast('评论成功', 'success')
    } catch (error) {
      console.error('评论失败', error)
      util.showToast('评论失败，请重试')
    } finally {
      this.setData({ commenting: false })
    }
  },

  // 分享动态
  shareFeed(e) {
    const item = e.currentTarget.dataset.item
    wx.showShareMenu({
      withShareTicket: true,
      menus: ['shareAppMessage', 'shareTimeline']
    })
  },

  // 跳转到帖子详情（论坛讨论页）
  goToPostDetail(e) {
    const id = e.currentTarget.dataset.id
    if (id) {
      wx.navigateTo({
        url: `/packageCommunity/community-post/community-post?id=${id}`
      })
    }
  },

  // 跳转到用户主页（点击头像或昵称）
  goToUserProfile(e) {
    const userid = e.currentTarget.dataset.userid
    if (userid) {
      wx.navigateTo({
        url: `/packageCommunity/user-profile/user-profile?id=${userid}`
      })
    }
  },

  // 跳转到菜谱详情
  goToRecipeDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageCook/cook-detail/cook-detail?id=${id}`
    })
  },

  // 跳转到商家详情
  goToRestaurantDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${id}`
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  },

  // 分享页面
  onShareAppMessage() {
    return {
      title: '健康生活社区 - 分享你的健康饮食',
      path: '/packageCommunity/community/community',
      imageUrl: ''
    }
  }
})
