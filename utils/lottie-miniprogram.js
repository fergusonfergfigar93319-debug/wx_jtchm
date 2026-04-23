// utils/lottie-miniprogram.js
// 轻量封装：兼容 ESM / CJS 两种导出方式

const raw = require('lottie-miniprogram')
const lottie = raw && raw.default ? raw.default : raw

module.exports = lottie

