// pages/skills/skills.js —— 想学的技能
// 第一次打开会把 data/content.js 里的 skills 搬进本地缓存，
// 之后在小程序里加 / 改 / 删就行。

const content = require('../../data/content.js')

const KEY = 'yelena_skills'

const COLORS = ['#4FC3F7', '#6FD070', '#FF8FC7', '#FFB93C', '#B388FF', '#FF7A6B']

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('想学的技能')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    list: [],
    avg: 0,

    editingId: '',
    formName: '',
    formPercent: 40,
    formNote: '',
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

    const src = content.skills || []
    const list = []

    for (let i = 0; i < src.length; i++) {
      list.push({
        id: Date.now() + i,
        name: src[i].name,
        percent: Number(src[i].percent) || 0,
        note: src[i].note || ''
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
    let sum = 0

    for (let i = 0; i < this.all.length; i++) {
      const s = this.all[i]
      const p = Math.max(0, Math.min(100, Number(s.percent) || 0))
      sum += p

      list.push({
        id: s.id,
        name: s.name,
        note: s.note,
        percent: p,
        color: COLORS[i % COLORS.length]
      })
    }

    this.setData({
      list: list,
      avg: list.length ? Math.round(sum / list.length) : 0
    })
  },

  // ---------------- 表单 ----------------
  onName(e) {
    this.setData({ formName: e.detail.value })
  },

  onPercent(e) {
    this.setData({ formPercent: e.detail.value })
  },

  onNote(e) {
    this.setData({ formNote: e.detail.value })
  },

  // 输入框失焦了，下次点「修改」才能重新聚焦
  onBlur() {
    this.setData({ focusField: '' })
  },

  resetForm() {
    this.setData({
      editingId: '',
      formName: '',
      formPercent: 40,
      formNote: '',
      focusField: ''
    })
  },

  cancelEdit() {
    this.resetForm()
  },

  save() {
    const name = String(this.data.formName).trim()

    if (!name) {
      wx.showToast({ title: '先写个技能名', icon: 'none' })
      return
    }

    const percent = Number(this.data.formPercent) || 0
    const note = String(this.data.formNote).trim()

    if (this.data.editingId) {
      for (let i = 0; i < this.all.length; i++) {
        if (String(this.all[i].id) === String(this.data.editingId)) {
          this.all[i].name = name
          this.all[i].percent = percent
          this.all[i].note = note
        }
      }
    } else {
      this.all.push({
        id: Date.now(),
        name: name,
        percent: percent,
        note: note
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
          formName: this.all[i].name,
          formPercent: Number(this.all[i].percent) || 0,
          formNote: this.all[i].note || '',
          focusField: 'name'
        })
      }
    }

    wx.pageScrollTo({ scrollTop: 99999, duration: 200 })
  },

  // 删除：删完给 5 秒撤销
  remove(e) {
    const id = e.currentTarget.dataset.id

    this.undoSnapshot = this.all.slice()

    this.all = this.all.filter(function (s) {
      return String(s.id) !== String(id)
    })

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除这个技能' })
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
