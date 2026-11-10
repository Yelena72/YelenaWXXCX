// pages/future/future.js —— 未来展望
// 第一次打开时会把 data/content.js 里的 future 搬进本地缓存，
// 之后直接在小程序里添加 / 删除就行，不用改代码。

const content = require('../../data/content.js')

const KEY = 'yelena_future'

const GROUPS = [
  { key: 'ultimate', name: '终极目标', desc: '这辈子一定要做到的', color: '#FF8FC7' },
  { key: 'short', name: '短期目标', desc: '一两年内想完成的', color: '#4FC3F7' },
  { key: 'place', name: '想去的地方', desc: '攒钱和假期，一个个去', color: '#6FD070' }
]

const SCENES = [
  { key: 'sea', name: '海边' },
  { key: 'mountain', name: '山顶' },
  { key: 'city', name: '城市' },
  { key: 'forest', name: '森林' },
  { key: 'sky', name: '热气球' }
]

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('未来展望')

// 按图片比例算配图区高度
const imgbox = require('../../data/imgbox.js')

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    sections: [],
    total: 0,

    groups: GROUPS,
    scenes: SCENES,

    showForm: false,
    formFocus: false,
    editingId: '',
    formGroup: 'ultimate',
    formText: '',
    formNote: '',
    formWhen: '',
    formScene: 'sea',
    formImage: '',
    formImgW: 0,
    formImgH: 0,

    undoShow: false,
    undoText: ''
  },

  onLoad() {
    this.list = this.loadList()
    this.render()
  },

  // 从详情页回来：可能带回了「要修改」或「要删除」的指令
  onShow() {
    const app = getApp()

    if (app.pendingWishDelete) {
      const id = app.pendingWishDelete
      app.pendingWishDelete = null
      this.deleteWish(id)
    }

    if (app.pendingWishEdit) {
      const id = app.pendingWishEdit
      app.pendingWishEdit = null
      this.openEditById(id)
    }

    // 老数据没有图片尺寸，进来时补一次（补完会自己刷新）
    this.backfillSizes()
  },

  // 给「有图但没有尺寸」的愿望补上宽高，这样老愿望也能按比例显示
  backfillSizes() {
    const that = this
    const todo = []

    for (let i = 0; i < this.list.length; i++) {
      const w = this.list[i]
      if (w.image && !(w.imgW && w.imgH)) todo.push(w)
    }

    if (!todo.length) return

    let left = todo.length
    let changed = false

    todo.forEach(function (w) {
      imgbox.getSize(w.image, function (width, height) {
        if (width && height) {
          w.imgW = width
          w.imgH = height
          changed = true
        }

        left--
        if (left === 0 && changed) {
          that.persist()
          that.render()
        }
      })
    })
  },

  loadList() {
    const saved = wx.getStorageSync(KEY)
    if (saved && saved.length) return saved

    const src = content.future || []
    const list = []

    for (let i = 0; i < src.length; i++) {
      list.push({
        id: Date.now() + i,
        group: src[i].group || 'short',
        text: src[i].text,
        note: src[i].note || '',
        when: src[i].when || '',
        scene: src[i].scene || 'sea',
        image: '',
        imgW: 0,
        imgH: 0
      })
    }

    wx.setStorageSync(KEY, list)
    return list
  },

  persist() {
    wx.setStorageSync(KEY, this.list)
  },

  render() {
    const sections = []
    let total = 0

    for (let i = 0; i < GROUPS.length; i++) {
      const g = GROUPS[i]
      const items = []

      for (let j = 0; j < this.list.length; j++) {
        const w = this.list[j]
        if (w.group !== g.key) continue

        // 有自己选的图，就按图的比例算配图区高度；没有就用固定的风景框
        const box = w.image
          ? imgbox.mediaBox(w.imgW, w.imgH, 1100)
          : { height: imgbox.DEFAULT_H, mode: 'aspectFill' }

        items.push({
          id: w.id,
          text: w.text,
          note: w.note,
          when: w.when,
          scene: w.scene,
          image: w.image,
          mediaH: box.height,
          imgMode: box.mode,
          no: items.length + 1
        })
      }

      total += items.length

      if (items.length) {
        sections.push({
          key: g.key,
          name: g.name,
          desc: g.desc,
          color: g.color,
          items: items
        })
      }
    }

    this.setData({ sections: sections, total: total })
  },

  // ---------------- 表单 ----------------
  // 新增：表单全空
  openForm() {
    const that = this

    this.setData({
      showForm: true,
      formFocus: false,
      editingId: '',
      formGroup: 'ultimate',
      formText: '',
      formNote: '',
      formWhen: '',
      formScene: 'sea',
      formImage: '',
      formImgW: 0,
      formImgH: 0
    })

    // 等这层渲染完再置 true，不然 iOS 上键盘弹不出来
    setTimeout(function () {
      that.setData({ formFocus: true })
    }, 120)
  },

  // 点卡片：跳到详情页
  openWish(e) {
    const id = e.currentTarget.dataset.id
    if (!id && id !== 0) return

    wx.navigateTo({
      url: '/pages/wish/wish?id=' + id,
      fail() {
        wx.showToast({ title: '详情页打不开，请重新编译', icon: 'none' })
      }
    })
  },

  // 长按卡片：直接进编辑
  editWish(e) {
    this.openEditById(e.currentTarget.dataset.id)
  },

  // 按 id 打开编辑表单（详情页点了「修改」回来也走这里）
  openEditById(id) {
    const that = this
    let item = null

    for (let i = 0; i < this.list.length; i++) {
      if (String(this.list[i].id) === String(id)) item = this.list[i]
    }
    if (!item) return

    this.setData({
      showForm: true,
      formFocus: false,
      editingId: item.id,
      formGroup: item.group || 'ultimate',
      formText: item.text || '',
      formNote: item.note || '',
      formWhen: item.when || '',
      formScene: item.scene || 'sea',
      formImage: item.image || '',
      formImgW: item.imgW || 0,
      formImgH: item.imgH || 0
    })

    setTimeout(function () {
      that.setData({ formFocus: true })
    }, 120)
  },

  closeForm() {
    this.setData({ showForm: false, formFocus: false, editingId: '' })
  },

  noop() {},

  pickGroup(e) {
    this.setData({ formGroup: e.currentTarget.dataset.key })
  },

  pickScene(e) {
    this.setData({ formScene: e.currentTarget.dataset.key, formImage: '' })
  },

  onText(e) {
    this.setData({ formText: e.detail.value })
  },

  onNote(e) {
    this.setData({ formNote: e.detail.value })
  },

  onWhen(e) {
    this.setData({ formWhen: e.detail.value })
  },

  // 从相册选一张图，存到本地文件系统
  // ⚠️ 选图片要用相册/相机，属于隐私接口。
  // 必须在小程序后台「设置 → 服务内容声明 → 用户隐私保护指引」里
  // 勾选「选中的照片或视频信息」，否则正式版里这个按钮会直接失败。
  // 这里先走一遍隐私授权，没同意过的话微信会自己弹协议给用户看。
  chooseImage() {
    const that = this

    if (typeof wx.requirePrivacyAuthorize !== 'function') {
      // 基础库太老，没有隐私接口，直接选
      this.pickImage()
      return
    }

    wx.requirePrivacyAuthorize({
      success() {
        that.pickImage()
      },
      fail() {
        wx.showModal({
          title: '需要先同意隐私协议',
          content: '选自己的图片要用到相册，得先同意隐私协议才能用。\n也可以直接用下面那几张像素配图。',
          showCancel: false,
          confirmText: '知道了'
        })
      }
    })
  },

  // 真正的选图
  pickImage() {
    const that = this

    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sizeType: ['compressed'],
      // 只要相册，不要相机：少一项隐私声明，审核也少一个卡点
      sourceType: ['album'],
      success(res) {
        const f = res.tempFiles[0]
        const temp = f.tempFilePath

        function done(path) {
          that.setData({ formImage: path })

          // chooseMedia 一般会带宽高；万一没带，就再问一次文件本身
          if (f.width && f.height) {
            that.setData({ formImgW: f.width, formImgH: f.height })
          } else {
            imgbox.getSize(path, function (width, height) {
              that.setData({ formImgW: width, formImgH: height })
            })
          }
        }

        wx.getFileSystemManager().saveFile({
          tempFilePath: temp,
          success(r) {
            done(r.savedFilePath)
          },
          fail() {
            // 存不下就先用临时路径（重启后失效）
            done(temp)
          }
        })
      },
      fail(err) {
        // 用户自己取消不算错误，不用打扰
        const msg = String((err && err.errMsg) || '')
        if (msg.indexOf('cancel') >= 0) return

        if (msg.indexOf('privacy') >= 0 || msg.indexOf('deny') >= 0) {
          wx.showToast({ title: '没拿到相册权限，可以先用下面的配图', icon: 'none' })
        } else {
          wx.showToast({ title: '打不开相册，可以先用下面的配图', icon: 'none' })
        }
      }
    })
  },

  clearImage() {
    this.setData({ formImage: '', formImgW: 0, formImgH: 0 })
  },

  saveWish() {
    const text = String(this.data.formText).trim()

    if (!text) {
      wx.showToast({ title: '先写点内容', icon: 'none' })
      return
    }

    const data = {
      group: this.data.formGroup,
      text: text,
      note: String(this.data.formNote).trim(),
      when: String(this.data.formWhen).trim(),
      scene: this.data.formScene,
      image: this.data.formImage,
      // 记下原图尺寸，列表里按它的比例算显示框，图片就不会被裁
      imgW: this.data.formImage ? (this.data.formImgW || 0) : 0,
      imgH: this.data.formImage ? (this.data.formImgH || 0) : 0
    }

    const editingId = this.data.editingId
    let done = false

    if (editingId) {
      for (let i = 0; i < this.list.length; i++) {
        if (String(this.list[i].id) === String(editingId)) {
          // 换了配图，把旧图片文件删掉，不然会一直占手机空间
          if (this.list[i].image && this.list[i].image !== data.image) {
            this.removeLocalFile(this.list[i].image)
          }

          this.list[i].group = data.group
          this.list[i].text = data.text
          this.list[i].note = data.note
          this.list[i].when = data.when
          this.list[i].scene = data.scene
          this.list[i].image = data.image
          this.list[i].imgW = data.imgW
          this.list[i].imgH = data.imgH
          done = true
        }
      }
    }

    if (!done) {
      this.list.push({
        id: Date.now(),
        group: data.group,
        text: data.text,
        note: data.note,
        when: data.when,
        scene: data.scene,
        image: data.image,
        imgW: data.imgW,
        imgH: data.imgH
      })
    }

    this.persist()
    this.render()
    this.setData({ showForm: false, formFocus: false, editingId: '' })

    if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
    wx.showToast({ title: done ? '改好啦' : '加上啦', icon: 'none' })
  },

  // 删掉 saveFile 存下来的本地图片（临时文件和非本地路径不管）
  removeLocalFile(path) {
    if (!path) return
    if (!wx.env || !wx.env.USER_DATA_PATH) return
    if (path.indexOf(wx.env.USER_DATA_PATH) !== 0) return

    wx.getFileSystemManager().unlink({
      filePath: path,
      fail() {
        // 文件已经没了就算了
      }
    })
  },

  // 表单里的「删除」按钮（详情页的删除也是绕回这里走一遍）
  removeEditing() {
    this.deleteWish(this.data.editingId)
  },

  deleteWish(id) {
    if (!id) return

    let target = null
    const keep = []

    for (let i = 0; i < this.list.length; i++) {
      if (String(this.list[i].id) === String(id)) {
        target = this.list[i]
      } else {
        keep.push(this.list[i])
      }
    }
    if (!target) return

    this.undoSnapshot = this.list.slice()
    // 图片文件先别删：撤销的时候还要用，等撤销窗口过了再删
    this.undoFile = target.image || ''

    this.list = keep
    this.persist()
    this.render()
    this.setData({
      showForm: false,
      formFocus: false,
      editingId: '',
      undoSeq: (this.data.undoSeq || 0) + 1,
      undoShow: true,
      undoText: '已删除这个展望'
    })
  },

  onUndo() {
    if (this.undoSnapshot) {
      this.list = this.undoSnapshot
      this.undoSnapshot = null
      this.persist()
      this.render()
    }

    // 撤销了就别删图片了
    this.undoFile = ''
    this.setData({ undoShow: false })
  },

  onUndoClose() {
    // 撤销窗口过了，这时候才真正删掉图片文件
    if (this.undoFile) {
      this.removeLocalFile(this.undoFile)
      this.undoFile = ''
    }
    this.undoSnapshot = null
    this.setData({ undoShow: false })
  }
})
