// pages/index/index.js —— 首页
// 作用：显示头像、昵称、一句话签名，以及功能入口
// 昵称和签名来自 data/profile.js（在「关于我」页改过就用改过的）

const profileApi = require('../../data/profile.js')

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('个人主页')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    profile: {},

    // 8 个入口
    // icon   = styles/icons.wxss 里画好的像素图标
    // accent = 卡片阴影的颜色，可选：sea sun flower grass mountain sky berry gold
    // type   = 'tab' 表示在底部 tabBar 里，要用 switchTab 跳；'nav' 用 navigateTo
    entries: [
      { icon: 'ico-about', accent: 'sky', text: '关于我', path: '/pages/about/about', type: 'tab' },
      { icon: 'ico-exp', accent: 'sun', text: '个人经历', path: '/pages/experience/experience', type: 'nav' },
      { icon: 'ico-hobby', accent: 'flower', text: '兴趣爱好', path: '/pages/hobbies/hobbies', type: 'nav' },
      { icon: 'ico-skill', accent: 'grass', text: '想学技能', path: '/pages/skills/skills', type: 'nav' },
      { icon: 'ico-social', accent: 'sea', text: '人际交往', path: '/pages/social/social', type: 'nav' },
      { icon: 'ico-future', accent: 'mountain', text: '未来展望', path: '/pages/future/future', type: 'nav' },
      { icon: 'ico-wealth', accent: 'gold', text: '财富', path: '/pages/wealth/wealth', type: 'tab' },
      { icon: 'ico-todo', accent: 'berry', text: '待办事项', path: '/pages/todo/todo', type: 'tab' }
    ]
  },

  // 从「关于我」改完资料回来，首页立刻同步（标题栏也跟着改）
  onShow() {
    const profile = profileApi.getProfile()

    this.setData({ profile: profile })

    const name = String(profile.name || '').trim() || 'Yelena'
    wx.setNavigationBarTitle({
      title: name,
      fail() {
        // 万一设置失败（比如页面还没准备好），保持 json 里的默认标题就行
      }
    })
  },

  go(e) {
    const path = e.currentTarget.dataset.path
    const type = e.currentTarget.dataset.type

    function fail() {
      wx.showToast({ title: '页面打不开，请重新编译', icon: 'none' })
    }

    if (type === 'tab') {
      wx.switchTab({ url: path, fail: fail })
    } else {
      wx.navigateTo({ url: path, fail: fail })
    }
  }
})
