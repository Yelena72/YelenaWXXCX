// pages/wish/wish.js —— 单个愿望的详情页
// 从「未来展望」列表点卡片进来，id 通过 url 传过来。

const KEY = 'yelena_future'

// 转发 / 分享到朋友圈
const share = require('../../data/share.js').build('我的愿望')

// 按图片比例算配图区高度
const imgbox = require('../../data/imgbox.js')

// 分组和配图的名字（跟 future.js 里的保持一致）
const GROUPS = {
  ultimate: { name: '终极目标', desc: '这辈子一定要做到的', color: '#FF8FC7' },
  short: { name: '短期目标', desc: '一两年内想完成的', color: '#4FC3F7' },
  place: { name: '想去的地方', desc: '攒钱和假期，一个个去', color: '#6FD070' }
}

const SCENES = {
  sea: '海边',
  mountain: '山顶',
  city: '城市',
  forest: '森林',
  sky: '热气球'
}

Page({
  onShareAppMessage: share.app,
  onShareTimeline: share.timeline,

  data: {
    ok: false,
    wish: null,
    groupName: '',
    groupDesc: '',
    groupColor: '#4FC3F7',
    sceneName: '',
    mediaH: 380,
    imgMode: 'aspectFill'
  },

  onLoad(options) {
    const id = String(options.id || '')
    const list = wx.getStorageSync(KEY) || []

    let target = null
    for (let i = 0; i < list.length; i++) {
      if (String(list[i].id) === id) target = list[i]
    }

    if (!target) {
      wx.showToast({ title: '这个愿望已经不见了', icon: 'none' })
      setTimeout(function () {
        wx.navigateBack()
      }, 900)
      return
    }

    const g = GROUPS[target.group] || GROUPS.short
    const that = this

    // 有自己的图就按图的比例算高度（详情页可以更高，最多 1200rpx）
    const box = target.image
      ? imgbox.mediaBox(target.imgW, target.imgH, 1400)
      : { height: 380, mode: 'aspectFill' }

    this.setData({
      ok: true,
      wish: target,
      groupName: g.name,
      groupDesc: g.desc,
      groupColor: g.color,
      sceneName: SCENES[target.scene] || '海边',
      mediaH: box.height,
      imgMode: box.mode
    })

    // 老数据没有尺寸：问一次文件本身，再重算
    if (target.image && !(target.imgW && target.imgH)) {
      imgbox.getSize(target.image, function (width, height) {
        if (!width || !height) return

        const b = imgbox.mediaBox(width, height, 1400)
        that.setData({ mediaH: b.height, imgMode: b.mode })
      })
    }
  },

  // 修改：回上一页，让列表页把编辑表单打开
  goEdit() {
    getApp().pendingWishEdit = this.data.wish.id
    wx.navigateBack()
  },

  // 删除：回上一页，走列表页那套「删完可以撤销」的流程
  goDelete() {
    getApp().pendingWishDelete = this.data.wish.id
    wx.navigateBack()
  }
})
