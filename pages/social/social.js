// pages/social/social.js —— 人际交往 + 朋友圈关系图

const socialApi = require('../../data/social.js')

const KEY = 'yelena_boards'
const OLD_KEY = 'yelena_friends'
const CATS_KEY = 'yelena_cats'   // 自己加的分类存在这里
const VIEW_KEY = 'yelena_view'   // 上次缩放 / 平移到了哪里

// 四个内置分类，删不掉
const BASE_CATS = [
  { key: 'friend', name: '朋友', color: '#4FC3F7' },
  { key: 'classmate', name: '同学', color: '#6FD070' },
  { key: 'family', name: '家人', color: '#FF8FC7' },
  { key: 'work', name: '同事', color: '#FFB93C' }
]

// 世界（画布）内部尺寸，单位 rpx
const TILE_W = 120
const TILE_H = 132
const WORLD_W = 660
const WORLD_H = 540

// 画布视口高度（rpx）
const STAGE_H = 580

// 缩放范围
const SCALE_MIN = 0.5
const SCALE_MAX = 2.5

// 弹窗里能输入的最大字数（和实际存下来的长度一致，不会偷偷截断）
const CAT_MAX = 6
const BOARD_MAX = 12
const EDGE_MAX = 16

function clamp(v, min, max) {
  if (v < min) return min
  if (v > max) return max
  return v
}

// ---- 颜色工具：保证每个分类的颜色都不重复 ----

// "#4FC3F7" -> 色相 0-360
function hueOf(hex) {
  const h = String(hex).replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const d = max - min
  if (d === 0) return 0

  let hue
  if (max === r) hue = ((g - b) / d) % 6
  else if (max === g) hue = (b - r) / d + 2
  else hue = (r - g) / d + 4

  hue = hue * 60
  if (hue < 0) hue += 360
  return hue
}

