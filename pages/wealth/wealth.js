// pages/wealth/wealth.js —— 财富：各账户余额 + 总额
// ⚠️ 金额只保存在本机缓存（wx.setStorageSync），不上传服务器
// 换手机 / 删除小程序，数据会消失

const KEY = 'yelena_wealth'
const HIDDEN_KEY = 'yelena_wealth_hidden' // 记住「隐藏金额」这个开关

const kbd = require('../../utils/kbd.js')

// 轻微震动反馈（真机上才有感觉）
function buzz() {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type: 'light' })
  }
}

// 三种账户类型，颜色和文字都在这
// 统一用暖色系（金 / 珊瑚 / 玫瑰红），和整页的红色调协调
const TYPES = {
  bank: { text: '银行卡', color: '#F2A03D' },
  wechat: { text: '微信', color: '#FF8A7A' },
  alipay: { text: '支付宝', color: '#D9536B' },
  other: { text: '其他', color: '#9B8AC4' }
}

// 12345.6 -> "12,345.60"
function money(n) {
  const v = Number(n) || 0
  const parts = v.toFixed(2).split('.')
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return parts.join('.')
}

// 第一次打开时给几个空账户，方便照着填
function defaultAccounts() {
  return [
    { id: 1, type: 'bank', name: '银行卡', amount: 0 },
    { id: 2, type: 'wechat', name: '微信钱包', amount: 0 },
    { id: 3, type: 'alipay', name: '支付宝', amount: 0 }
  ]
}

Page({
  data: {
    accounts: [],
    totalText: '0.00',
    hidden: false,
    editingId: '',
    formType: 'bank',
    formName: '',
    formAmount: '',
    focusField: '', // 进入修改状态时把光标放进名称输入框

    // 修改弹窗
    editShow: false,
    kbH: 0,

    undoShow: false,
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

  // 弹窗上的「取消」/ 点空白处
  closeEdit() {
    this.setData({ editShow: false, kbH: 0 })
    this.resetForm()
  },

  onLoad() {
    const stored = wx.getStorageSync(KEY)
    if (stored && stored.length) {
      this.render(stored)
    } else {
      const seed = defaultAccounts()
      wx.setStorageSync(KEY, seed)
      this.render(seed)
    }

    // 上次是隐藏着的，这次进来也保持隐藏
    this.setData({ hidden: wx.getStorageSync(HIDDEN_KEY) === true })
  },

  // 把原始数据加工成页面要显示的样子（金额文本、占比、颜色）
  render(list) {
    let total = 0
    for (let i = 0; i < list.length; i++) {
      total += Number(list[i].amount) || 0
    }

    const accounts = list.map(function (a) {
      const t = TYPES[a.type] || TYPES.bank
      const amt = Number(a.amount) || 0
      return {
        id: a.id,
        name: a.name,
        amountText: money(amt),
        typeText: t.text,
        colorHex: t.color,
        percent: total > 0 ? Math.max(0, Math.min(100, Math.round((amt / total) * 100))) : 0
      }
    })

    this.setData({ accounts: accounts, totalText: money(total) })
  },

  // 显示 / 隐藏金额（记住选择，下次进来还是这个状态）
  toggleHide() {
    const hidden = !this.data.hidden
    this.setData({ hidden: hidden })
    wx.setStorageSync(HIDDEN_KEY, hidden)
  },

  // ---- 表单 ----
  pickType(e) {
    this.setData({ formType: e.currentTarget.dataset.type })
  },

  onName(e) {
    this.setData({ formName: e.detail.value })
  },

  onAmount(e) {
    this.setData({ formAmount: e.detail.value })
  },

  // 输入框失焦了，下次点「修改」才能重新聚焦
  onBlur() {
    this.setData({ focusField: '' })
  },

  resetForm() {
    this.originAmount = 0
    this.setData({
      editingId: '',
      formType: 'bank',
      formName: '',
      formAmount: '',
      focusField: ''
    })
  },

  cancelEdit() {
    this.resetForm()
  },

  // 保存（新增或修改）
  save() {
    const name = String(this.data.formName).trim()
    const raw = String(this.data.formAmount).trim()

    if (!name) {
      wx.showToast({ title: '给账户起个名字', icon: 'none' })
      return
    }

    // 金额空着就当 0；修改已有账户时保持原金额不变
    let amount = 0

    if (raw === '') {
      amount = this.data.editingId ? (this.originAmount || 0) : 0
    } else {
      amount = Math.round(Number(raw) * 100) / 100

      if (isNaN(amount)) {
        wx.showToast({ title: '金额要填数字', icon: 'none' })
        return
      }
      if (amount < 0) {
        wx.showToast({ title: '金额不能是负数', icon: 'none' })
        return
      }
      if (amount > 999999999) {
        wx.showToast({ title: '这个数字太大了', icon: 'none' })
        return
      }
    }

    const list = wx.getStorageSync(KEY) || []
    const editingId = this.data.editingId

    if (editingId) {
      for (let i = 0; i < list.length; i++) {
        if (String(list[i].id) === String(editingId)) {
          list[i].name = name
          list[i].type = this.data.formType
          list[i].amount = amount
        }
      }
    } else {
      list.push({
        id: Date.now(),
        type: this.data.formType,
        name: name,
        amount: amount
      })
    }

    wx.setStorageSync(KEY, list)
    this.resetForm()
    this.render(list)
    this.setData({ editShow: false, kbH: 0 })
    buzz()
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  // 点「修改」：把这一条填回表单
  edit(e) {
    const id = e.currentTarget.dataset.id
    const list = wx.getStorageSync(KEY) || []
    let target = null

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        target = list[i]
      }
    }
    if (!target) return

    // 记住原来的金额：表单里金额留空时保持它不变
    this.originAmount = Number(target.amount) || 0

    this.setData({
      editingId: String(target.id),
      formType: target.type,
      formName: target.name,
      // 金额是 0 就不预填了，让输入框显示 placeholder，省得手动删那个 0
      formAmount: Number(target.amount) ? String(target.amount) : '',
      // 改账户十有八九是改余额，光标直接落在金额上
      focusField: 'amount',
      editShow: true
    })
  },

  // 删除
  // 删除：删完给 5 秒撤销
  remove(e) {
    const id = e.currentTarget.dataset.id
    const list = wx.getStorageSync(KEY) || []

    let target = null
    const keep = []

    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === String(id)) {
        target = list[i]
      } else {
        keep.push(list[i])
      }
    }
    if (!target) return

    this.undoSnapshot = list

    wx.setStorageSync(KEY, keep)

    if (String(this.data.editingId) === String(id)) {
      this.resetForm()
    }
    this.render(keep)
    this.setData({ undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除「' + target.name + '」' })
  },

  onUndo() {
    if (this.undoSnapshot) {
      wx.setStorageSync(KEY, this.undoSnapshot)
      this.render(this.undoSnapshot)
      this.undoSnapshot = null
    }
    this.setData({ undoShow: false })
  },

  onUndoClose() {
    this.undoSnapshot = null
    this.setData({ undoShow: false })
  }
})
