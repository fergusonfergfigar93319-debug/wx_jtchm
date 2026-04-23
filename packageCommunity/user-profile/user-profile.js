const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    userId: null,
    user: null,
    posts: [],
    loading: true,
    error: '',
    followLoading: false
  },

  onLoad(options) {
    const id = options.id
    if (!id) {
      this.setData({ loading: false, error: '缺少用户信息' })
      return
    }
    this.setData({ userId: id })
    this.loadUser()
  },

  async loadUser() {
    const { userId } = this.data
    if (!userId) return
    this.setData({ loading: true, error: '' })
    try {
      const [user, postsRes] = await Promise.all([
        api.getUserProfileById(userId),
        api.getUserPosts(userId)
      ])
      const posts = Array.isArray(postsRes) ? postsRes : (postsRes && postsRes.list) ? postsRes.list : []
      this.setData({ user, posts, loading: false })
    } catch (e) {
      console.error('加载用户失败', e)
      this.setData({ loading: false, error: '加载失败，请重试' })
    }
  },

  async toggleFollow() {
    const { user, followLoading } = this.data
    if (!user || followLoading) return
    this.setData({ followLoading: true })
    const isFollowed = !user.is_followed
    try {
      await api.toggleFollowUser(user.id, isFollowed)
      this.setData({
        user: { ...user, is_followed: isFollowed, fans_count: (user.fans_count || 0) + (isFollowed ? 1 : -1) },
        followLoading: false
      })
      util.showToast(isFollowed ? '已关注' : '已取消关注', 'success')
    } catch (e) {
      this.setData({ followLoading: false })
      util.showToast('操作失败')
    }
  },

  goToPost(e) {
    const id = e.currentTarget.dataset.id
    if (id) wx.navigateTo({ url: `/packageCommunity/community-post/community-post?id=${id}` })
  },

  onPullDownRefresh() {
    this.loadUser().finally(() => wx.stopPullDownRefresh())
  },

  onFansTap() {
    const { user } = this.data
    if (!user) return
    wx.showToast({ title: '粉丝列表敬请期待', icon: 'none' })
  }
})
