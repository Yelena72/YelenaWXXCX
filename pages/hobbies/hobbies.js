// pages/hobbies/hobbies.js —— 兴趣爱好
// 第一次打开会把 data/content.js 里的 hobbies 搬进本地缓存，
// 之后在小程序里加 / 改 / 删就行。

const content = require('../../data/content.js')

const KEY = 'yelena_hobbies'

// 可选的图标
const ICONS = [
  'ico-music',
  'ico-book',
  'ico-game',
  'ico-cake',
  'ico-camera',
  'ico-pin',
  'ico-movie'
]

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('兴趣爱好')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    list: [],
    iconList: ICONS,

    editingId: '',
    formIcon: 'ico-music',
    formName: '',
    formDesc: '',
    focusField: '', // 进入修改状态时把光标放进名称输入框

    undoShow: false,
    undoText: ''
  },

  onLoad() {
    this.all = this.load()
    this.render()
  },

  load() {
    const saved = wx.getStorageSync(KEY)
    if (saved && saved.length) return saved

    const src = content.hobbies || []
    const list = []

    for (let i = 0; i < src.length; i++) {
      list.push({
        id: Date.now() + i,
        icon: src[i].icon || 'ico-music',
        name: src[i].name,
        desc: src[i].desc || ''
      })
    }

    wx.setStorageSync(KEY, list)
    return list
  },

  persist() {
    wx.setStorageSync(KEY, this.all)
  },

  render() {
    const list = []

    for (let i = 0; i < this.all.length; i++) {
      const h = this.all[i]
      let icon = h.icon
      if (ICONS.indexOf(icon) < 0) icon = ICONS[0]

      list.push({
        id: h.id,
        icon: icon,
        name: h.name,
        desc: h.desc
      })
    }

    this.setData({ list: list })
  },

  // ---------------- 表单 ----------------
  pickIcon(e) {
    this.setData({ formIcon: e.currentTarget.dataset.icon })
  },

  onName(e) {
    this.setData({ formName: e.detail.value })
  },

  onDesc(e) {
    this.setData({ formDesc: e.detail.value })
  },

  // 输入框失焦了，下次点卡片才能重新聚焦
  onBlur() {
    this.setData({ focusField: '' })
  },

  resetForm() {
    this.setData({
      editingId: '',
      formIcon: ICONS[0],
      formName: '',
      formDesc: '',
      focusField: ''
    })
  },

  save() {
    const name = String(this.data.formName).trim()

    if (!name) {
      wx.showToast({ title: '先写个兴趣名', icon: 'none' })
      return
    }

    const icon = this.data.formIcon
    const desc = String(this.data.formDesc).trim()

    if (this.data.editingId) {
      for (let i = 0; i < this.all.length; i++) {
        if (String(this.all[i].id) === String(this.data.editingId)) {
          this.all[i].icon = icon
          this.all[i].name = name
          this.all[i].desc = desc
        }
      }
    } else {
      this.all.push({
        id: Date.now(),
        icon: icon,
        name: name,
        desc: desc
      })
    }

    this.persist()
    this.resetForm()
    this.render()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  edit(e) {
    const id = e.currentTarget.dataset.id

    for (let i = 0; i < this.all.length; i++) {
      if (String(this.all[i].id) === String(id)) {
        this.setData({
          editingId: String(this.all[i].id),
          formIcon: this.all[i].icon,
          formName: this.all[i].name,
          formDesc: this.all[i].desc || '',
          focusField: 'name'
        })
      }
    }

    wx.pageScrollTo({ scrollTop: 99999, duration: 200 })
  },

  // 删除：删完给 5 秒撤销
  remove() {
    const id = this.data.editingId
    if (!id) return

    this.undoSnapshot = this.all.slice()

    this.all = this.all.filter(function (h) {
      return String(h.id) !== String(id)
    })

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除这个兴趣' })
  },

  onUndo() {
    if (this.undoSnapshot) {
      this.all = this.undoSnapshot
      this.undoSnapshot = null
      this.persist()
      this.render()
    }
    this.setData({ undoShow: false })
  },

  onUndoClose() {
    this.undoSnapshot = null
    this.setData({ undoShow: false })
  }
})
