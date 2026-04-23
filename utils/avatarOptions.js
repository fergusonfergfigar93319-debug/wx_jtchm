// 预设头像列表（卡通风格）- 小程序用
const AVATAR_OPTIONS = [
  { id: '1', url: '/packageUser/images/avatar-1.png', label: '头像1' },
  { id: '2', url: '/packageUser/images/avatar-2.png', label: '头像2' },
  { id: '3', url: '/packageUser/images/avatar-3.png', label: '头像3' },
  { id: '4', url: '/packageUser/images/avatar-4.png', label: '头像4' },
  { id: '5', url: '/packageUser/images/avatar-5.png', label: '头像5' },
  { id: '6', url: '/packageUser/images/avatar-6.png', label: '头像6' }
]

module.exports = {
  AVATAR_OPTIONS,
  DEFAULT_AVATAR: AVATAR_OPTIONS[0].url
}
