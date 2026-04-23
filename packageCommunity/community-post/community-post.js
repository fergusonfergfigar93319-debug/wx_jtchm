// pages/community-post/community-post.js - 论坛式帖子详情与讨论
const api = require('../../utils/api.js')
const util = require('../../utils/util.js')

Page({
  data: {
    postId: null,
    post: null,
    comments: [],
    loading: true,
    error: '',
    replyText: '',
    focusReply: false,
    submitting: false
  },

  onLoad(options) {
    const id = options.id
    if (!id) {
      this.setData({ loading: false, error: '缺少帖子 ID' })
      return
    }
    this.setData({ postId: id })
    this.loadPost()
  },

  async loadPost() {
    const { postId } = this.data
    if (!postId) return

    this.setData({ loading: true, error: '' })
    try {
      const [post, comments] = await Promise.all([
        api.getCommunityFeedDetail(postId),
        api.getCommunityComments(postId)
      ])
      this.setData({
        post,
        comments: comments || [],
        loading: false
      })
    } catch (e) {
      console.error('加载帖子失败', e)
      this.setData({
        loading: false,
        error: '加载失败，请重试'
      })
    }
  },

  async toggleLike() {
    const { post } = this.data
    if (!post) return

    const isLiked = !post.is_liked
    const likeCount = (post.like_count || 0) + (isLiked ? 1 : -1)

    this.setData({
      post: {
        ...post,
        is_liked: isLiked,
        like_count: Math.max(0, likeCount)
      }
    })
    wx.vibrateShort()

    try {
      await api.toggleCommunityLike(post.id, isLiked)
    } catch (e) {
      this.setData({
        post: {
          ...post,
          is_liked: !isLiked,
          like_count: post.like_count || 0
        }
      })
      util.showToast('操作失败，请重试')
    }
  },

  goToRelated(e) {
    const post = e.currentTarget.dataset.post
    if (!post || !post.related_item) return
    if (post.type === 'recipe') {
      wx.navigateTo({
        url: `/packageCook/cook-detail/cook-detail?id=${post.related_item.id}`
      })
    } else if (post.type === 'restaurant') {
      wx.navigateTo({
        url: `/packageRestaurant/restaurant-detail/restaurant-detail?id=${post.related_item.id}`
      })
    }
  },

  goToUserProfile(e) {
    const userid = e.currentTarget.dataset.userid
    if (userid) wx.navigateTo({ url: `/packageCommunity/user-profile/user-profile?id=${userid}` })
  },

  onReplyInput(e) {
    this.setData({ replyText: e.detail.value })
  },

  async submitReply() {
    const { postId, replyText, comments, post } = this.data
    if (!replyText.trim() || !postId) return

    this.setData({ submitting: true })
    try {
      const newComment = await api.addCommunityComment(postId, replyText.trim())
      this.setData({
        comments: [...comments, newComment],
        replyText: '',
        submitting: false
      })
      if (post) {
        this.setData({
          post: {
            ...post,
            comment_count: (post.comment_count || 0) + 1
          }
        })
      }
      util.showToast('发送成功', 'success')
    } catch (e) {
      console.error('发送评论失败', e)
      util.showToast('发送失败，请重试')
      this.setData({ submitting: false })
    }
  },

  onPullDownRefresh() {
    this.loadPost().finally(() => wx.stopPullDownRefresh())
  },

  onShareAppMessage() {
    const { post } = this.data
    return {
      title: post ? `${post.user.nickname}的分享：${(post.content || '').slice(0, 20)}...` : '社区分享',
      path: `/packageCommunity/community-post/community-post?id=${this.data.postId}`,
      imageUrl: post && post.image ? post.image : ''
    }
  }
})
