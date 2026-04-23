/**
 * 移除 Lottie JSON 中 AE 表达式字段 "x":"var $bm_rt..."，避免小程序环境 eval 不可用。
 */
const fs = require('fs')
const path = require('path')

const target = path.join(__dirname, '..', 'assets', 'personal.js')
let s = fs.readFileSync(target, 'utf8')
const beforeLen = s.length
// 匹配 ,"x":"var $bm_rt... 直到闭合引号（内容内无未转义双引号）
s = s.replace(/,"x":"var \$bm_rt(?:\\.|[^"\\])*"/g, '')
fs.writeFileSync(target, s)
console.log('strip-lottie-expressions: removed', beforeLen - s.length, 'bytes from', target)