function hslToHex(h, s, l) {
  const c = (1 - Math.abs(2 * l - 1)) * s
  const hp = h / 60
  const x = c * (1 - Math.abs((hp % 2) - 1))

  let r = 0
  let g = 0
  let b = 0
  if (hp < 1) { r = c; g = x } else if (hp < 2) { r = x; g = c } else if (hp < 3) { g = c; b = x } else if (hp < 4) { g = x; b = c } else if (hp < 5) { r = x; b = c } else { r = c; b = x }

  const m = l - c / 2
  function two(v) {
    const n = Math.round((v + m) * 255)
    const s2 = n.toString(16)
    return s2.length === 1 ? '0' + s2 : s2
  }
  return '#' + two(r) + two(g) + two(b)
}

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('人际交往')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    social: {},
    cats: BASE_CATS,

    mode: 'view', // view 浏览 / edit 编辑 / link 连线
    current: 0,
    dotList: [0],
    boardName: '',

    friends: [],
    edgesGeo: [],
    labelsGeo: [],
    picked: [],

    newName: '',
    newCat: 'friend',

    // 弹窗输入框（自定义分类 / 写关系 / 画布改名）
    prompt: {
      show: false,
      focus: false,
      title: '',
      placeholder: '',
      value: '',
      key: '',
      max: 20
    },

    // 编辑「性格标签 / 交友偏好 / 想认识这样的你 / 联系方式」
    showTextForm: false,
    textForm: {
      tagsText: '',
      prefer: '',
      want: '',
      contact: ''
    },

    // 编辑某个人（改名 / 换分类）
    friendForm: {
      show: false,
      focus: false,
      id: '',
      name: '',
      category: 'friend'
    },

    // 画布视图
    stageH: STAGE_H,
    worldW: WORLD_W,
    worldH: WORLD_H,
    scale: 1,
    panX: 0,
    panY: 0,
    zoomText: '100%',

    undoShow: false,
    undoText: ''
  },

  onLoad() {
    const sys = wx.getSystemInfoSync()
    this.k = sys.windowWidth / 750 // rpx -> px
    this.rect = null
    this.card = null
    this.pinch = null

    this.loadCats()
    this.boards = this.loadBoards()

    this.setData({ cats: this.allCats(), social: socialApi.getSocial() })
    this.render()
  },

  // 每次显示都重读文案，改完回来能看到
  onShow() {
    this.pinch = null
    this.pan = null
    this.card = null
    this.setData({ social: socialApi.getSocial() })
  },

  onReady() {
    // 等布局好了再量画布尺寸，然后恢复上次的缩放（没有就铺满）
    const that = this
    setTimeout(function () {
      that.measure(function () {
        that.restoreView()
      })
    }, 80)
  },

  // 上次看的位置还在，就接着用；没有就缩放到刚好放得下
  restoreView() {
    const saved = wx.getStorageSync(VIEW_KEY)

    if (saved && saved.scale) {
      this.applyView(saved.scale, saved.panX || 0, saved.panY || 0)
    } else {
      this.fitView()
    }
  },

  saveView() {
    const view = {
      scale: this.data.scale,
      panX: this.data.panX,
      panY: this.data.panY
    }

    // 没变就别写了，滚页面的时候每次抬手都写一遍太浪费
    const last = this.lastView
    if (last && last.scale === view.scale && last.panX === view.panX && last.panY === view.panY) {
      return
    }

    this.lastView = view
    wx.setStorageSync(VIEW_KEY, view)
  },

  // ---------------- 画布尺寸 / 缩放 ----------------
  measure(cb) {
    const that = this
    wx.createSelectorQuery()
      .select('#stage')
      .boundingClientRect(function (r) {
        if (r && r.width) that.rect = r
        if (cb) cb()
      })
      .exec()
  },

  // 缩放到整块画布刚好放得下，并居中
  fitView() {
    if (!this.rect) return

    const wpx = WORLD_W * this.k
    const hpx = WORLD_H * this.k
    let s = Math.min(this.rect.width / wpx, this.rect.height / hpx)
    s = clamp(s, SCALE_MIN, 1)

    this.applyView(s, (this.rect.width - wpx * s) / 2, (this.rect.height - hpx * s) / 2)
  },

  // 别让画布被拖到看不见的地方
  clampPan(x, y, s) {
    if (!this.rect) return { x: x, y: y }

    const sw = this.rect.width
    const sh = this.rect.height
    const ww = WORLD_W * this.k * s
    const wh = WORLD_H * this.k * s

    // 至少留 90px 露在外面
    const keepX = Math.min(90, ww)
    const keepY = Math.min(90, wh)

    const minX = keepX - ww
    const maxX = sw - keepX
    const minY = keepY - wh
    const maxY = sh - keepY

    return {
      x: minX <= maxX ? clamp(x, minX, maxX) : (sw - ww) / 2,
      y: minY <= maxY ? clamp(y, minY, maxY) : (sh - wh) / 2
    }
  },

  applyView(s, panX, panY) {
    s = clamp(s, SCALE_MIN, SCALE_MAX)
    const p = this.clampPan(panX, panY, s)

    this.setData({
      scale: Math.round(s * 1000) / 1000,
      panX: Math.round(p.x),
      panY: Math.round(p.y),
      zoomText: Math.round(s * 100) + '%'
    })
  },

  // 按倍率缩放（以画布中心为锚点）
  zoomBy(f) {
    const s = clamp(this.data.scale * f, SCALE_MIN, SCALE_MAX)
    const cx = this.rect ? this.rect.width / 2 : 0
    const cy = this.rect ? this.rect.height / 2 : 0
    const r = s / this.data.scale

    this.applyView(s, cx - (cx - this.data.panX) * r, cy - (cy - this.data.panY) * r)
  },

  zoomIn() {
    this.zoomBy(1.3)
    this.saveView()
  },

  zoomOut() {
    this.zoomBy(1 / 1.3)
    this.saveView()
  },

  // 复位：重新量一次尺寸再铺满
  resetView() {
    const that = this
    this.measure(function () {
      that.fitView()
      that.saveView()
    })
  },


  // ---------------- 手势 ----------------
  distOf(t1, t2) {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt(dx * dx + dy * dy)
  },

  midOf(ts) {
    const a = ts[0]
    const b = ts[ts.length - 1]
    return { x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 }
  },

  // 两指开始缩放：记下起点，之后按比例算
  beginPinch(ts) {
    if (ts.length < 2) return

    const m = this.midOf(ts)
    const left = this.rect ? this.rect.left : 0
    const top = this.rect ? this.rect.top : 0

    this.pinch = {
      d0: this.distOf(ts[0], ts[1]) || 1,
      s0: this.data.scale,
      panX0: this.data.panX,
      panY0: this.data.panY,
      mx0: m.x - left,
      my0: m.y - top
    }
    this.card = null
  },

  // 画布空白处：单指拖动挪画布，双指缩放
  onStageStart(e) {
    const ts = e.touches || []
    if (!ts.length) return

    this.measure()

    if (ts.length >= 2) {
      this.beginPinch(ts)
      return
    }

    const t = ts[0]
    this.pinch = null
    this.pan = {
      x: t.clientX,
      y: t.clientY,
      panX: this.data.panX,
      panY: this.data.panY
    }
  },

  onStageMove(e) {
    const ts = e.touches || []

    // ---- 双指缩放 ----
    if (ts.length >= 2) {
      if (!this.pinch) {
        this.beginPinch(ts)
        return
      }

      const d = this.distOf(ts[0], ts[1])
      let s = this.pinch.s0 * (d / this.pinch.d0)
      s = clamp(s, SCALE_MIN, SCALE_MAX)

      const m = this.midOf(ts)
      const left = this.rect ? this.rect.left : 0
      const top = this.rect ? this.rect.top : 0
      const r = s / this.pinch.s0

      // 让手指中间那个点缩放前后待在原地（顺便跟着手指平移）
      this.applyView(
        s,
        (m.x - left) - (this.pinch.mx0 - this.pinch.panX0) * r,
        (m.y - top) - (this.pinch.my0 - this.pinch.panY0) * r
      )
      return
    }

    // ---- 从双指回到单指：丢掉起点，免得画布跳一下 ----
    if (this.pinch) {
      this.pinch = null
      this.pan = null
      return
    }

    // ---- 单指：拖动画布 ----
    if (!this.pan) return

    const t = ts[0]
    this.applyView(
      this.data.scale,
      this.pan.panX + (t.clientX - this.pan.x),
      this.pan.panY + (t.clientY - this.pan.y)
    )
  },

  onStageEnd() {
    this.pinch = null
    this.pan = null
    this.saveView()
  },

  // ---------------- 名片上的手势（名片自己吃掉，页面不会跟着滚） ----------------
  onCardStart(e) {
    const id = e.currentTarget.dataset.fid
    const t = (e.touches || [])[0]
    if (!t) return

    let index = -1
    for (let i = 0; i < this.friends.length; i++) {
      if (String(this.friends[i].id) === String(id)) index = i
    }
    if (index < 0) return

    this.card = {
      id: id,
      index: index,
      x: t.clientX,
      y: t.clientY,
      startX: this.friends[index].x,
      startY: this.friends[index].y,
      moved: false
    }
  },

  onCardMove(e) {
    const c = this.card
    if (!c) return

    const t = (e.touches || [])[0]
    if (!t) return

    const dx = t.clientX - c.x
    const dy = t.clientY - c.y

    // 动了超过 6px 就不算点击了
    if (!c.moved && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) c.moved = true

    // 只有浏览模式才真的挪位置
    if (this.data.mode !== 'view') return

    const scale = this.data.scale || 1
    const nx = clamp(c.startX + dx / (scale * this.k), 0, WORLD_W - TILE_W)
    const ny = clamp(c.startY + dy / (scale * this.k), 0, WORLD_H - TILE_H)

    this.friends[c.index].x = nx
    this.friends[c.index].y = ny

    this.setData({
      ['friends[' + c.index + '].x']: nx,
      ['friends[' + c.index + '].y']: ny,
      edgesGeo: this.computeEdges(this.friends),
      labelsGeo: this.computeLabels(this.friends)
    })
  },

  onCardEnd() {
    const c = this.card
    this.card = null
    if (!c) return

    // 没怎么动 = 点了一下
    if (!c.moved) {
      if (this.data.mode === 'link') {
        this.selectFriend(c.id)
      } else if (this.data.mode === 'edit') {
        this.openFriendForm(c.id)
      }
      return
    }

    // 挪完了：把位置写回存储
    if (this.data.mode === 'view') {
      const b = this.curBoard()
      for (let i = 0; i < b.friends.length; i++) {
        for (let j = 0; j < this.friends.length; j++) {
          if (String(b.friends[i].id) === String(this.friends[j].id)) {
            b.friends[i].x = Math.round(this.friends[j].x)
            b.friends[i].y = Math.round(this.friends[j].y)
          }
        }
      }
      this.persist()
    }
  },

  // ---------------- 分类（内置 + 自己加的） ----------------
  loadCats() {
    const saved = wx.getStorageSync(CATS_KEY)
    this.customCats = saved && saved.length ? saved : []
  },

  persistCats() {
    wx.setStorageSync(CATS_KEY, this.customCats)
  },

  allCats() {
    return BASE_CATS.concat(this.customCats)
  },

  colorOf(key) {
    const all = this.allCats()
    for (let i = 0; i < all.length; i++) {
      if (all[i].key === key) return all[i].color
    }
    return BASE_CATS[0].color
  },

  // 找一个跟现有分类都不撞的颜色
  pickColor() {
    const all = this.allCats()
    const used = []
    for (let i = 0; i < all.length; i++) used.push(hueOf(all[i].color))

    // 在整圈色相里挑一个「离现有颜色最远」的
    let best = 265
    let bestScore = -1
    for (let h = 0; h < 360; h += 3) {
      let nearest = 360
      for (let i = 0; i < used.length; i++) {
        let d = Math.abs(h - used[i])
        if (d > 180) d = 360 - d
        if (d < nearest) nearest = d
      }
      if (nearest > bestScore) {
        bestScore = nearest
        best = h
      }
    }

    // 明暗错开：色相实在挤不开时，靠深浅也能一眼分出差别
    const n = this.customCats.length
    const light = n % 3 === 0 ? 0.58 : (n % 3 === 1 ? 0.44 : 0.68)

    return hslToHex(best, 0.66, light)
  },

  // ---------------- 弹窗输入（打开就自动聚焦，不用再点一下） ----------------
  openPrompt(title, placeholder, value, key, max) {
    const that = this

    this.setData({
      prompt: {
        show: true,
        focus: false,
        title: title,
        placeholder: placeholder,
        value: value || '',
        key: key,
        max: max || 20
      }
    })

    // 等这层渲染完再置 true，不然 iOS 上键盘弹不出来
    setTimeout(function () {
      that.setData({ 'prompt.focus': true })
    }, 120)
  },

  closePrompt() {
    this.setData({
      'prompt.show': false,
      'prompt.focus': false,
      'prompt.value': '',
      'prompt.key': ''
    })
  },

  noop() {},

  onPromptInput(e) {
    this.setData({ 'prompt.value': e.detail.value })
  },

  confirmPrompt() {
    const text = String(this.data.prompt.value || '').trim()
    const key = this.data.prompt.key

    this.closePrompt()

    if (key === 'cat') {
      this.createCat(text)
      return
    }

    if (key.indexOf('edge:') === 0) {
      this.saveEdgeLabel(key.slice(5), text)
      return
    }

    if (key === 'board') {
      this.saveBoardName(text)
    }
  },

  // ---------------- 编辑这页的文案 ----------------
  openTextForm() {
    const s = socialApi.getSocial()

    this.setData({
      showTextForm: true,
      textForm: {
        tagsText: (s.tags || []).join(' '),
        prefer: s.prefer || '',
        want: s.want || '',
        contact: s.contact || ''
      }
    })
  },

  closeTextForm() {
    this.setData({ showTextForm: false })
  },

  onTextField(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    this.setData({ ['textForm.' + key]: e.detail.value })
  },

  saveTextForm() {
    const f = this.data.textForm

    const tags = String(f.tagsText || '')
      .replace(/[,，、]/g, ' ')
      .split(/\s+/)
      .filter(function (t) {
        return !!t
      })
      .slice(0, 6)

    socialApi.saveSocial({
      tags: tags,
      prefer: String(f.prefer || '').trim(),
      want: String(f.want || '').trim(),
      contact: String(f.contact || '').trim()
    })

    this.setData({ showTextForm: false, social: socialApi.getSocial() })

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  // ---------------- 画布改名 ----------------
  renameBoard() {
    this.openPrompt('画布名称', '比如：大学同学 / 家人', this.data.boardName, 'board', BOARD_MAX)
  },

  saveBoardName(text) {
    const name = String(text || '').trim()
    if (!name) return

    const board = this.curBoard()
    board.name = name.slice(0, BOARD_MAX)
    this.persist()
    this.render()
  },

  // ---------------- 编辑某个人（改名 / 换分类） ----------------
  openFriendForm(id) {
    const that = this
    const board = this.curBoard()
    let item = null

    for (let i = 0; i < board.friends.length; i++) {
      if (String(board.friends[i].id) === String(id)) item = board.friends[i]
    }
    if (!item) return

    this.setData({
      friendForm: {
        show: true,
        focus: false,
        id: item.id,
        name: item.name || '',
        category: item.category || 'friend'
      }
    })

    setTimeout(function () {
      that.setData({ 'friendForm.focus': true })
    }, 120)
  },

  closeFriendForm() {
    this.setData({ 'friendForm.show': false, 'friendForm.focus': false })
  },

  onFriendName(e) {
    this.setData({ 'friendForm.name': e.detail.value })
  },

  pickFriendCat(e) {
    this.setData({ 'friendForm.category': e.currentTarget.dataset.key })
  },

  saveFriendForm() {
    const f = this.data.friendForm
    const name = String(f.name || '').trim()

    if (!name) {
      wx.showToast({ title: '给他起个名字', icon: 'none' })
      return
    }

    const board = this.curBoard()

    for (let i = 0; i < board.friends.length; i++) {
      if (String(board.friends[i].id) === String(f.id)) {
        board.friends[i].name = name.slice(0, 6)
        board.friends[i].category = f.category
      }
    }

    this.persist()
    this.setData({ 'friendForm.show': false, 'friendForm.focus': false })
    this.render()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: '已保存', icon: 'none' })
  },

  removeFriendFromForm() {
    const id = this.data.friendForm.id
    this.setData({ 'friendForm.show': false, 'friendForm.focus': false })
    this.deleteFriend(id)
  },

  // 加一个自己的分类
  addCat() {
    this.openPrompt('自定义分类', '比如：室友 / 网友 / 老师', '', 'cat', CAT_MAX)
  },

  createCat(rawName) {
    const name = String(rawName || '').trim()
    if (!name) return

    const all = this.allCats()
    for (let i = 0; i < all.length; i++) {
      if (all[i].name === name) {
        wx.showToast({ title: '已经有这个分类了', icon: 'none' })
        return
      }
    }

    const cat = {
      key: 'c' + Date.now(),
      name: name.slice(0, CAT_MAX),
      color: this.pickColor(),
      custom: true
    }

    this.customCats.push(cat)
    this.persistCats()
    this.setData({ cats: this.allCats(), newCat: cat.key })

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  },

  // 长按自己加的分类：把分类和里面的人一起删掉
  holdCat(e) {
    const key = e.currentTarget.dataset.key

    let index = -1
    for (let i = 0; i < this.customCats.length; i++) {
      if (this.customCats[i].key === key) index = i
    }

    if (index < 0) {
      wx.showToast({ title: '内置分类不能删', icon: 'none' })
      return
    }

    // 数一下有几块画布用到这个分类
    let count = 0
    for (let b = 0; b < this.boards.length; b++) {
      const fs = this.boards[b].friends
      for (let f = 0; f < fs.length; f++) {
        if (fs[f].category === key) count++
      }
    }

    const catName = this.customCats[index].name

    // 先拍个快照，删完可以撤销
    this.snapshotForUndo()

    this.customCats.splice(index, 1)
    this.persistCats()

    // 用这个分类的人，连同他们的连线一起删掉
    for (let b = 0; b < this.boards.length; b++) {
      const board = this.boards[b]

      const gone = {}
      const keep = []
      for (let f = 0; f < board.friends.length; f++) {
        if (board.friends[f].category === key) {
          gone[String(board.friends[f].id)] = true
        } else {
          keep.push(board.friends[f])
        }
      }
      board.friends = keep

      const edges = []
      for (let i = 0; i < board.edges.length; i++) {
        const e2 = board.edges[i]
        if (!gone[String(e2.a)] && !gone[String(e2.b)]) edges.push(e2)
      }
      board.edges = edges
    }
    this.persist()

    this.setData({
      cats: this.allCats(),
      newCat: this.data.newCat === key ? 'friend' : this.data.newCat,
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true,
      undoText: count > 0
        ? '已删除分类「' + catName + '」和里面的 ' + count + ' 个人'
        : '已删除分类「' + catName + '」'
    })
    this.render()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  },

  // ---------------- 数据 ----------------
  loadBoards() {
    const saved = wx.getStorageSync(KEY)
    if (saved && saved.length) return saved

    // 兼容上一版：把原来的朋友列表搬进第一块画布
    const old = wx.getStorageSync(OLD_KEY)
    const friends = []

    if (old && old.length) {
      for (let i = 0; i < old.length; i++) {
        friends.push({
          id: old[i].id,
          name: old[i].name,
          category: old[i].category,
          x: clamp(old[i].x || 0, 0, WORLD_W - TILE_W),
          y: clamp(old[i].y || 0, 0, WORLD_H - TILE_H)
        })
      }
    }

    const board = { id: Date.now(), name: '画布 1', friends: friends, edges: [] }
    wx.setStorageSync(KEY, [board])
    return [board]
  },

  persist() {
    wx.setStorageSync(KEY, this.boards)
  },

  curBoard() {
    return this.boards[this.data.current] || this.boards[0]
  },

  // 根据当前画布刷新界面
  render() {
    const b = this.curBoard()
    const pickedMap = {}
    for (let p = 0; p < this.data.picked.length; p++) {
      pickedMap[String(this.data.picked[p])] = true
    }

    const friends = []

    for (let i = 0; i < b.friends.length; i++) {
      const f = b.friends[i]
      friends.push({
        id: f.id,
        name: f.name,
        x: f.x,
        y: f.y,
        color: this.colorOf(f.category),
        initial: String(f.name).slice(0, 1),
        sel: pickedMap[String(f.id)] === true
      })
    }

    this.friends = friends

    const dots = []
    for (let i = 0; i < this.boards.length; i++) dots.push(i)

    this.setData({
      friends: friends,
      cats: this.allCats(),
      edgesGeo: this.computeEdges(friends, b),
      labelsGeo: this.computeLabels(friends, b),
      dotList: dots,
      boardName: b.name
    })
  },

  // 只挑出写了关系的线，单独一层渲染（要盖在名片上面）
  computeLabels(friends, board) {
    const edges = this.computeEdges(friends, board)
    const out = []
    for (let i = 0; i < edges.length; i++) {
      if (edges[i].label) {
        out.push({
          id: edges[i].id,
          text: edges[i].label,
          midX: edges[i].midX,
          midY: edges[i].midY
        })
      }
    }
    return out
  },

  // 计算每条连线的位置和角度
  computeEdges(friends, board) {
    const b = board || this.curBoard()
    const map = {}
    for (let i = 0; i < friends.length; i++) map[friends[i].id] = friends[i]

    const out = []
    for (let i = 0; i < b.edges.length; i++) {
      const e = b.edges[i]
      const a = map[e.a]
      const c = map[e.b]
      if (!a || !c) continue

      const x1 = a.x + TILE_W / 2
      const y1 = a.y + TILE_H / 2
      const x2 = c.x + TILE_W / 2
      const y2 = c.y + TILE_H / 2
      const dx = x2 - x1
      const dy = y2 - y1

      out.push({
        id: e.id,
        label: e.label || '',
        left: x1,
        top: y1,
        midX: (x1 + x2) / 2,
        midY: (y1 + y2) / 2,
        len: Math.sqrt(dx * dx + dy * dy),
        ang: (Math.atan2(dy, dx) * 180) / Math.PI
      })
    }
    return out
  },

  // ---------------- 模式 ----------------
  setMode(e) {
    this.setData({
      mode: e.currentTarget.dataset.mode,
      picked: []
    })
    this.render()
  },

  // ---------------- 画布翻页 ----------------
  goBoard(e) {
    const i = Number(e.currentTarget.dataset.index)
    if (i === this.data.current) return
    this.setData({ current: i, picked: [] })
    this.render()
  },

  prevBoard() {
    const len = this.boards.length
    if (len <= 1) return
    this.setData({ current: (this.data.current - 1 + len) % len, picked: [] })
    this.render()
  },

  nextBoard() {
    const len = this.boards.length
    if (len <= 1) return
    this.setData({ current: (this.data.current + 1) % len, picked: [] })
    this.render()
  },

  addBoard() {
    const board = { id: Date.now(), name: '画布 ' + (this.boards.length + 1), friends: [], edges: [] }
    this.boards.push(board)
    this.persist()
    this.setData({ current: this.boards.length - 1, picked: [] })
    this.render()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  },

  removeBoard() {
    if (this.boards.length <= 1) {
      wx.showToast({ title: '至少留一块画布', icon: 'none' })
      return
    }

    const name = this.data.boardName

    this.snapshotForUndo()

    this.boards.splice(this.data.current, 1)
    this.persist()
    this.setData({
      current: 0,
      picked: [],
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true,
      undoText: '已删除画布「' + name + '」'
    })
    this.render()
  },

  // ---------------- 连线 ----------------
  selectFriend(id) {
    const picked = []
    for (let i = 0; i < this.data.picked.length; i++) picked.push(String(this.data.picked[i]))

    const key = String(id)
    const idx = picked.indexOf(key)

    if (idx >= 0) {
      picked.splice(idx, 1)
    } else if (picked.length < 2) {
      picked.push(key)
    }

    if (picked.length === 2) {
      this.connect(picked[0], picked[1])
      this.setData({ picked: [] })
    } else {
      this.setData({ picked: picked })
    }

    this.render()
  },

  // 连线的开关：没连就连上，连过了就取消
  connect(a, b) {
    const board = this.curBoard()
    let found = -1

    for (let i = 0; i < board.edges.length; i++) {
      const e = board.edges[i]
      if (
        (String(e.a) === String(a) && String(e.b) === String(b)) ||
        (String(e.a) === String(b) && String(e.b) === String(a))
      ) {
        found = i
      }
    }

    if (found >= 0) {
      board.edges.splice(found, 1)
      wx.showToast({ title: '已取消连线', icon: 'none' })
    } else {
      board.edges.push({ id: Date.now(), a: a, b: b })
      wx.showToast({ title: '连上啦', icon: 'none' })
    }

    this.persist()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  },

  // ---------------- 双击连线写关系 ----------------
  onEdgeTap(e) {
    const id = String(e.currentTarget.dataset.id)
    const now = Date.now()

    if (this.lastEdge && this.lastEdge.id === id && now - this.lastEdge.time < 350) {
      this.lastEdge = null
      this.editEdge(id)
    } else {
      this.lastEdge = { id: id, time: now }
    }
  },

  editEdge(id) {
    const board = this.curBoard()
    let edge = null

    for (let i = 0; i < board.edges.length; i++) {
      if (String(board.edges[i].id) === String(id)) edge = board.edges[i]
    }
    if (!edge) return

    this.openPrompt('这段关系是什么', '比如：大学室友 / 发小 / 前同事', edge.label || '', 'edge:' + id, EDGE_MAX)
  },

  saveEdgeLabel(id, text) {
    const board = this.curBoard()
    let edge = null

    for (let i = 0; i < board.edges.length; i++) {
      if (String(board.edges[i].id) === String(id)) edge = board.edges[i]
    }
    if (!edge) return

    edge.label = text
    this.persist()
    this.render()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  },

  // ---------------- 添加 / 删除朋友 ----------------
  onName(e) {
    this.setData({ newName: e.detail.value })
  },

  pickCat(e) {
    this.setData({ newCat: e.currentTarget.dataset.key })
  },

  // 在画布上找一个没人占的格子（5 列 × 4 行），都占满了就返回 null
  nextFreeSpot(board) {
    const COLS = 5
    const ROWS = 4
    const PAD = 14

    const gapX = (WORLD_W - TILE_W - PAD * 2) / (COLS - 1)
    const gapY = (WORLD_H - TILE_H - PAD * 2) / (ROWS - 1)

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = Math.round(PAD + c * gapX)
        const y = Math.round(PAD + r * gapY)

        let free = true
        for (let i = 0; i < board.friends.length; i++) {
          const f = board.friends[i]
          if (Math.abs(f.x - x) < TILE_W * 0.75 && Math.abs(f.y - y) < TILE_H * 0.7) {
            free = false
            break
          }
        }

        if (free) return { x: x, y: y }
      }
    }

    return null
  },

  addFriend() {
    const name = String(this.data.newName).trim()

    if (!name) {
      wx.showToast({ title: '先写个名字', icon: 'none' })
      return
    }

    const board = this.curBoard()
    const spot = this.nextFreeSpot(board)

    if (!spot) {
      wx.showToast({ title: '这块画布放不下了，加一块吧', icon: 'none' })
      return
    }

    board.friends.push({
      id: Date.now(),
      name: name,
      category: this.data.newCat,
      x: spot.x,
      y: spot.y
    })

    this.persist()
    this.setData({ newName: '' })
    this.render()

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
  },

  // ---------------- 删除 + 撤销 ----------------
  snapshotForUndo() {
    this.undoSnapshot = {
      boards: JSON.parse(JSON.stringify(this.boards)),
      cats: JSON.parse(JSON.stringify(this.customCats)),
      current: this.data.current
    }
  },

  onUndo() {
    if (this.undoSnapshot) {
      this.boards = this.undoSnapshot.boards
      this.customCats = this.undoSnapshot.cats
      this.persist()
      this.persistCats()
      this.setData({ cats: this.allCats(), current: this.undoSnapshot.current || 0 })
      this.undoSnapshot = null
      this.render()
    }
    this.setData({ undoShow: false })
  },

  onUndoClose() {
    this.undoSnapshot = null
    this.setData({ undoShow: false })
  },

  deleteFriend(id) {
    if (!id) return

    const board = this.curBoard()
    let name = ''

    for (let i = 0; i < board.friends.length; i++) {
      if (String(board.friends[i].id) === String(id)) name = board.friends[i].name
    }

    this.snapshotForUndo()

    board.friends = board.friends.filter(function (f) {
      return String(f.id) !== String(id)
    })
    board.edges = board.edges.filter(function (e2) {
      return String(e2.a) !== String(id) && String(e2.b) !== String(id)
    })

    this.persist()
    this.render()
    this.setData({ undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true, undoText: '已删除「' + name + '」和他的连线' })
  }
})

