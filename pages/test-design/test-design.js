// pages/test-design/test-design.js
Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 页面数据
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad(options) {
    console.log('设计系统测试页面加载');
    
    // 显示加载动画
    wx.showLoading({
      title: '加载中...',
      mask: true
    });
    
    // 模拟加载过程
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({
        title: '加载完成',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady() {
    console.log('设计系统测试页面渲染完成');
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow() {
    console.log('设计系统测试页面显示');
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide() {
    console.log('设计系统测试页面隐藏');
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload() {
    console.log('设计系统测试页面卸载');
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh() {
    console.log('用户下拉刷新');
    
    // 模拟刷新数据
    setTimeout(() => {
      wx.stopPullDownRefresh();
      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1500
      });
    }, 1000);
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom() {
    console.log('用户上拉触底');
    
    wx.showToast({
      title: '已加载所有内容',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage() {
    return {
      title: '设计系统测试 - 2025+现代设计规范',
      path: '/pages/test-design/test-design',
      imageUrl: '/images/share-design.png'
    };
  },

  /**
   * 自定义方法 - 测试按钮点击
   */
  onTestButtonTap(e) {
    const buttonType = e.currentTarget.dataset.type;
    console.log('测试按钮点击:', buttonType);
    
    // 显示反馈
    wx.showToast({
      title: `${buttonType}按钮点击`,
      icon: 'success',
      duration: 1000
    });
    
    // 添加点击动画效果
    const animation = wx.createAnimation({
      duration: 300,
      timingFunction: 'ease'
    });
    
    animation.scale(0.9).step();
    animation.scale(1).step();
    
    this.setData({
      buttonAnimation: animation.export()
    });
  },

  /**
   * 自定义方法 - 测试卡片点击
   */
  onTestCardTap(e) {
    const cardType = e.currentTarget.dataset.type;
    console.log('测试卡片点击:', cardType);
    
    // 显示模态框
    wx.showModal({
      title: '卡片点击',
      content: `您点击了${cardType}卡片`,
      showCancel: false,
      confirmText: '确定',
      confirmColor: '#34D399'
    });
  },

  /**
   * 自定义方法 - 测试标签点击
   */
  onTestTagTap(e) {
    const tagType = e.currentTarget.dataset.type;
    console.log('测试标签点击:', tagType);
    
    // 显示轻提示
    wx.showToast({
      title: `${tagType}标签`,
      icon: 'none',
      duration: 1000
    });
  },

  /**
   * 自定义方法 - 返回首页
   */
  onBackToHome() {
    wx.switchTab({
      url: '/pages/index/index'
    });
  }
});
