/**
 * 本地 / 开发环境 API 根地址
 *
 * net::ERR_CONNECTION_REFUSED：8000 端口没有进程在监听 → 先在项目后端目录启动服务，例如：
 *   python manage.py runserver 0.0.0.0:8000
 * （仅本机模拟器可用 127.0.0.1；0.0.0.0 才允许同一局域网真机访问。）
 *
 * 真机连「远端服务器端口」（SSH 穿透或已部署的后端）：
 *   - 与 start_tunnel.bat 一致时：本机 runserver:8000 + 穿透，公网多为 47.93.45.198:8081。
 *   - 修改下方 REMOTE_HOST / REMOTE_PORT / REMOTE_USE_HTTPS 即可对接你的服务器端口。
 *   - USE_REMOTE_ON_DEVICE 为 true：真机/预览走远端；为 false 则走局域网 LAN_HOST:LAN_PORT。
 *
 * 开发者工具内固定走 127.0.0.1:8000（见 DEVTOOLS_LOCAL_*），勿把模拟器指到公网穿透，否则易 ERR_EMPTY_RESPONSE。
 *
 * 也可不改代码，在开发者工具控制台执行一次：
 * wx.setStorageSync('apiBaseUrlOverride', 'http://192.168.1.100:8000/api/v1')
 * （会优先于穿透/局域网默认逻辑）
 */
const API_PREFIX = '/api/v1'

/** 仅用于微信开发者工具：直连本机 Django（runserver 默认 8000），勿改为公网 IP */
const DEVTOOLS_LOCAL_HOST = '192.168.170.105'
const DEVTOOLS_LOCAL_PORT = 8000

/** 真机局域网直连本机时：改为后端电脑 ipconfig 的 IPv4，端口与 runserver 一致 */
const LAN_HOST = '192.168.170.105'
const LAN_PORT = 8000

/** 真机/预览要连接的服务器主机（云服务器 IP 或域名） */
const REMOTE_HOST = '47.93.45.198'
/** 服务器上对外开放的端口（如 SSH 穿透 8081、Nginx 80/443、后端直连 8000） */
const REMOTE_PORT = 8081
/** 是否使用 https（上线、已配证书时多为 true） */
const REMOTE_USE_HTTPS = false

/**
 * 为 true：非开发者工具环境走 REMOTE_HOST:REMOTE_PORT。
 * 为 false：真机走局域网 http://LAN_HOST:LAN_PORT。
 */
const USE_REMOTE_ON_DEVICE = false

/**
 * 为 true 时：在微信开发者工具（platform === 'devtools'）内固定使用本机 API，
 * 忽略 Storage 里的 apiBaseUrlOverride，避免真机联调残留地址导致模拟器连不上电脑。
 * 若需在工具内也指向其它环境，可临时改为 false。
 */
const DEVTOOLS_FORCE_LOCAL_API = true

const { isWeChatDevToolsPlatform } = require('./platform.js')

function normalizeBase(url) {
  return String(url || '').replace(/\/$/, '')
}

function isWeChatDevTools() {
  return isWeChatDevToolsPlatform()
}

function getApiBaseUrl() {
  if (DEVTOOLS_FORCE_LOCAL_API && isWeChatDevTools()) {
    return normalizeBase(`http://${DEVTOOLS_LOCAL_HOST}:${DEVTOOLS_LOCAL_PORT}${API_PREFIX}`)
  }
  try {
    const override = wx.getStorageSync('apiBaseUrlOverride')
    if (override && typeof override === 'string' && /^https?:\/\//i.test(override)) {
      return normalizeBase(override)
    }
  } catch (e) {
    // ignore
  }
  if (USE_REMOTE_ON_DEVICE) {
    const scheme = REMOTE_USE_HTTPS ? 'https' : 'http'
    return normalizeBase(`${scheme}://${REMOTE_HOST}:${REMOTE_PORT}${API_PREFIX}`)
  }
  return normalizeBase(`http://${LAN_HOST}:${LAN_PORT}${API_PREFIX}`)
}

/** 本地开发地址请求失败时，控制台只提示一次（含 request:fail / 连接被拒） */
let _warnedDevBackendOnce = false
function warnApiConnectionFailure(err) {
  try {
    const base = getApiBaseUrl()
    const isLocalDev =
      /127\.0\.0\.1|localhost/i.test(base) ||
      /^http:\/\/192\.168\.\d+\.\d+/.test(base) ||
      new RegExp(
        '^https?://' + REMOTE_HOST.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      ).test(base)
    if (!isLocalDev) return
    const msg = (err && err.errMsg) || ''
    const looksUnreachable =
      msg.includes('CONNECTION_REFUSED') ||
      msg.includes('connection refused') ||
      msg.includes('request:fail')
    if (!looksUnreachable) return
    if (_warnedDevBackendOnce) return
    _warnedDevBackendOnce = true
    console.warn(
      '[API] 无法访问后端（当前：' +
        base +
        '）。请确认本机已 python manage.py runserver 0.0.0.0:8000；模拟器须能访问 127.0.0.1:8000。真机连远端请检查 REMOTE_* 与隧道；局域网请设 USE_REMOTE_ON_DEVICE=false 并改 LAN_HOST，或 apiBaseUrlOverride'
    )
  } catch (e) {
    // ignore
  }
}

/**
 * 登录页「开发者通道」开关：仅用于开发者工具 / 真机联调 UI。
 * 正式提审、上线前务必改为 false。
 */
const ENABLE_DEV_CHANNEL_LOGIN = true

/** 本地占位 token，后端一般不会校验通过；用于跳过微信登录浏览界面 */
const DEV_CHANNEL_TOKEN = '__DEV_CHANNEL__'

function isDevChannelToken(token) {
  return token === DEV_CHANNEL_TOKEN
}

module.exports = {
  getApiBaseUrl,
  warnApiConnectionFailure,
  ENABLE_DEV_CHANNEL_LOGIN,
  DEV_CHANNEL_TOKEN,
  isDevChannelToken,
  REMOTE_HOST,
  REMOTE_PORT,
  REMOTE_USE_HTTPS,
  USE_REMOTE_ON_DEVICE
}
