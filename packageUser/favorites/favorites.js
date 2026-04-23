// pages/favorites/favorites.js
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    loading: false,
    refreshing: false,
    currentTab: 'all', // all, recipe, restaurant
    recipeList: [],
    restaurantList: [],
    totalCount: 0,
    recipeCount: 0,
    restaurantCount: 0
  },

  onLoad(options) {
    // 支持从外部传入tab参数
    const tab = options.tab || 'all'
    this.setData({ currentTab: tab })
    this.loadFavorites()
  },

  onShow() {
    // 每次显示时刷新，确保收藏状态最新
    this.loadFavorites(false)
  },

  // 下拉刷新
  onPullDownRefresh() {
    this.loadFavorites(true).finally(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载收藏列表（优先 API，与菜谱/餐厅详情页收藏联动）
  async loadFavorites(showLoading = true) {
    try {
      if (showLoading) {
        this.setData({ loading: true })
      } else {
        this.setData({ refreshing: true })
      }

      const res = await api.getFavorites('all')
      const favoritesRaw = Array.isArray(res) ? res : (res && res.list) ? res.list : []
      const favorites = favoritesRaw.map((item) => {
        if (!item || item.type !== 'recipe') return item
        return { ...item, image: util.resolveRecipeCoverUrl(item) }
      })
      
      const recipeList = favorites.filter(item => item.type === 'recipe')
      const restaurantList = favorites.filter(item => item.type === 'restaurant')
      
      this.setData({
        recipeList,
        restaurantList,
        totalCount: favorites.length,
        recipeCount: recipeList.length,
        restaurantCount: restaurantList.length,
        loading: false,
        refreshing: false
      })
    } catch (error) {
      console.error('加载收藏失败', error)
      const favoritesRaw = this.getFavoritesFromStorage()
      const favorites = favoritesRaw.map((item) => {
        if (!item || item.type !== 'recipe') return item
        return { ...item, image: util.resolveRecipeCoverUrl(item) }
      })
      const recipeList = favorites.filter((item) => item.type === 'recipe')
      const restaurantList = favorites.filter((item) => item.type === 'restaurant')
      this.setData({
        recipeList,
        restaurantList,
        totalCount: favorites.length,
        recipeCount: recipeList.length,
        restaurantCount: restaurantList.length,
        loading: false,
        refreshing: false
      })
      if (favorites.length === 0) {
        util.showToast('加载失败，请重试')
      } else {
        util.showToast('已显示本机缓存收藏，服务端异常时请稍后再试', 'none', 2200)
      }
    }
  },

  // 从本地存储获取收藏
  getFavoritesFromStorage() {
    try {
      const favorites = wx.getStorageSync('favorites') || []
      return Array.isArray(favorites) ? favorites : []
    } catch (error) {
      console.error('读取收藏失败', error)
      return []
    }
  },

  // 保存收藏到本地存储
  saveFavoritesToStorage(favorites) {
    try {
      wx.setStorageSync('favorites', favorites)
    } catch (error) {
      console.error('保存收藏失败', error)
    }
  },

  // 切换标签
  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  // 切换收藏状态（取消收藏时同步后端与本地，列表联动更新）
  async toggleFavorite(e) {
    const { id, type } = e.currentTarget.dataset
    const idStr = String(id)
    
    try {
      const favorites = this.getFavoritesFromStorage()
      const index = favorites.findIndex(item => String(item.id) === idStr && item.type === type)
      
      if (index > -1) {
        favorites.splice(index, 1)
        this.saveFavoritesToStorage(favorites)
        try {
          await api.unfavorite(idStr, type)
        } catch (e) {
          console.warn('取消收藏 API 失败，已更新本地', e)
        }
        const recipeList = favorites.filter(item => item.type === 'recipe')
        const restaurantList = favorites.filter(item => item.type === 'restaurant')
        this.setData({
          recipeList,
          restaurantList,
          totalCount: favorites.length,
          recipeCount: recipeList.length,
          restaurantCount: restaurantList.length
        })
        util.showToast('已取消收藏', 'success')
      } else {
        util.showToast('操作失败')
      }
    } catch (error) {
      console.error('切换收藏失败', error)
      util.showToast('操作失败，请重试')
    }
  },

  // 跳转到菜谱详情
  goToRecipeDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageCook/cook-detail/cook-detail?id=${id}`
    })
  },

  // 跳转到餐厅详情
  goToRestaurantDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${id}`
    })
  },

  // 去发现（首页）
  goToDiscover() {
    wx.switchTab({ url: '/pages/index/index' })
  },

  // 去发现菜谱（空状态引导）
  goToRecipes() {
    wx.navigateTo({ url: '/packageCook/cook/cook' })
  },

  // 去发现餐厅（空状态引导）
  goToRestaurants() {
    wx.navigateTo({ url: '/packageRestaurant/restaurant/restaurant' })
  },

  // 滚动区域内下拉刷新
  onRefresh() {
    this.loadFavorites(false)
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止事件冒泡
  }
})
