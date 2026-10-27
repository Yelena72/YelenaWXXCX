// pages/about/about.js —— 关于我
// 资料优先读小程序里改过的（本机缓存），没改过就用 data/content.js 的默认值。

const profileApi = require('../../data/profile.js')

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('关于我')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    profile: {},
    tags: [],
    stats: [],
    intro: '',
    rows: [],

    // ---- 编辑弹窗 ----
    showForm: false,
    formFocus: false,
    form: {
      name: '',
      signature: '',
      tagsText: '',
      city: '',
      identity: '',
      mbti: '',
      status: '',
      intro: ''
    },
    formStats: []
  },

  // 每次显示都重读一遍，从别处改完回来能立刻看到
  onShow() {
    this.refresh()
  },

  refresh() {
    const p = profileApi.getProfile()
    const stats = profileApi.getStats()

    this.setData({
      profile: p,
      tags: p.tags || [],
      stats: stats,
      intro: p.intro || '',
      rows: [
        { label: '昵称', value: p.name || '' },
        { label: '城市', value: p.city || '' },
        { label: '身份', value: p.identity || '' },
        { label: 'MBTI', value: p.mbti || '' },
        { label: '状态', value: p.status || '' }
      ]
    })
  },

  // ---------------- 编辑弹窗 ----------------
  openForm() {
    const that = this
    const p = profileApi.getProfile()
    const stats = profileApi.getStats()

    const formStats = []
    for (let i = 0; i < stats.length; i++) {
      formStats.push({
        name: stats[i].name,
        value: Number(stats[i].value) || 0,
        color: stats[i].color || '#4FC3F7'
      })
    }

    this.setData({
      showForm: true,
      formFocus: false,
      form: {
        name: p.name || '',
        signature: p.signature || '',
        tagsText: (p.tags || []).join(' '),
        city: p.city || '',
        identity: p.identity || '',
        mbti: p.mbti || '',
        status: p.status || '',
        intro: p.intro || ''
      },
      formStats: formStats
    })

    // 等这层渲染完再置 true，不然 iOS 上键盘弹不出来
    setTimeout(function () {
      that.setData({ formFocus: true })
    }, 120)
  },

  closeForm() {
    this.setData({ showForm: false, formFocus: false })
  },

  noop() {},

  onBlur() {
    this.setData({ formFocus: false })
  },

  // 所有文字输入框共用这一个（靠 data-key 区分字段）
  onField(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ ['form.' + key]: e.detail.value })
  },

  // 属性条的滑块
  onStat(e) {
    const i = Number(e.currentTarget.dataset.index)
    this.setData({ ['formStats[' + i + '].value']: e.detail.value })
  },

  save() {
    const f = this.data.form
    const name = String(f.name || '').trim()

    if (!name) {
      wx.showToast({ title: '昵称别空着', icon: 'none' })
      return
    }

    // 标签：空格、逗号、顿号都能分隔，最多留 4 个
    const tags = String(f.tagsText || '')
      .replace(/[,，、]/g, ' ')
      .split(/\s+/)
      .filter(function (t) {
        return !!t
      })
      .slice(0, 4)

    profileApi.saveProfile({
      name: name,
      signature: String(f.signature || '').trim(),
      tags: tags,
      city: String(f.city || '').trim(),
      identity: String(f.identity || '').trim(),
      mbti: String(f.mbti || '').trim(),
      status: String(f.status || '').trim(),
      intro: String(f.intro || '').trim()
    })

    const stats = []
    for (let i = 0; i < this.data.formStats.length; i++) {
      const s = this.data.formStats[i]
      stats.push({
        name: s.name,
        value: Math.max(0, Math.min(100, Number(s.value) || 0)),
        color: s.color
      })
    }
    profileApi.saveStats(stats)

    this.setData({ showForm: false, formFocus: false })
    this.refresh()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  }
})
