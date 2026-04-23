// utils/animation.js - 统一动画工具函数

/**
 * 创建交错动画延迟
 * @param {number} index - 元素索引
 * @param {number} baseDelay - 基础延迟（秒）
 * @param {number} stepDelay - 每项延迟步长（秒）
 * @returns {string} 延迟时间字符串
 */
function getStaggerDelay(index, baseDelay = 0.05, stepDelay = 0.05) {
  return `${baseDelay + index * stepDelay}s`
}

/**
 * 页面进入动画类名
 */
const PAGE_ANIMATIONS = {
  fadeIn: 'pageFadeIn',
  slideIn: 'pageSlideIn',
  scaleIn: 'pageScaleIn'
}

/**
 * 列表项动画类名
 */
const LIST_ANIMATIONS = {
  slideInRight: 'listItemSlideIn',
  fadeInUp: 'listItemFadeInUp',
  scaleIn: 'listItemScaleIn'
}

/**
 * 卡片动画类名
 */
const CARD_ANIMATIONS = {
  fadeIn: 'cardFadeIn',
  slideInUp: 'cardSlideInUp'
}

module.exports = {
  getStaggerDelay,
  PAGE_ANIMATIONS,
  LIST_ANIMATIONS,
  CARD_ANIMATIONS
}
