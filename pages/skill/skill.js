// pages/skill/skill.js —— 单个技能的详情：在这里加小标题和每个小标题的描述
//
// 从「想学的技能」列表点某张卡片进来，比如「微信小程序」这张卡，
// 进来后就能往下加：
//   HTML     语义化标签、表单、表格
//   CSS      盒模型、flex、grid

const KEY = 'yelena_skills'

const kbd = require('../../utils/kbd.js')

const COLORS = ['#4FC3F7', '#6FD070', '#FF8FC7', '#FFB93C', '#B388FF', '#FF7A6B']

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('我想学的技能')

// 生成不重复的 id
let idSeq = 0
function newId() {
  idSeq = (idSeq + 1) % 1000
  return Date.now() * 1000 + idSeq
}

function clampPercent(v) {
  const n = Number(v) || 0
  return Math.max(0, Math.min(100, Math.round(n)))
}

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    ok: false,
    name: '',
    note: '',
    percent: 0,
    color: '#4FC3F7',

    subs: [],
    subCount: 0,

    editingId: '',
    formTitle: '',
    formDesc: '',
    focusField: '',

    // 弹窗
    editShow: false,
    kbH: 0,

    undoShow: false,
    undoSeq: 0,
    undoText: ''
  },

  onShow() {
    kbd.bind(this)
  },

  onHide() {
    kbd.unbind(this)
  },

  onUnload() {
    kbd.unbind(this)
  },

  noop() {},

  onLoad(options) {
    const id = String(options.id || '')
    this.all = wx.getStorageSync(KEY) || []

    let index = -1
    for (let i = 0; i < this.all.length; i++) {
      if (String(this.all[i].id) === id) index = i
    }

    if (index < 0) {
      wx.showToast({ title: '这个技能不见了', icon: 'none' })
      setTimeout(function () {
        wx.navigateBack()
      }, 900)
      return
    }

    this.index = index
    this.render()
  },

  render() {
    const s = this.all[this.index]
    if (!s) return

    const subs = s.subs || []
    const view = []

    for (let i = 0; i < subs.length; i++) {
      view.push({
        id: subs[i].id,
        title: subs[i].title,
        desc: subs[i].desc || ''
      })
    }

    this.setData({
      ok: true,
      name: s.name,
      note: s.note || '',
      percent: clampPercent(s.percent),
      color: COLORS[this.index % COLORS.length],
      subs: view,
      subCount: view.length
    })

    wx.setNavigationBarTitle({ title: s.name || '技能详情', fail() {} })
  },

  persist() {
    wx.setStorageSync(KEY, this.all)
  },

  // ---------------- 表单 ----------------
  addSub() {
    this.setData({
      editingId: '',
      formTitle: '',
      formDesc: '',
      focusField: '',
      editShow: true
    })
  },

  editSub(e) {
    const id = e.currentTarget.dataset.id

    const s = this.all[this.index]
    const subs = s.subs || []

    let target = null
    for (let i = 0; i < subs.length; i++) {
      if (String(subs[i].id) === String(id)) target = subs[i]
    }
    if (!target) return

    this.setData({
      editingId: target.id,
      formTitle: target.title,
      formDesc: target.desc || '',
      focusField: '',
      editShow: true
    })
  },

  // 弹窗上的「取消」/ 点空白处
  closeEdit() {
    this.setData({ editShow: false, kbH: 0 })
    this.resetForm()
  },

  onTitle(e) {
    this.setData({ formTitle: e.detail.value })
  },

  onDesc(e) {
    this.setData({ formDesc: e.detail.value })
  },

  onBlur() {
    this.setData({ focusField: '' })
  },

  resetForm() {
    this.setData({ editingId: '', formTitle: '', formDesc: '', focusField: '' })
  },

  cancelEdit() {
    this.resetForm()
  },

  save() {
    const title = String(this.data.formTitle).trim()

    if (!title) {
      wx.showToast({ title: '先写个小标题', icon: 'none' })
      return
    }

    const desc = String(this.data.formDesc).trim()
    const s = this.all[this.index]

    if (!s.subs) s.subs = []

    if (this.data.editingId) {
      for (let i = 0; i < s.subs.length; i++) {
        if (String(s.subs[i].id) === String(this.data.editingId)) {
          s.subs[i].title = title
          s.subs[i].desc = desc
        }
      }
    } else {
      s.subs.push({ id: newId(), title: title, desc: desc })
    }

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ editShow: false, kbH: 0 })

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  // ---------------- 删除小标题 ----------------
  removeSub(e) {
    const id = e.currentTarget.dataset.id
    const s = this.all[this.index]
    const subs = s.subs || []

    // 先存下「删之前」的样子，撤销才有东西可还原
    this.undoSnapshot = subs.slice()

    let target = null
    const keep = []

    for (let i = 0; i < subs.length; i++) {
      if (String(subs[i].id) === String(id)) {
        target = subs[i]
      } else {
        keep.push(subs[i])
      }
    }
    if (!target) return

    s.subs = keep

    this.persist()
    this.resetForm()
    this.render()
    this.setData({ editShow: false, kbH: 0 })

    this.setData({
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true,
      undoText: '已删除「' + target.title + '」'
    })
  },

  // 表单里的「删除」
  removeEditing() {
    const id = this.data.editingId
    if (!id) return
    this.removeSub({ currentTarget: { dataset: { id: id } } })
  },

  onUndo() {
    if (this.undoSnapshot) {
      this.all[this.index].subs = this.undoSnapshot
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
